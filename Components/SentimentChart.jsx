'use client';

import { useEffect, useRef, useState } from 'react';

export default function SentimentChart({ history }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [chartLib, setChartLib] = useState(null);

  useEffect(() => {
    import('lightweight-charts').then(mod => setChartLib(mod));
  }, []);

  useEffect(() => {
    if (!chartLib || !containerRef.current || !history.length) return;

    const { createChart, ColorType, LineStyle } = chartLib;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#0a1
