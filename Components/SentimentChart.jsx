'use client';

import { useEffect, useRef, useState } from 'react';

export default function SentimentChart({ history }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [chartLib, setChartLib] = useState(null);

  // Dynamically import lightweight-charts (client-side only)
  useEffect(() => {
    import('lightweight-charts').then(mod => setChartLib(mod));
  }, []);

  useEffect(() => {
    if (!chartLib || !containerRef.current || !history.length) return;

    const { createChart, ColorType, LineStyle } = chartLib;
if (!chartLib || !containerRef.current || !history.length) return;

    // Clear previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#0a1628' },
        textColor: '#475569',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#1e293b', style: LineStyle.Dotted },
        horzLines: { color: '#1e293b', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: 0, // Normal crosshair
        vertLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: false,
      },
      handleScroll: { vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, pinch: true, mouseWheel: true },
    });

    // Sentiment score line
    const sentimentSeries = chart.addLineSeries({
      color: '#eab308',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Sentiment',
    });

    // Buy zone (0-35)
    const buyZone = chart.addLineSeries({
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
      crosshairMarkerVisible: false,
    });

    // Sell zone (65-100)  
    const sellZone = chart.addLineSeries({
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
      crosshairMarkerVisible: false,
    });

    // Format history data for lightweight-charts (needs { time, value } format)
    const sentimentData = history
      .filter(h => h.date && h.live_score != null)
      .map(h => ({
        time: h.date, // YYYY-MM-DD format from Supabase
        value: h.live_score,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    // If history uses the old M/D/YY format, convert
    const convertedData = sentimentData.map(d => {
      if (d.time.includes('/')) {
        const parts = d.time.split('/');
        const yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        const mo = parts[0].padStart(2, '0');
        const dy = parts[1].padStart(2, '0');
        return { time: `${yr}-${mo}-${dy}`, value: d.value };
      }
      return d;
    });

    if (convertedData.length > 0) {
      sentimentSeries.setData(convertedData);

      // Reference lines
      const times = convertedData.map(d => d.time);
      buyZone.setData(times.map(t => ({ time: t, value: 35 })));
      sellZone.setData(times.map(t => ({ time: t, value: 65 })));

      chart.timeScale().fitContent();
    }

    chartRef.current = chart;

    // Resize handler
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
  }, [chartLib, history]);

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
