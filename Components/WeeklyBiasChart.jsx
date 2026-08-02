'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, ResponsiveContainer,
} from 'recharts';

// Rolling 5-day sentiment trend (this week's bias) from daily_readings.
// Single composite score per day: eod_score, falling back to live_score.
export default function WeeklyBiasChart({ history }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = (history || [])
    .map((h) => ({ date: h.date, score: Number(h.eod_score ?? h.live_score) }))
    .filter((d) => d.date && Number.isFinite(d.score))
    .slice(-5);
  const latest = data.length ? data[data.length - 1].score : 50;
  const dotColor = latest <= 35 ? '#22c55e' : latest >= 65 ? '#ef4444' : '#eab308';
  const shortDate = (d) => (d && d.includes('-') ? d.slice(5) : d);

  return (
    <div className="chart-container p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="text-[9px] tracking-[3px] text-dashboard-muted">ROLLING 5-DAY</div>
          <div className="text-sm font-extrabold tracking-wider">WEEKLY BIAS</div>
        </div>
        <div className="flex items-center gap-1.5 text-[8px] text-dashboard-muted font-mono">
          <span className="inline-block w-3 h-0.5" style={{ background: '#eab308' }} />
          5-DAY TREND
        </div>
      </div>

      {mounted && data.length >= 2 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <ReferenceArea y1={65} y2={100} fill="#ef4444" fillOpacity={0.07} />
            <ReferenceArea y1={0} y2={35} fill="#22c55e" fillOpacity={0.07} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#475569', fontFamily: 'monospace', fontSize: 9 }} stroke="#1e293b" tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontFamily: 'monospace', fontSize: 8 }} stroke="#1e293b" tickLine={false} width={28} />
            <ReferenceLine y={65} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
            <ReferenceLine y={50} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={35} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontFamily: 'monospace', fontSize: 10 }} />
            <Line type="monotone" dataKey="score" stroke="#eab308" strokeWidth={3} name="Sentiment"
              dot={{ fill: dotColor, r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-[10px] text-dashboard-muted font-mono">
          Need at least 2 recent readings to plot the week.
        </div>
      )}

      <div className="flex justify-between mt-2 text-[8px] font-mono">
        <span className="text-dashboard-buy">▲ BUY ZONE (≤35)</span>
        <span className="text-dashboard-sell">▼ SELL ZONE (≥65)</span>
      </div>
    </div>
  );
}
