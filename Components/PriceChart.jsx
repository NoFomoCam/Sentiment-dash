'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadMarketData } from '../lib/supabase';

const WINDOWS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: null },
];

const levelsKey = (sym) => `sentiment_levels_${sym}`;
const loadLevels = (sym) => {
  try { return JSON.parse(localStorage.getItem(levelsKey(sym)) || '[]'); }
  catch { return []; }
};
const saveLevels = (sym, prices) => {
  try { localStorage.setItem(levelsKey(sym), JSON.stringify(prices)); } catch {}
};

export default function PriceChart({ symbols = [], defaultSymbol = 'VIX' }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const dataRef = useRef([]);
  const priceLinesRef = useRef([]); // [{ price, line }]
  const drawModeRef = useRef(false);
  const symbolRef = useRef(defaultSymbol);

  const [chartLib, setChartLib] = useState(null);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [win, setWin] = useState('6M');
  const [loading, setLoading] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [meta, setMeta] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [levelCount, setLevelCount] = useState(0);

  // Keep refs in sync so the (once-subscribed) click handler reads live values.
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);

  // Zoom the visible range to the selected window (client-side, no refetch).
  const applyWindow = useCallback((label) => {
    const chart = chartRef.current;
    const data = dataRef.current;
    if (!chart || data.length === 0) return;
    const ts = chart.timeScale();
    if (label === 'ALL') { ts.fitContent(); return; }
    const days = WINDOWS.find(w => w.label === label)?.days ?? 180;
    const lastTime = data[data.length - 1].time;
    const fromDate = new Date(lastTime);
    fromDate.setDate(fromDate.getDate() - days);
    const from = fromDate.toISOString().slice(0, 10);
    try { ts.setVisibleRange({ from, to: lastTime }); }
    catch { ts.fitContent(); }
  }, []);

  // Redraw the persisted horizontal levels for a symbol.
  const redrawLevels = useCallback((sym) => {
    const series = seriesRef.current;
    if (!series) return;
    priceLinesRef.current.forEach(pl => { try { series.removePriceLine(pl.line); } catch {} });
    priceLinesRef.current = loadLevels(sym).map(price => ({
      price,
      line: series.createPriceLine({
        price, color: '#38bdf8', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: '',
      }),
    }));
    setLevelCount(priceLinesRef.current.length);
  }, []);

  // Click near an existing level removes it; otherwise add a level at that price.
  const toggleLevelAt = useCallback((y) => {
    const series = seriesRef.current;
    const sym = symbolRef.current;
    if (!series) return;
    const price = series.coordinateToPrice(y);
    if (price == null) return;

    const hit = priceLinesRef.current.find(pl => {
      const c = series.priceToCoordinate(pl.price);
      return c != null && Math.abs(c - y) <= 6;
    });
    if (hit) {
      try { series.removePriceLine(hit.line); } catch {}
      priceLinesRef.current = priceLinesRef.current.filter(x => x !== hit);
    } else {
      const rounded = Number(price.toFixed(2));
      priceLinesRef.current.push({
        price: rounded,
        line: series.createPriceLine({
          price: rounded, color: '#38bdf8', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: '',
        }),
      });
    }
    saveLevels(sym, priceLinesRef.current.map(x => x.price));
    setLevelCount(priceLinesRef.current.length);
  }, []);

  const clearLevels = useCallback(() => {
    const series = seriesRef.current;
    if (series) priceLinesRef.current.forEach(pl => { try { series.removePriceLine(pl.line); } catch {} });
    priceLinesRef.current = [];
    saveLevels(symbolRef.current, []);
    setLevelCount(0);
  }, []);

  // Load the charting library on mount.
  useEffect(() => {
    import('lightweight-charts').then(setChartLib);
  }, []);

  // Create the chart once (when the lib is ready).
  useEffect(() => {
    if (!chartLib || !containerRef.current) return;
    const { createChart, ColorType, CrosshairMode } = chartLib;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0f1a' },
        textColor: '#64748b',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#141c2e' },
        horzLines: { color: '#141c2e' },
      },
      crosshair: { mode: CrosshairMode ? CrosshairMode.Normal : 0 },
      rightPriceScale: { borderColor: '#1e293b', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: '#1e293b', timeVisible: false, rightOffset: 4 },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      borderVisible: false,
    });

    chart.subscribeClick(param => {
      if (!drawModeRef.current || !param.point) return;
      toggleLevelAt(param.point.y);
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 400,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, [chartLib, toggleLevelAt]);

  // Fetch + render data whenever the symbol changes (chart must exist first).
  useEffect(() => {
    if (!chartLib || !seriesRef.current) return;
    let cancelled = false;
    setLoading(true);
    loadMarketData(symbol).then(rows => {
      if (cancelled || !seriesRef.current) return;
      const candles = rows.map(r => ({
        time: r.date,
        open: +r.open, high: +r.high, low: +r.low, close: +r.close,
      }));
      dataRef.current = candles;
      seriesRef.current.setData(candles);
      applyWindow(win);
      redrawLevels(symbol);
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      setMeta(last ? {
        close: last.close,
        chg: prev ? ((last.close - prev.close) / prev.close) * 100 : 0,
        date: last.time,
      } : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [symbol, chartLib, applyWindow, redrawLevels]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-zoom when the window selection changes.
  useEffect(() => { applyWindow(win); }, [win, applyWindow]);

  // Track native fullscreen state.
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

  return (
    <div
      ref={wrapperRef}
      className={isFull
        ? 'fixed inset-0 z-50 bg-dashboard-bg p-4 flex flex-col'
        : 'chart-container p-4'}
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="bg-dashboard-card border border-dashboard-border text-dashboard-text
                       font-mono text-xs tracking-wider rounded px-2 py-1 cursor-pointer
                       focus:outline-none focus:border-dashboard-accent"
          >
            {(symbols.length ? symbols : [symbol]).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {meta && (
            <div className="font-mono text-xs">
              <span className="text-dashboard-text">{meta.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span className={`ml-2 ${chgColor}`}>
                {chg > 0 ? '+' : ''}{chg.toFixed(2)}%
              </span>
            </div>
          )}
          {loading && <span className="text-[10px] text-dashboard-muted font-mono animate-pulse">LOADING…</span>}
        </div>

        <div className="flex items-center gap-1">
          {WINDOWS.map(w => (
            <button
              key={w.label}
              onClick={() => setWin(w.label)}
              className={`px-2 py-1 font-mono text-[10px] tracking-wider rounded border cursor-pointer
                ${win === w.label
                  ? 'bg-dashboard-accent/20 border-dashboard-accent text-dashboard-accent'
                  : 'border-dashboard-border text-dashboard-muted hover:text-dashboard-text'}`}
            >
              {w.label}
            </button>
          ))}
          <button
            onClick={() => setDrawMode(d => !d)}
            title="Draw horizontal levels — click chart to add, click a line to remove"
            className={`ml-1 px-2 py-1 font-mono text-[10px] tracking-wider rounded border cursor-pointer
              ${drawMode
                ? 'bg-sky-500/20 border-sky-400 text-sky-400'
                : 'border-dashboard-border text-dashboard-muted hover:text-dashboard-text'}`}
          >
            ✎ LEVELS
          </button>
          {levelCount > 0 && (
            <button
              onClick={clearLevels}
              title="Clear all levels for this symbol"
              className="px-2 py-1 font-mono text-[10px] rounded border border-dashboard-border
                         text-dashboard-muted hover:text-dashboard-sell cursor-pointer"
            >
              ✕{levelCount}
            </button>
          )}
          <button
            onClick={toggleFull}
            title={isFull ? 'Exit fullscreen' : 'Fullscreen'}
            className="px-2 py-1 font-mono text-[10px] rounded border border-dashboard-border
                       text-dashboard-muted hover:text-dashboard-text cursor-pointer"
          >
            {isFull ? '✕' : '⛶'}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="w-full"
        style={{
          height: isFull ? '100%' : 400,
          flex: isFull ? '1 1 auto' : 'none',
          cursor: drawMode ? 'crosshair' : 'default',
        }}
      />
      {drawMode && (
        <div className="mt-2 text-[9px] font-mono text-sky-400/80 tracking-wider">
          LEVELS MODE · click to add a line · click a line to remove
        </div>
      )}
    </div>
  );
}
