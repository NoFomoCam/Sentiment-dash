'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, ResponsiveContainer,
} from 'recharts';

// Sentiment bias trend over a selectable window, with contrarian buy/sell zones.
// One composite score per day from daily_readings: eod_score, else live_score.
const WINDOWS = [['2W', 10], ['1M', 22], ['3M', 66], ['6M', 132], ['1Y', 252]];

export default function WeeklyBiasChart({ history }) {
  const [mounted, setMounted] = useState(false);
  const [win, setWin] = useState('1M');
  useEffect(() => setMounted(true), []);

  const n = WINDOWS.find(([l]) => l === win)?.[1] ?? 22;
  const all = (history || [])
    .map((h) => ({ date: h.date, score: Number(h.eod_score ?? h.live_score) }))
    .filter((d) => d.date && Number.isFinite(d.score));
  const data = all.slice(-n);
  const latest = data.length ? data[data.length - 1].score : 50;
  const first = data.length ? data[0].score : 50;
  const delta = Math.round(latest - first);
  const dotColor = latest <= 35 ? '#22e7a7' : latest >= 65 ? '#ff4a6e' : '#ffc93e';
  const showDots = data.length <= 32;
  const shortDate = (d) => (d && d.includes('-') ? d.slice(5) : d);

  return (
    <div className="chart-container p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="eyebrow">Sentiment bias</div>
          <div className="text-sm font-extrabold tracking-wider text-dashboard-text">
            BIAS TREND
            {data.length >= 2 && (
              <span
                className="ml-2 font-mono text-[11px] font-semibold"
                style={{ color: delta > 0 ? '#ff8a5c' : delta < 0 ? '#22e7a7' : '#8497b3' }}
              >
                {delta > 0 ? '+' : ''}{delta} over {win}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {WINDOWS.map(([label]) => (
            <button
              key={label}
              onClick={() => setWin(label)}
              className={`rounded border px-2 py-1 font-mono text-[10px] tracking-wider ${
                win === label
                  ? 'border-dashboard-brand bg-dashboard-brand/20 text-dashboard-brand'
                  : 'border-dashboard-border text-dashboard-muted hover:text-dashboard-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mounted && data.length >= 2 ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 16, left: -12, bottom: 5 }}>
            <ReferenceArea y1={65} y2={100} fill="#ff4a6e" fillOpacity={0.08} />
            <ReferenceArea y1={0} y2={35} fill="#22e7a7" fillOpacity={0.08} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2334" opacity={0.7} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#7e93ba', fontFamily: 'monospace', fontSize: 9 }} stroke="#22304a" tickLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis domain={[0, 100]} ticks={[0, 35, 50, 65, 100]} tick={{ fill: '#7e93ba', fontFamily: 'monospace', fontSize: 8 }} stroke="#22304a" tickLine={false} width={28} />
            <ReferenceLine y={65} stroke="#ff4a6e" strokeDasharray="4 4" strokeOpacity={0.4} />
            <ReferenceLine y={50} stroke="#ffc93e" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={35} stroke="#22e7a7" strokeDasharray="4 4" strokeOpacity={0.4} />
            <Tooltip contentStyle={{ background: '#10151f', border: '1px solid #22304a', borderRadius: 8, fontFamily: 'monospace', fontSize: 10 }} labelStyle={{ color: '#c9d4e8' }} />
            <Line type="monotone" dataKey="score" stroke="#ffc93e" strokeWidth={2.5} name="Sentiment"
              dot={showDots ? { fill: dotColor, r: 3.5 } : false} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center font-mono text-[10px] text-dashboard-muted">
          Not enough readings in this window.
        </div>
      )}

      <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-[9px]">
        <span className="text-dashboard-buy">▲ BUY ZONE (≤35)</span>
        <span className="text-dashboard-faint">higher = greed · lower = fear</span>
        <span className="text-dashboard-sell">▼ SELL ZONE (≥65)</span>
      </div>
    </div>
  );
}
