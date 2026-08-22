'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { loadMarketData, SYMBOL_LABELS } from '../lib/supabase';

const WINDOWS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: null },
];

const DRAW_COLOR = '#8ea3c6';
const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

// Per-symbol persistence (localStorage). Per-user isolation arrives with auth (Phase 3).
const levelsKey = (s) => `sentiment_levels_${s}`;
const drawKey = (s) => `sentiment_draw_${s}`;
const oldTrendKey = (s) => `sentiment_trends_${s}`;
const loadJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const saveJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Drawings are typed: { type, points:[{logical,price}], text? }.
// (trend/ray/fib use 2 points, text uses 1.) Migrate the old flat trend format.
function loadDrawings(sym) {
  const cur = loadJson(drawKey(sym));
  if (cur.length) return cur;
  const old = loadJson(oldTrendKey(sym));
  return old.map((seg) => ({ type: 'trend', points: seg }));
}

const TOOLS = [
  { id: 'cursor', glyph: '⤢', title: 'Cursor — pan & zoom' },
  { id: 'trend', glyph: '╱', title: 'Trend line — click start, click end' },
  { id: 'ray', glyph: '↗', title: 'Ray — extends past the 2nd point' },
  { id: 'fib', glyph: '≣', title: 'Fib retracement — click high, click low' },
  { id: 'horizontal', glyph: '─', title: 'Horizontal level — click to place' },
  { id: 'text', glyph: 'T', title: 'Text — click to place a note' },
  { id: 'eraser', glyph: '⌫', title: 'Erase — click a drawing to remove' },
];

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Simple moving average of candle closes → [{ time, value }].
function computeSMA(candles, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

export default function PriceChart({ symbols = [], defaultSymbol = 'SPX', win: controlledWin = null, height = 400, history = [] }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const sma50Ref = useRef(null);
  const sma200Ref = useRef(null);
  const dataRef = useRef([]);
  const priceLinesRef = useRef([]);   // [{ price, line }]
  const drawingsRef = useRef([]);     // [{ type, points, text? }]
  const pendingRef = useRef(null);    // in-progress { type, points:[p1] }
  const hotRef = useRef(null);        // { di, pi } endpoint under cursor (cursor mode)
  const dragRef = useRef(null);       // { di, pi } endpoint being dragged
  const toolRef = useRef('cursor');
  const symbolRef = useRef(defaultSymbol);

  const [chartLib, setChartLib] = useState(null);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [internalWin, setInternalWin] = useState('6M');
  const win = controlledWin ?? internalWin;
  const setWin = setInternalWin;
  const [loading, setLoading] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [meta, setMeta] = useState(null);
  const [tool, setTool] = useState('cursor');
  const [drawCount, setDrawCount] = useState(0);
  const [sma50On, setSma50On] = useState(false);
  const [sma200On, setSma200On] = useState(false);
  const [hot, setHot] = useState(false); // hovering a drawing endpoint (cursor mode)
  const [signalsOn, setSignalsOn] = useState(true);

  // Past sentiment extremes as chart markers: fear (green ▲ below) / greed (red ▼ above).
  const markers = useMemo(() => {
    if (!history || !history.length) return [];
    const out = [];
    for (const h of history) {
      const s = h.eod_score ?? h.live_score;
      if (s == null || !h.date) continue;
      if (s <= 30) out.push({ time: h.date, position: 'belowBar', color: '#23d18b', shape: 'arrowUp' });
      else if (s >= 70) out.push({ time: h.date, position: 'aboveBar', color: '#f64f68', shape: 'arrowDown' });
    }
    return out;
  }, [history]);

  const applyMarkers = useCallback(() => {
    const series = seriesRef.current;
    if (!series) return;
    try { series.setMarkers(signalsOn ? markers : []); } catch {}
  }, [signalsOn, markers]);

  const refreshCount = useCallback(() => {
    setDrawCount(priceLinesRef.current.length + drawingsRef.current.length);
  }, []);

  // ---- Horizontal levels (native price lines) ----
  const makeLine = (series, price) => series.createPriceLine({
    price, color: DRAW_COLOR, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '',
  });
  const redrawLevels = useCallback((sym) => {
    const series = seriesRef.current;
    if (!series) return;
    priceLinesRef.current.forEach((pl) => { try { series.removePriceLine(pl.line); } catch {} });
    priceLinesRef.current = loadJson(levelsKey(sym)).map((price) => ({ price, line: makeLine(series, price) }));
    refreshCount();
  }, [refreshCount]);
  const addLevelAt = useCallback((y) => {
    const series = seriesRef.current;
    if (!series) return;
    const price = series.coordinateToPrice(y);
    if (price == null) return;
    const rounded = Number(price.toFixed(2));
    priceLinesRef.current.push({ price: rounded, line: makeLine(series, rounded) });
    saveJson(levelsKey(symbolRef.current), priceLinesRef.current.map((x) => x.price));
    refreshCount();
  }, [refreshCount]);

  // ---- Canvas overlay drawings ----
  const redrawOverlay = useCallback((preview) => {
    const cv = overlayRef.current, chart = chartRef.current, series = seriesRef.current, el = containerRef.current;
    if (!cv || !chart || !series || !el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth, h = el.clientHeight;
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ts = chart.timeScale();
    const xy = (p) => {
      const x = ts.logicalToCoordinate(p.logical);
      const y = series.priceToCoordinate(p.price);
      return (x == null || y == null) ? null : [x, y];
    };
    ctx.font = '11px ui-monospace, monospace';
    ctx.textBaseline = 'middle';

    const drawOne = (d, dashed) => {
      ctx.strokeStyle = DRAW_COLOR; ctx.fillStyle = DRAW_COLOR; ctx.lineWidth = 1.6;
      if (dashed) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
      if (d.type === 'text') {
        const a = xy(d.points[0]); if (!a) return;
        ctx.fillStyle = '#e9edf4';
        ctx.fillText(d.text || '', a[0] + 6, a[1]);
        ctx.fillStyle = DRAW_COLOR;
        ctx.beginPath(); ctx.arc(a[0], a[1], 2.5, 0, Math.PI * 2); ctx.fill();
        return;
      }
      const a = xy(d.points[0]), b = xy(d.points[1] || d.points[0]);
      if (!a || !b) return;
      if (d.type === 'trend') {
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      } else if (d.type === 'ray') {
        let ex = b[0], ey = b[1];
        if (b[0] !== a[0]) {
          const tx = b[0] > a[0] ? w : 0;
          const tt = (tx - a[0]) / (b[0] - a[0]);
          if (tt > 1) { ex = tx; ey = a[1] + tt * (b[1] - a[1]); }
        }
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(ex, ey); ctx.stroke();
      } else if (d.type === 'fib') {
        const p0 = d.points[0].price, p1 = d.points[1].price;
        const x0 = Math.min(a[0], b[0]);
        for (const lvl of FIB) {
          const yy = series.priceToCoordinate(p0 + (p1 - p0) * lvl);
          if (yy == null) continue;
          ctx.globalAlpha = lvl === 0 || lvl === 1 ? 0.9 : 0.45;
          ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(w, yy); ctx.stroke();
          ctx.globalAlpha = 0.8;
          ctx.fillText(lvl.toFixed(3), x0 + 4, yy - 6);
        }
        ctx.globalAlpha = 1;
      }
      // endpoint handles
      ctx.setLineDash([]);
      for (const pt of [a, b]) { ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.5, 0, Math.PI * 2); ctx.fill(); }
    };

    for (const d of drawingsRef.current) drawOne(d, false);
    if (pendingRef.current && preview) {
      drawOne({ type: pendingRef.current.type, points: [pendingRef.current.points[0], preview.p] }, true);
    }
    ctx.setLineDash([]);
  }, []);

  const redrawDrawings = useCallback((sym) => {
    drawingsRef.current = loadDrawings(sym);
    pendingRef.current = null;
    redrawOverlay();
    refreshCount();
  }, [redrawOverlay, refreshCount]);

  const saveDrawings = useCallback(() => {
    saveJson(drawKey(symbolRef.current), drawingsRef.current);
    refreshCount();
  }, [refreshCount]);

  const localXY = (e) => {
    const r = containerRef.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const toDataPoint = (x, y) => {
    const chart = chartRef.current, series = seriesRef.current;
    const logical = chart.timeScale().coordinateToLogical(x);
    const price = series.coordinateToPrice(y);
    return (logical == null || price == null) ? null : { logical, price };
  };

  const hitEndpoint = useCallback((x, y) => {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return null;
    const ts = chart.timeScale();
    for (let di = 0; di < drawingsRef.current.length; di++) {
      const pts = drawingsRef.current[di].points;
      for (let pi = 0; pi < pts.length; pi++) {
        const cx = ts.logicalToCoordinate(pts[pi].logical), cy = series.priceToCoordinate(pts[pi].price);
        if (cx != null && cy != null && Math.hypot(x - cx, y - cy) <= 7) return { di, pi };
      }
    }
    return null;
  }, []);

  const onOverlayDown = useCallback((e) => {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return;
    const [x, y] = localXY(e);
    const t = toolRef.current;

    if (t === 'cursor') { if (hotRef.current) dragRef.current = hotRef.current; return; }

    if (t === 'eraser') {
      const ts = chart.timeScale();
      const px = (p) => { const cx = ts.logicalToCoordinate(p.logical), cy = series.priceToCoordinate(p.price); return (cx == null || cy == null) ? null : [cx, cy]; };
      const idx = drawingsRef.current.findIndex((d) => {
        if (d.type === 'text') { const a = px(d.points[0]); return a && Math.hypot(x - a[0], y - a[1]) <= 12; }
        const a = px(d.points[0]), b = px(d.points[1] || d.points[0]);
        if (!a || !b) return false;
        if (d.type === 'fib') {
          const p0 = d.points[0].price, p1 = d.points[1].price;
          return FIB.some((lvl) => { const yy = series.priceToCoordinate(p0 + (p1 - p0) * lvl); return yy != null && Math.abs(y - yy) <= 5 && x >= Math.min(a[0], b[0]) - 4; });
        }
        return distToSeg(x, y, a[0], a[1], b[0], b[1]) <= 6;
      });
      if (idx >= 0) { drawingsRef.current.splice(idx, 1); saveDrawings(); redrawOverlay(); return; }
      const pl = priceLinesRef.current.find((p) => { const c = series.priceToCoordinate(p.price); return c != null && Math.abs(c - y) <= 6; });
      if (pl) {
        try { series.removePriceLine(pl.line); } catch {}
        priceLinesRef.current = priceLinesRef.current.filter((p) => p !== pl);
        saveJson(levelsKey(symbolRef.current), priceLinesRef.current.map((p) => p.price));
        refreshCount();
      }
      return;
    }

    if (t === 'horizontal') { addLevelAt(y); return; }

    if (t === 'text') {
      const dp = toDataPoint(x, y);
      if (!dp) return;
      const txt = window.prompt('Text label:');
      if (txt && txt.trim()) {
        drawingsRef.current.push({ type: 'text', points: [dp], text: txt.trim() });
        saveDrawings();
        redrawOverlay();
      }
      return;
    }

    // 2-point tools: trend / ray / fib
    const dp = toDataPoint(x, y);
    if (!dp) return;
    if (!pendingRef.current) {
      pendingRef.current = { type: t, points: [dp] };
    } else {
      drawingsRef.current.push({ type: pendingRef.current.type, points: [pendingRef.current.points[0], dp] });
      pendingRef.current = null;
      saveDrawings();
    }
    redrawOverlay();
  }, [addLevelAt, redrawOverlay, saveDrawings, refreshCount]);

  const onOverlayMove = useCallback((e) => {
    const [x, y] = localXY(e);
    if (dragRef.current) {
      const dp = toDataPoint(x, y);
      if (dp) { const { di, pi } = dragRef.current; if (drawingsRef.current[di]) { drawingsRef.current[di].points[pi] = dp; redrawOverlay(); } }
      return;
    }
    if (toolRef.current === 'cursor') { const h = hitEndpoint(x, y); hotRef.current = h; setHot(!!h); return; }
    if (pendingRef.current) { const dp = toDataPoint(x, y); if (dp) redrawOverlay({ p: dp }); }
  }, [redrawOverlay, hitEndpoint]);

  const onOverlayUp = useCallback(() => {
    if (dragRef.current) { dragRef.current = null; saveDrawings(); redrawOverlay(); }
  }, [saveDrawings, redrawOverlay]);

  const applyWindow = useCallback((label) => {
    const chart = chartRef.current, data = dataRef.current;
    if (!chart || data.length === 0) return;
    const ts = chart.timeScale();
    if (label === 'ALL') { ts.fitContent(); return; }
    const days = WINDOWS.find((w) => w.label === label)?.days ?? 180;
    const lastTime = data[data.length - 1].time;
    const from = new Date(lastTime); from.setDate(from.getDate() - days);
    try { ts.setVisibleRange({ from: from.toISOString().slice(0, 10), to: lastTime }); }
    catch { ts.fitContent(); }
  }, []);

  const updateSMAs = useCallback(() => {
    const d = dataRef.current || [];
    if (sma50Ref.current) sma50Ref.current.setData(sma50On && d.length ? computeSMA(d, 50) : []);
    if (sma200Ref.current) sma200Ref.current.setData(sma200On && d.length ? computeSMA(d, 200) : []);
  }, [sma50On, sma200On]);

  const clearAll = useCallback(() => {
    const series = seriesRef.current;
    if (series) priceLinesRef.current.forEach((pl) => { try { series.removePriceLine(pl.line); } catch {} });
    priceLinesRef.current = [];
    drawingsRef.current = [];
    pendingRef.current = null;
    saveJson(levelsKey(symbolRef.current), []);
    saveJson(drawKey(symbolRef.current), []);
    redrawOverlay();
    refreshCount();
  }, [redrawOverlay, refreshCount]);

  useEffect(() => { toolRef.current = tool; pendingRef.current = null; redrawOverlay(); }, [tool, redrawOverlay]);
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);
  useEffect(() => { import('lightweight-charts').then(setChartLib); }, []);

  // Create the chart once.
  useEffect(() => {
    if (!chartLib || !containerRef.current) return;
    const { createChart, ColorType, CrosshairMode } = chartLib;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 400,
      layout: { background: { type: ColorType.Solid, color: '#0b1018' }, textColor: '#8497b3', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
      grid: { vertLines: { color: '#18202f' }, horzLines: { color: '#18202f' } },
      crosshair: { mode: CrosshairMode ? CrosshairMode.Normal : 0 },
      rightPriceScale: { borderColor: '#22304a', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: '#22304a', timeVisible: false, rightOffset: 4 },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#23d18b', downColor: '#f64f68', wickUpColor: '#23d18b', wickDownColor: '#f64f68', borderVisible: false,
    });
    const sma50 = chart.addLineSeries({ color: '#5e9bff', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const sma200 = chart.addLineSeries({ color: '#f0a742', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    chart.subscribeClick((param) => { if (toolRef.current === 'horizontal' && param.point) addLevelAt(param.point.y); });
    const redraw = () => redrawOverlay();
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    const onCross = (param) => {
      if (toolRef.current !== 'cursor' || dragRef.current || !param.point) return;
      const h = hitEndpoint(param.point.x, param.point.y);
      hotRef.current = h; setHot(!!h);
    };
    chart.subscribeCrosshairMove(onCross);
    chartRef.current = chart;
    seriesRef.current = series;
    sma50Ref.current = sma50; sma200Ref.current = sma200;
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight || 400 });
        redrawOverlay();
      }
    });
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(redraw); } catch {}
      try { chart.unsubscribeCrosshairMove(onCross); } catch {}
      chart.remove();
      chartRef.current = null; seriesRef.current = null;
      sma50Ref.current = null; sma200Ref.current = null;
      priceLinesRef.current = []; drawingsRef.current = [];
    };
  }, [chartLib, addLevelAt, redrawOverlay, hitEndpoint]);

  // Fetch + render data on symbol change.
  useEffect(() => {
    if (!chartLib || !seriesRef.current) return;
    let cancelled = false;
    setLoading(true);
    loadMarketData(symbol).then((rows) => {
      if (cancelled || !seriesRef.current) return;
      const candles = rows.map((r) => ({ time: r.date, open: +r.open, high: +r.high, low: +r.low, close: +r.close }));
      dataRef.current = candles;
      seriesRef.current.setData(candles);
      applyMarkers();
      applyWindow(win);
      redrawLevels(symbol);
      redrawDrawings(symbol);
      const last = candles[candles.length - 1], prev = candles[candles.length - 2];
      setMeta(last ? { close: last.close, chg: prev ? ((last.close - prev.close) / prev.close) * 100 : 0, date: last.time } : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [symbol, chartLib, applyWindow, redrawLevels, redrawDrawings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { applyWindow(win); redrawOverlay(); }, [win, applyWindow, redrawOverlay]);
  useEffect(() => { updateSMAs(); }, [updateSMAs, meta]);
  useEffect(() => { applyMarkers(); }, [applyMarkers, meta]);

  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFull = () => {
    const el = wrapperRef.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const chg = meta?.chg ?? 0;
  const chgColor = chg > 0 ? 'text-dashboard-buy' : chg < 0 ? 'text-dashboard-sell' : 'text-dashboard-muted';
  const drawing = tool !== 'cursor';
  const active = drawing || hot;

  return (
    <div ref={wrapperRef} className={isFull ? 'fixed inset-0 z-50 flex flex-col bg-dashboard-bg p-4' : 'chart-container p-4'}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
            className="cursor-pointer rounded border border-dashboard-border bg-dashboard-card px-2 py-1 font-mono text-xs tracking-wider text-dashboard-text focus:border-dashboard-brand focus:outline-none">
            {(symbols.length ? symbols : [symbol]).map((s) => (
              <option key={s} value={s}>{SYMBOL_LABELS[s] ? `${s} · ${SYMBOL_LABELS[s]}` : s}</option>
            ))}
          </select>
          {meta && (
            <div className="font-mono text-xs">
              <span className="text-dashboard-text">{meta.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span className={`ml-2 ${chgColor}`}>{chg > 0 ? '+' : ''}{chg.toFixed(2)}%</span>
            </div>
          )}
          {loading && <span className="animate-pulse font-mono text-[10px] text-dashboard-muted">LOADING…</span>}
        </div>
        <div className="flex items-center gap-1">
          {!controlledWin && WINDOWS.map((w) => (
            <button key={w.label} onClick={() => setWin(w.label)}
              className={`rounded border px-2 py-1 font-mono text-[10px] tracking-wider ${win === w.label ? 'border-dashboard-brand bg-dashboard-brand/20 text-dashboard-brand' : 'border-dashboard-border text-dashboard-muted hover:text-dashboard-text'}`}>
              {w.label}
            </button>
          ))}
          <button onClick={() => setSma50On((v) => !v)} title="50-day moving average"
            className="rounded border border-dashboard-border px-2 py-1 font-mono text-[10px] tracking-wider text-dashboard-muted hover:text-dashboard-text"
            style={sma50On ? { color: '#5e9bff', borderColor: '#5e9bff88', background: '#5e9bff18' } : undefined}>
            MA50
          </button>
          <button onClick={() => setSma200On((v) => !v)} title="200-day moving average"
            className="rounded border border-dashboard-border px-2 py-1 font-mono text-[10px] tracking-wider text-dashboard-muted hover:text-dashboard-text"
            style={sma200On ? { color: '#f0a742', borderColor: '#f0a74288', background: '#f0a74218' } : undefined}>
            MA200
          </button>
          {history.length > 0 && (
            <button onClick={() => setSignalsOn((v) => !v)} title="Mark past fear (▲) and greed (▼) extremes on the chart"
              className="rounded border border-dashboard-border px-2 py-1 font-mono text-[10px] tracking-wider text-dashboard-muted hover:text-dashboard-text"
              style={signalsOn ? { color: '#8fe04f', borderColor: '#8fe04f88', background: '#8fe04f18' } : undefined}>
              ⚑ Signals
            </button>
          )}
          {drawCount > 0 && (
            <button onClick={clearAll} title="Clear all drawings for this symbol" className="rounded border border-dashboard-border px-2 py-1 font-mono text-[10px] text-dashboard-muted hover:text-dashboard-sell">
              ✕{drawCount}
            </button>
          )}
          <button onClick={toggleFull} title={isFull ? 'Exit fullscreen' : 'Fullscreen'} className="rounded border border-dashboard-border px-2 py-1 font-mono text-[10px] text-dashboard-muted hover:text-dashboard-text">
            {isFull ? '✕' : '⛶'}
          </button>
        </div>
      </div>

      <div className="flex gap-2" style={{ flex: isFull ? '1 1 auto' : 'none' }}>
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashboard-border bg-dashboard-card/60 p-1.5">
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.title} aria-pressed={tool === t.id}
              className={`flex h-8 w-8 items-center justify-center rounded-md border text-[15px] leading-none transition-colors ${tool === t.id ? 'border-dashboard-brand bg-dashboard-brand/15 text-dashboard-brand' : 'border-transparent text-dashboard-muted hover:bg-dashboard-elevated hover:text-dashboard-text'}`}>
              {t.glyph}
            </button>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: isFull ? '100%' : height }}>
          <div ref={containerRef} className="absolute inset-0" style={{ cursor: drawing ? 'crosshair' : 'default' }} />
          <canvas ref={overlayRef} onMouseDown={onOverlayDown} onMouseMove={onOverlayMove} onMouseUp={onOverlayUp} onMouseLeave={onOverlayUp}
            className="absolute inset-0 z-10"
            style={{ pointerEvents: active ? 'auto' : 'none', cursor: hot ? 'grab' : (drawing ? 'crosshair' : 'default') }} />
        </div>
      </div>

      {tool !== 'cursor' && (
        <div className="mt-2 font-mono text-[9px] tracking-wider text-dashboard-brand/80">
          {tool === 'trend' && 'TREND · click start point, then click end point'}
          {tool === 'ray' && 'RAY · click start, then a 2nd point — extends to the edge'}
          {tool === 'fib' && 'FIB · click the swing high, then the swing low'}
          {tool === 'horizontal' && 'LEVEL · click the chart to place a horizontal line'}
          {tool === 'text' && 'TEXT · click where you want a note, then type'}
          {tool === 'eraser' && 'ERASE · click a drawing to remove it'}
        </div>
      )}
    </div>
  );
}
