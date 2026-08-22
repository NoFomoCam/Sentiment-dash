'use client';

import { useEffect, useRef, useState } from 'react';

export default function SentimentChart({ history, win = '6M' }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [chartLib, setChartLib] = useState(null);

  useEffect(() => {
    import('lightweight-charts').then(mod => setChartLib(mod));
  }, []);

  useEffect(() => {
    if (!chartLib || !containerRef.current) return;

    const { createChart, ColorType, LineStyle } = chartLib;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || containerRef.current.offsetWidth || (window.innerWidth - 32),
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#0b1018' },
        textColor: '#8497b3',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#18202f', style: LineStyle.Dotted },
        horzLines: { color: '#18202f', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#8497b3', labelBackgroundColor: '#22304a' },
        horzLine: { color: '#8497b3', labelBackgroundColor: '#22304a' },
      },
      rightPriceScale: {
        borderColor: '#22304a',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#22304a',
        timeVisible: false,
      },
      handleScroll: { vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, pinch: true, mouseWheel: true },
    });

    const sentimentSeries = chart.addLineSeries({
      color: '#f7b737',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Sentiment',
    });

    const buyZone = chart.addLineSeries({
      color: '#23d18b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
      crosshairMarkerVisible: false,
    });

    const sellZone = chart.addLineSeries({
      color: '#f64f68',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
      crosshairMarkerVisible: false,
    });

    // Single composite score: prefer eod_score (full 11 indicators), fall back
    // to live_score for older rows written before both were stored.
    const sentimentData = history
      .map(h => ({ time: h.date, value: h.eod_score ?? h.live_score }))
      .filter(d => d.time && d.value != null)
      .sort((a, b) => a.time.localeCompare(b.time));

    const convertedData = sentimentData.map(d => {
      if (d.time.includes('/')) {
        const parts = d.time.split('/');
        const yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        const mo = parts[0].padStart(2, '0');
        const dy = parts[1].padStart(2, '0');
        return { time: yr + '-' + mo + '-' + dy, value: d.value };
      }
      return d;
    });

    if (convertedData.length > 0) {
      sentimentSeries.setData(convertedData);
      const times = convertedData.map(d => d.time);
      buyZone.setData(times.map(t => ({ time: t, value: 35 })));
      sellZone.setData(times.map(t => ({ time: t, value: 65 })));
      const ts = chart.timeScale();
      if (!win || win === 'ALL') {
        ts.fitContent();
      } else {
        const daysMap = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
        const days = daysMap[win] ?? 180;
        const lastT = times[times.length - 1];
        const fromD = new Date(lastT);
        fromD.setDate(fromD.getDate() - days);
        try { ts.setVisibleRange({ from: fromD.toISOString().slice(0, 10), to: lastT }); }
        catch { ts.fitContent(); }
      }
    }

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartLib, history, win]);

  return (
    <div className="chart-container p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="text-[9px] tracking-[3px] text-dashboard-muted">SENTIMENT</div>
          <div className="text-sm font-extrabold tracking-wider">HISTORY</div>
        </div>
        <div className="flex items-center gap-3 text-[8px] text-dashboard-muted">
          <span>Scroll to zoom · Drag to pan</span>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ minHeight: 400 }} />
      <div className="flex justify-between mt-2 text-[8px] font-mono">
        <span className="text-dashboard-buy">▲ BUY ZONE (≤35)</span>
        <span className="text-dashboard-sell">▼ SELL ZONE (≥65)</span>
      </div>
    </div>
  );
}
