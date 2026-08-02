'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadMarketFreshness } from '../../lib/supabase';

// The 15 series that feed the 11 scoring indicators, with their auto-source and
// scoring role. Order roughly follows the indicator breakdown on the dashboard.
const SERIES = [
  { sym: 'VIX', source: 'Yahoo', role: 'VIX' },
  { sym: 'VSTN', source: 'CBOE', role: 'Short-term vol (9D slot)' },
  { sym: 'VIX3M', source: 'CBOE', role: 'VIX term structure' },
  { sym: 'DXY', source: 'Yahoo', role: 'Dollar (DXY)' },
  { sym: 'SPX', source: 'Yahoo', role: 'S&P 500 index' },
  { sym: 'SPY', source: 'Yahoo', role: 'S&P 500 ETF' },
  { sym: 'RSP', source: 'Yahoo', role: 'Equal-weight breadth' },
  { sym: 'NVDA', source: 'Yahoo', role: 'NVDA (leadership)' },
  { sym: 'SMH', source: 'Yahoo', role: 'Semiconductors' },
  { sym: 'GLD', source: 'Yahoo', role: 'Gold (SPX/Gold)' },
  { sym: 'HYG', source: 'Yahoo', role: 'High-yield credit' },
  { sym: 'LQD', source: 'Yahoo', role: 'IG credit (HYG/LQD)' },
  { sym: 'ADD', source: 'WSJ', role: 'NYSE advance/decline' },
  { sym: 'FG', source: 'CNN', role: 'Fear & Greed' },
  { sym: 'PCR', source: 'CNN', role: 'Put/Call ratio' },
];

const SOURCE_TAG = {
  Yahoo: 'text-dashboard-buy border-dashboard-buy/40 bg-dashboard-buy/10',
  CBOE: 'text-dashboard-accent border-dashboard-accent/40 bg-dashboard-accent/10',
  WSJ: 'text-dashboard-caution border-dashboard-caution/40 bg-dashboard-caution/10',
  CNN: 'text-sky-400 border-sky-400/40 bg-sky-400/10',
};

// Trading days between a data date and today (weekends excluded). Data refreshes
// each weekday after the US close, so a healthy series is <=1 trading day behind.
function tradingDaysBehind(latest) {
  if (!latest) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${latest}T00:00:00`);
  if (d >= today) return 0;
  let count = 0;
  const cur = new Date(d);
  cur.setDate(cur.getDate() + 1);
  while (cur <= today) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function health(behind) {
  if (behind === Infinity) return { dot: 'bg-dashboard-sell', label: 'NO DATA', text: 'text-dashboard-sell' };
  if (behind <= 1) return { dot: 'bg-dashboard-buy', label: 'FRESH', text: 'text-dashboard-buy' };
  if (behind <= 2) return { dot: 'bg-dashboard-caution', label: 'LAGGING', text: 'text-dashboard-caution' };
  return { dot: 'bg-dashboard-sell', label: 'STALE', text: 'text-dashboard-sell' };
}

const SECRET_KEY = 'cron_secret';

export default function StatusPage() {
  const [rows, setRows] = useState(null);
  const [secret, setSecret] = useState('');
  const [dry, setDry] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const fresh = await loadMarketFreshness(SERIES.map((s) => s.sym));
      const bySym = Object.fromEntries(fresh.map((f) => [f.symbol, f]));
      setRows(SERIES.map((s) => ({ ...s, ...bySym[s.sym] })));
    } catch (e) {
      setError(String(e));
      setRows([]);
    }
  }

  useEffect(() => {
    setSecret(localStorage.getItem(SECRET_KEY) || '');
    load();
  }, []);

  async function runRefresh() {
    setRunning(true);
    setError('');
    setResult(null);
    localStorage.setItem(SECRET_KEY, secret);
    try {
      const res = await fetch(`/api/cron/refresh${dry ? '?dry=1' : ''}`, {
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
      } else {
        setResult(json);
        if (!dry) await load(); // real write — refresh the freshness table
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  const freshCount = rows ? rows.filter((r) => tradingDaysBehind(r.latest) <= 1).length : 0;
  const overall = rows && rows.length
    ? freshCount === rows.length
      ? { dot: 'bg-dashboard-buy', label: 'ALL SYSTEMS FRESH', text: 'text-dashboard-buy' }
      : freshCount >= rows.length - 2
        ? { dot: 'bg-dashboard-caution', label: 'MINOR LAG', text: 'text-dashboard-caution' }
        : { dot: 'bg-dashboard-sell', label: 'ATTENTION NEEDED', text: 'text-dashboard-sell' }
    : null;

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="dashboard-header mb-6">
        <Link href="/" className="text-[9px] tracking-[3px] text-dashboard-muted hover:text-dashboard-text">
          ← MARKET SENTIMENT CONSOLE
        </Link>
        <h1 className="text-2xl font-extrabold tracking-wider mt-1">DATA PIPELINE STATUS</h1>
        <div className="mt-1 text-[9px] font-mono tracking-wider text-dashboard-muted">
          15 SERIES · 4 FREE SOURCES · AUTO-REFRESH EACH WEEKDAY AFTER U.S. CLOSE
        </div>
      </div>

      {/* Overall health */}
      {overall && (
        <div className="chart-container p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${overall.dot} animate-pulse`} />
            <span className={`font-mono text-sm tracking-wider ${overall.text}`}>{overall.label}</span>
          </div>
          <span className="font-mono text-[11px] text-dashboard-muted tracking-wider">
            {freshCount}/{rows.length} FRESH
          </span>
        </div>
      )}

      {/* Series table */}
      <div className="chart-container overflow-x-auto mb-6">
        <table className="w-full text-left font-mono text-[11px] min-w-[560px]">
          <thead>
            <tr className="text-dashboard-muted text-[9px] tracking-wider border-b border-dashboard-border">
              <th className="px-3 py-2">SERIES</th>
              <th className="px-3 py-2">SOURCE</th>
              <th className="px-3 py-2">ROLE</th>
              <th className="px-3 py-2">LAST DATE</th>
              <th className="px-3 py-2 text-right">LAST VALUE</th>
              <th className="px-3 py-2">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {!rows && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-dashboard-muted">Loading…</td></tr>
            )}
            {rows && rows.map((r) => {
              const behind = tradingDaysBehind(r.latest);
              const h = health(behind);
              return (
                <tr key={r.sym} className="border-b border-dashboard-border/50 hover:bg-dashboard-card/60">
                  <td className="px-3 py-2 font-bold text-dashboard-text">{r.sym}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] ${SOURCE_TAG[r.source] || 'text-dashboard-muted border-dashboard-border'}`}>
                      {r.source}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-dashboard-muted">{r.role}</td>
                  <td className="px-3 py-2 text-dashboard-text">{r.latest || '—'}</td>
                  <td className="px-3 py-2 text-right text-dashboard-text">
                    {r.close == null ? '—' : r.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${h.dot}`} />
                      <span className={h.text}>{h.label}</span>
                      {behind !== Infinity && behind > 1 && (
                        <span className="text-dashboard-muted">({behind}d)</span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Manual refresh */}
      <div className="chart-container p-4">
        <div className="text-[9px] tracking-[3px] text-dashboard-muted mb-3">MANUAL REFRESH</div>
        <p className="text-[10px] text-dashboard-muted mb-3 leading-relaxed">
          Runs the same job as the daily cron — pulls the latest bars from all four sources and upserts
          them into <span className="text-dashboard-text">market_data</span>. Requires the{' '}
          <span className="text-dashboard-text">CRON_SECRET</span>. Start with a dry run to test without writing.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="CRON_SECRET"
            className="px-3 py-2 bg-dashboard-bg border border-dashboard-border rounded font-mono text-xs
                       text-dashboard-text placeholder:text-dashboard-muted w-56 focus:outline-none
                       focus:border-dashboard-buy"
          />
          <label className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-dashboard-muted cursor-pointer">
            <input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} />
            DRY RUN
          </label>
          <button
            onClick={runRefresh}
            disabled={running || !secret}
            className="px-4 py-2 bg-dashboard-buy/20 border border-dashboard-buy text-dashboard-buy
                       font-mono text-xs tracking-wider rounded cursor-pointer hover:bg-dashboard-buy/30
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? 'RUNNING…' : dry ? '▶ TEST REFRESH' : '▶ RUN REFRESH'}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-[11px] font-mono text-dashboard-sell">✕ {error}</div>
        )}
        {result && (
          <div className="mt-3 text-[11px] font-mono text-dashboard-text">
            <div className="text-dashboard-buy mb-1">
              ✓ {result.dry ? 'DRY RUN OK' : `WROTE ${result.upserted} ROWS`} · {result.at?.slice(0, 19).replace('T', ' ')}Z
            </div>
            <div className="text-dashboard-muted">
              fetched — yahoo {result.counts?.yahoo ?? 0} · cboe {result.counts?.cboe ?? 0}
              {' · '}cnn {result.counts?.cnn ?? 0} · wsj {result.counts?.wsj ?? 0}
            </div>
            {result.latest && (
              <div className="mt-1 text-dashboard-muted">
                {Object.entries(result.latest).map(([k, v]) => `${k} ${v.close} (${v.date})`).join('  ·  ')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-[9px] text-dashboard-muted tracking-wider">
        SECRET IS STORED LOCALLY IN YOUR BROWSER ONLY · NEVER SENT ANYWHERE EXCEPT THIS CONSOLE
      </div>
    </main>
  );
}
