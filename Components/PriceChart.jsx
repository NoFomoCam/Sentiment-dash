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

export default function PriceChart({ symbols = [], defaultSymbol = 'VIX' }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const dataRef = useRef([]);

  const [chartLib, setChartLib] = useState(null);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [win, setWin] = useState('6M');
  const [loading, setLoading] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [meta, setMeta] = useState(null);

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
    try {
      ts.setVisibleRange({ from, to: lastTime });
    } catch {
      ts.fitContent();
    }
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
    };
  }, [chartLib]);

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
  }, [symbol, chartLib, applyWindow]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onClick={toggleFull}
            title={isFull ? 'Exit fullscreen' : 'Fullscreen'}
            className="ml-1 px-2 py-1 font-mono text-[10px] rounded border border-dashboard-border
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
        style={{ height: isFull ? '100%' : 400, flex: isFull ? '1 1 auto' : 'none' }}
      />
    </div>
  );
}
