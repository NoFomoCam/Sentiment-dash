'use client';

import { useState, useEffect } from 'react';
import { saveInputValues, loadInputValues } from '../lib/supabase';

const FIELDS = [
  { key: 'vix', label: 'VIX (30-day)', placeholder: '21.50' },
  { key: 'vix9d', label: 'VIX9D / VXST', placeholder: '20.80', tip: 'TradingView: CBOE:VXST' },
  { key: 'vix3m', label: 'VIX3M', placeholder: '18.20', tip: 'TradingView: CBOE:VIX3M' },
  { key: 'dxy', label: 'DXY', placeholder: '100.07' },
  { key: 'spy', label: 'SPY', placeholder: '735.00' },
  { key: 'spx', label: 'SPX (S&P 500)', placeholder: '7355.00' },
  { key: 'nyad', label: 'NYSE A/D', placeholder: '-200', tip: 'TradingView: $NYAD daily diff' },
  { key: 'fear_greed', label: 'Fear & Greed (0-100)', placeholder: '44' },
  { key: 'pcr', label: 'Put/Call Ratio', placeholder: '0.85' },
  { key: 'nvda', label: 'NVDA', placeholder: '208.00' },
  { key: 'smh', label: 'SMH', placeholder: '591.00' },
  { key: 'rsp', label: 'RSP (equal-wt)', placeholder: '209.00' },
  { key: 'gld', label: 'GLD (gold ETF)', placeholder: '390.00' },
  { key: 'hyg', label: 'HYG', placeholder: '79.00' },
  { key: 'lqd', label: 'LQD', placeholder: '108.00' },
];

export default function ManualInput({ current, onUpdate, onClose }) {
  const [curr, setCurr] = useState({});
  const [prev, setPrev] = useState({});
  const [loading, setLoading] = useState(true);

  // Load from Supabase first (persistent across sessions), fallback to current props
  useEffect(() => {
    async function load() {
      let loaded = false;
      try {
        const saved = await loadInputValues('default');
        if (saved?.curr_values && Object.keys(saved.curr_values).length > 2) {
          setCurr(saved.curr_values);
          if (saved.prev_values) setPrev(saved.prev_values);
          loaded = true;
        }
      } catch (e) { console.error('Load inputs error:', e); }

      if (!loaded) {
        const ic = {}, ip = {};
        FIELDS.forEach(({ key }) => {
          if (current[key] != null) ic[key] = String(current[key]);
          if (current[`${key}_prev`] != null) ip[key] = String(current[`${key}_prev`]);
        });
        setCurr(ic);
        setPrev(ip);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleApply() {
    // Build update object matching FALLBACK structure
    const updated = { ...current };
    FIELDS.forEach(({ key }) => {
      if (curr[key] !== undefined && curr[key] !== '') updated[key] = Number(curr[key]);
      if (prev[key] !== undefined && prev[key] !== '') updated[`${key}_prev`] = Number(prev[key]);
    });
    updated.last_updated = new Date().toLocaleString();

    // Save to Supabase (persistent — survives code updates!)
    await saveInputValues('default', curr, prev).catch(console.error);

    onUpdate(updated);
    onClose();
  }

  if (loading) return <div className="text-dashboard-muted text-xs p-4">Loading saved values...</div>;

  return (
    <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-[9px] tracking-[2px] text-dashboard-muted">EOD INPUT</div>
          <div className="text-lg font-extrabold">UPDATE VALUES</div>
        </div>
        <button onClick={onClose}
          className="px-3 py-1 border border-dashboard-border text-dashboard-muted text-xs rounded cursor-pointer">
          ✕ CANCEL
        </button>
      </div>

      <p className="text-[10px] text-dashboard-muted mb-4">
        Enter today's close <span className="text-dashboard-buy">Current</span> and yesterday's
        close <span className="text-dashboard-muted">Prev Close</span>. Leave blank to keep existing.
      </p>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 mb-2">
        <div></div>
        <div className="text-[9px] tracking-wider text-dashboard-buy text-center font-bold">TODAY CLOSE</div>
        <div className="text-[9px] tracking-wider text-dashboard-muted text-center">PREV CLOSE</div>
      </div>

      {/* Input rows */}
      <div className="space-y-2">
        {FIELDS.map(({ key, label, placeholder, tip }) => (
          <div key={key} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
            <div className="text-[10px] text-dashboard-text">
              {label}
              {tip && <div className="text-[8px] text-dashboard-muted">{tip}</div>}
            </div>
            <input
              type="number" step="0.01"
              placeholder={`e.g. ${placeholder}`}
              value={curr[key] || ''}
              onChange={e => setCurr(p => ({ ...p, [key]: e.target.value }))}
              className="bg-dashboard-bg border border-dashboard-buy/30 text-dashboard-text 
                         font-mono text-xs p-2 rounded w-full outline-none focus:border-dashboard-buy"
            />
            <input
              type="number" step="0.01"
              placeholder={`e.g. ${placeholder}`}
              value={prev[key] || ''}
              onChange={e => setPrev(p => ({ ...p, [key]: e.target.value }))}
              className="bg-dashboard-bg border border-dashboard-border text-dashboard-text 
                         font-mono text-xs p-2 rounded w-full outline-none focus:border-dashboard-muted"
            />
          </div>
        ))}
      </div>

      {/* Apply button */}
      <button onClick={handleApply}
        className="w-full mt-4 py-3 bg-dashboard-buy/20 border border-dashboard-buy 
                   text-dashboard-buy font-mono text-sm tracking-wider rounded cursor-pointer
                   hover:bg-dashboard-buy/30 active:bg-dashboard-buy/40">
        ✓ APPLY & RECALCULATE
      </button>
    </div>
  );
}
