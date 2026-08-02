'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { loadDivergenceData } from '../lib/supabase';

// Dual-axis divergence view: two related series on independent scales so you can
// see when they pull apart. Separate feature from the candlestick price charts.
const PAIRS = [
  { id: 'spx-vix', label: 'SPX vs VIX', left: 'spx', right: 'vix', leftLabel: 'SPX', rightLabel: 'VIX', leftColor: '#f59e0b', rightColor: '#8b5cf6' },
  { id: 'spx-gold', label: 'SPX vs Gold', left: 'spx', right: 'gld', leftLabel: 'SPX', rightLabel: 'GLD', leftColor: '#f59e0b', rightColor: '#fbbf24' },
  { id: 'nvda-smh', label: 'NVDA vs SMH', left: 'nvda', right: 'smh', leftLabel: 'NVDA', rightLabel: 'SMH', leftColor: '#06b6d4', rightColor: '#10b981' },
];
const SYMBOLS = ['SPX', 'VIX', 'GLD', 'NVDA', 'SMH'];
const RANGES = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 1825 };

const startFor = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export default function DivergenceChart() {
  const [range, setRange] = useState('6M');
  const [pairId, setPairId] = useState('spx-vix');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDivergenceData(SYMBOLS, startFor(RANGES[range]))
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch((e) => console.error('divergence:', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const cfg = PAIRS.find((p) => p.id === pairId) || PAIRS[0];
  const shortDate = (d) => (d && d.includes('-') ? d.slice(5) : d);

  return (
    <div className="chart-container p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="text-[9px] tracking-[3px] text-dashboard-muted">DIVERGENCE</div>
          <div className="text-sm font-extrabold tracking-wider">{cfg.leftLabel} vs {cfg.rightLabel}</div>
        </div>
        <div className="flex items-center gap-3 text-[8px] text-dashboard-muted font-mono">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: cfg.leftColor }} />{cfg.leftLabel}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: cfg.rightColor }} />{cfg.rightLabel}</span>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex gap-1 justify-center mb-2.5">
        {Object.keys(RANGES).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`font-mono text-[9px] px-2 py-0.5 rounded-sm tracking-wider border ${range === r ? 'text-dashboard-accent border-dashboard-accent bg-dashboard-accent/10' : 'text-dashboard-muted border-dashboard-border'}`}>
            {r}
          </button>
        ))}
      </div>

      {mounted && !loading && data.length >= 2 ? (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: -8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#475569', fontFamily: 'monospace', fontSize: 8 }} stroke="#1e293b" tickLine={false}
              interval={Math.max(0, Math.ceil(data.length / 8) - 1)} minTickGap={20} />
            <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fill: cfg.leftColor, fontFamily: 'monospace', fontSize: 8 }} stroke="#1e293b" tickLine={false} width={42} />
            <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fill: cfg.rightColor, fontFamily: 'monospace', fontSize: 8 }} stroke="#1e293b" tickLine={false} width={38} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontFamily: 'monospace', fontSize: 10 }} labelStyle={{ color: '#64748b' }} />
            <Line yAxisId="left" type="monotone" dataKey={cfg.left} stroke={cfg.leftColor} strokeWidth={2} dot={false} name={cfg.leftLabel} isAnimationActive={false} />
            <Line yAxisId="right" type="monotone" dataKey={cfg.right} stroke={cfg.rightColor} strokeWidth={2} strokeDasharray="5 3" dot={false} name={cfg.rightLabel} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[240px] flex items-center justify-center text-[10px] text-dashboard-muted font-mono">
          {loading ? 'Loading…' : 'Not enough data for this range.'}
        </div>
      )}

      {/* Pair selector */}
      <div className="flex gap-1 justify-center mt-2">
        {PAIRS.map((p) => (
          <button key={p.id} onClick={() => setPairId(p.id)}
            className={`font-mono text-[9px] px-2.5 py-0.5 rounded-sm tracking-wider border ${pairId === p.id ? 'text-dashboard-text border-dashboard-border bg-dashboard-card' : 'text-dashboard-muted border-dashboard-border'}`}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
