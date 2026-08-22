'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadMarketData, SYMBOL_LABELS, CLOSE_ONLY } from '../lib/supabase';

const WINDOWS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: null },
];

const DRAW_COLOR = '#8ea3c6';

// Per-symbol persistence (localStorage). Per-user isolation arrives with auth (Phase 3).
const levelsKey = (sym) => `sentiment_levels_${sym}`;
const trendKey = (sym) => `sentiment_trends_${sym}`;
const loadJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const saveJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Tool rail definition.
const TOOLS = [
  { id: 'cursor', glyph: '↖', title: 'Cursor — pan & zoom' },
  { id: 'trend', glyph: '╱', title: 'Trend line — click start, click end' },
  { id: 'horizontal', glyph: '─', title: 'Horizontal level — click to place' },
  { id: 'eraser', glyph: '⌫', title: 'Erase — click a drawing to remove' },
];

// Distance from point p to segment ab (for eraser hit-testing).
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export default function PriceChart({ symbols = [], defaultSymbol = 'VIX', win: controlledWin = null, height = 400 }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);        // active series (candles or line)
  const candleSeriesRef = useRef(null);
  const lineSeriesRef = useRef(null);
  const dataRef = useRef([]);
  const priceLinesRef = useRef([]);   // [{ price, line }]
  const trendsRef = useRef([]);       // [[{logical, price}, {logical, price}], ...]
  const pendingRef = useRef(null);    // first point of an in-progress trend line
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
  const [drawCount, setDrawCount] = useState(0); // levels + trends, for the clear affordance

  useEffect(() => { toolRef.current = tool; pendingRef.current = null; redrawOverlay(); }, [tool]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);

  const refreshCount = useCallback(() => {
    setDrawCount(priceLinesRef.current.length + trendsRef.current.length);
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

  // ---- Trend lines (canvas overlay, stored in logical/price data coords) ----
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
    const toXY = (p) => {
      const x = ts.logicalToCoordinate(p.logical);
      const yy = series.priceToCoordinate(p.price);
      return (x == null || yy == null) ? null : [x, yy];
    };
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = DRAW_COLOR;
    ctx.fillStyle = DRAW_COLOR;
    for (const seg of trendsRef.current) {
      const a = toXY(seg[0]), b = toXY(seg[1]);
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      for (const pt of [a, b]) { ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // in-progress preview
    if (pendingRef.current && preview) {
      const a = toXY(pendingRef.current);
      if (a) {
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(preview[0], preview[1]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(a[0], a[1], 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }, []);

  const redrawTrends = useCallback((sym) => {
    trendsRef.current = loadJson(trendKey(sym));
    pendingRef.current = null;
    redrawOverlay();
    refreshCount();
  }, [redrawOverlay, refreshCount]);

  const localXY = (e) => {
    const r = containerRef.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const onOverlayDown = useCallback((e) => {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return;
    const [x, y] = localXY(e);
    const t = toolRef.current;

    if (t === 'eraser') {
      // trend lines first
      const ts = chart.timeScale();
      const hitIdx = trendsRef.current.findIndex((seg) => {
        const ax = ts.logicalToCoordinate(seg[0].logical), ay = series.priceToCoordinate(seg[0].price);
        const bx = ts.logicalToCoordinate(seg[1].logical), by = series.priceToCoordinate(seg[1].price);
        return ax != null && ay != null && bx != null && by != null && distToSeg(x, y, ax, ay, bx, by) <= 6;
      });
      if (hitIdx >= 0) {
        trendsRef.current.splice(hitIdx, 1);
        saveJson(trendKey(symbolRef.current), trendsRef.current);
        redrawOverlay(); refreshCount();
        return;
      }
      // then horizontal levels
      const pl = priceLinesRef.current.find((p) => {
        const c = series.priceToCoordinate(p.price);
        return c != null && Math.abs(c - y) <= 6;
      });
      if (pl) {
        try { series.removePriceLine(pl.line); } catch {}
        priceLinesRef.current = priceLinesRef.current.filter((p) => p !== pl);
        saveJson(levelsKey(symbolRef.current), priceLinesRef.current.map((p) => p.price));
        refreshCount();
      }
      return;
    }

    if (t === 'trend') {
      const logical = chart.timeScale().coordinateToLogical(x);
      const price = series.coordinateToPrice(y);
      if (logical == null || price == null) return;
      if (!pendingRef.current) {
        pendingRef.current = { logical, price };
      } else {
        trendsRef.current.push([pendingRef.current, { logical, price }]);
        pendingRef.current = null;
        saveJson(trendKey(symbolRef.current), trendsRef.current);
        refreshCount();
      }
      redrawOverlay();
    }
  }, [redrawOverlay, refreshCount]);

  const onOverlayMove = useCallback((e) => {
    if (toolRef.current === 'trend' && pendingRef.current) redrawOverlay(localXY(e));
  }, [redrawOverlay]);

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

  const clearAll = useCallback(() => {
    const series = seriesRef.current;
    if (series) priceLinesRef.current.forEach((pl) => { try { series.removePriceLine(pl.line); } catch {} });
    priceLinesRef.current = [];
    trendsRef.current = [];
    pendingRef.current = null;
    saveJson(levelsKey(symbolRef.current), []);
    saveJson(trendKey(symbolRef.current), []);
    redrawOverlay();
    refreshCount();
  }, [redrawOverlay, refreshCount]);

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

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#23d18b', downColor: '#f64f68', wickUpColor: '#23d18b', wickDownColor: '#f64f68', borderVisible: false,
    });
    const lineSeries = chart.addLineSeries({ color: '#8ea3c6', lineWidth: 2, lastValueVisible: true, priceLineVisible: false });

    // Native click adds a horizontal level (only in horizontal mode; canvas is
    // pointer-events:none then so the chart receives the click).
    chart.subscribeClick((param) => {
      if (toolRef.current === 'horizontal' && param.point) addLevelAt(param.point.y);
    });

    const redraw = () => redrawOverlay();
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    lineSeriesRef.current = lineSeries;
    seriesRef.current = candleSeries;

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
      chart.remove();
      chartRef.current = null; seriesRef.current = null;
      candleSeriesRef.current = null; lineSeriesRef.current = null;
      priceLinesRef.current = []; trendsRef.current = [];
    };
  }, [chartLib, addLevelAt, redrawOverlay]);

  // Fetch + render data on symbol change.
  useEffect(() => {
    if (!chartLib || !seriesRef.current) return;
    let cancelled = false;
    setLoading(true);
    loadMarketData(symbol).then((rows) => {
      if (cancelled || !candleSeriesRef.current) return;
      if (CLOSE_ONLY.has(symbol)) {
        const pts = rows.map((r) => ({ time: r.date, value: +r.close }));
        lineSeriesRef.current.setData(pts);
        candleSeriesRef.current.setData([]);
        dataRef.current = pts;
        seriesRef.current = lineSeriesRef.current;
      } else {
        const candles = rows.map((r) => ({ time: r.date, open: +r.open, high: +r.high, low: +r.low, close: +r.close }));
        candleSeriesRef.current.setData(candles);
        lineSeriesRef.current.setData([]);
        dataRef.current = candles;
        seriesRef.current = candleSeriesRef.current;
      }
      applyWindow(win);
      redrawLevels(symbol);
      redrawTrends(symbol);
      const last = rows[rows.length - 1], prev = rows[rows.length - 2];
      setMeta(last ? { close: +last.close, chg: prev ? ((+last.close - +prev.close) / +prev.close) * 100 : 0, date: last.date } : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [symbol, chartLib, applyWindow, redrawLevels, redrawTrends]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { applyWindow(win); redrawOverlay(); }, [win, applyWindow, redrawOverlay]);

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
  const drawing = tool === 'trend' || tool === 'eraser';

  return (
    <div ref={wrapperRef} className={isFull ? 'fixed inset-0 z-50 flex flex-col bg-dashboard-bg p-4' : 'chart-container p-4'}>
      {/* Top controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="cursor-pointer rounded border border-dashboard-border bg-dashboard-card px-2 py-1 font-mono text-xs tracking-wider text-dashboard-text focus:border-dashboard-brand focus:outline-none"
          >
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
            <button
              key={w.label}
              onClick={() => setWin(w.label)}
              className={`rounded border px-2 py-1 font-mono text-[10px] tracking-wider ${win === w.label ? 'border-dashboard-brand bg-dashboard-brand/20 text-dashboard-brand' : 'border-dashboard-border text-dashboard-muted hover:text-dashboard-text'}`}
            >
              {w.label}
            </button>
          ))}
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

      {/* Tool rail + chart */}
      <div className="flex gap-2" style={{ flex: isFull ? '1 1 auto' : 'none' }}>
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashboard-border bg-dashboard-card/60 p-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.title}
              aria-pressed={tool === t.id}
              className={`flex h-8 w-8 items-center justify-center rounded-md border text-[15px] leading-none transition-colors ${tool === t.id ? 'border-dashboard-brand bg-dashboard-brand/15 text-dashboard-brand' : 'border-transparent text-dashboard-muted hover:bg-dashboard-elevated hover:text-dashboard-text'}`}
            >
              {t.glyph}
            </button>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: isFull ? '100%' : height }}>
          <div ref={containerRef} className="absolute inset-0" style={{ cursor: drawing ? 'crosshair' : 'default' }} />
          <canvas
            ref={overlayRef}
            onMouseDown={onOverlayDown}
            onMouseMove={onOverlayMove}
            className="absolute inset-0 z-10"
            style={{ pointerEvents: drawing ? 'auto' : 'none', cursor: drawing ? 'crosshair' : 'default' }}
          />
        </div>
      </div>

      {tool !== 'cursor' && (
        <div className="mt-2 font-mono text-[9px] tracking-wider text-dashboard-brand/80">
          {tool === 'trend' && 'TREND · click start point, then click end point'}
          {tool === 'horizontal' && 'LEVEL · click the chart to place a horizontal line'}
          {tool === 'eraser' && 'ERASE · click a trend line or level to remove it'}
        </div>
      )}
    </div>
  );
}
