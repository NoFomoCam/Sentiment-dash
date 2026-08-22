'use client';

import { useEffect, useMemo, useState } from 'react';
import { getZone, scoreFromRawData, WEIGHTS } from '../lib/scoring';
import { loadMarketSnapshot } from '../lib/supabase';

// Fear -> greed ramp (matches the instrument palette). Extremes vivid, neutral recedes.
const STOPS = [
  [20, [34, 231, 167]], [35, [90, 235, 130]], [45, [170, 240, 92]],
  [50, [255, 201, 62]], [58, [255, 165, 60]], [70, [255, 120, 82]], [82, [255, 74, 110]],
];
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function rampRGB(s) {
  if (s <= STOPS[0][0]) return STOPS[0][1];
  if (s >= STOPS[STOPS.length - 1][0]) return STOPS[STOPS.length - 1][1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (s >= a[0] && s <= b[0]) {
      const t = (s - a[0]) / (b[0] - a[0]);
      return [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)];
    }
  }
  return [247, 183, 55];
}
function heatColor(s) {
  const c = rampRGB(s);
  const inten = Math.min(1, Math.abs(s - 50) / 26);
  // Brighter floor so neutral days still read as color, not mud.
  return `rgba(${c[0]},${c[1]},${c[2]},${(0.62 + 0.38 * inten).toFixed(3)})`;
}
const solid = (s) => { const c = rampRGB(s); return `rgb(${c[0]},${c[1]},${c[2]})`; };

function meaning(score) {
  if (score < 20) return 'Extreme fear — historically a strong contrarian BUY zone.';
  if (score < 35) return 'Fear building — leaning buy; watch for price confirmation.';
  if (score < 45) return 'Mild fear tilt — no strong contrarian edge yet.';
  if (score < 55) return 'Neutral — no clear edge; wait for a signal.';
  if (score < 65) return 'Complacency creeping in — stay selective on new longs.';
  if (score < 75) return 'Greed — elevated correction risk; tighten up.';
  return 'Extreme greed — high sell risk; contrarian caution warranted.';
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PITCH = 15; // cell (12px) + gap (3px)
const fmtDate = (k) => { const [y, m, d] = k.split('-'); return `${MON[+m - 1]} ${+d}, ${y}`; };

// Recompute a past day's 11-indicator breakdown from grouped market_data closes
// (same mapping + scoring the dashboard uses live).
const SYMBOL_MAP = { VIX: 'vix', VSTN: 'vix9d', VIX3M: 'vix3m', DXY: 'dxy', SPY: 'spy', SPX: 'spx', RSP: 'rsp', NVDA: 'nvda', SMH: 'smh', GLD: 'gld', HYG: 'hyg', LQD: 'lqd', ADD: 'nyad', FG: 'fear_greed', PCR: 'pcr' };
const IND_LABEL = { vix: 'VIX', vix_term: 'VIX Term', cnn_fg: 'Fear & Greed', dxy: 'DXY', rsp_spy: 'RSP / SPY', nyse_ad: 'NYSE A/D', nvda_smh: 'NVDA / SMH', spx_gold: 'SPX / Gold', hyg_lqd: 'HYG / LQD', drawdown: 'Drawdown', pcr: 'Put/Call' };
const barColor = (s) => (s < 25 ? '#23d18b' : s < 45 ? '#8fe04f' : s < 55 ? '#f7b737' : s < 70 ? '#fb8a3c' : '#f64f68');
function breakdownFor(snap, date) {
  if (!snap || !snap.SPX) return null;
  const today = { fear_greed: null, pcr: null }, prev = {};
  for (const [sym, key] of Object.entries(SYMBOL_MAP)) {
    const arr = snap[sym]; if (!arr) continue;
    const i = arr.idx[date]; if (i == null) continue;
    today[key] = arr[i].close;
    if (i > 0) prev[key] = arr[i - 1].close;
  }
  const spx = snap.SPX, si = spx.idx[date];
  if (si == null) return null;
  const win = spx.slice(Math.max(0, si - 49), si + 1).map((x) => x.close);
  const high = win.length ? Math.max(...win) : today.spx;
  const dd = high > 0 ? ((today.spx / high) - 1) * 100 : 0;
  return scoreFromRawData(today, prev, { drawdownPct: dd, includeEod: true }).scores;
}

export default function SentimentCalendar({ history }) {
  const [sel, setSel] = useState(null); // { key, score }
  const [snap, setSnap] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadMarketSnapshot(430).then((g) => {
      if (cancelled || !g) return;
      for (const s of Object.keys(g)) g[s].idx = Object.fromEntries(g[s].map((x, i) => [x.date, i]));
      setSnap(g);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const breakdown = useMemo(() => (sel && snap ? breakdownFor(snap, sel.key) : null), [sel, snap]);

  const { map, weeks, monthMarks, months } = useMemo(() => {
    const map = {};
    for (const h of history || []) {
      const s = h.eod_score ?? h.live_score;
      if (h.date && s != null) map[h.date] = Number(s);
    }
    const dates = Object.keys(map).sort();
    if (!dates.length) return { map, weeks: [], monthMarks: [], months: [] };

    const maxD = new Date(dates[dates.length - 1] + 'T00:00:00');
    const firstD = new Date(dates[0] + 'T00:00:00');
    const wanted = new Date(maxD); wanted.setDate(wanted.getDate() - 364);
    const start = new Date(wanted > firstD ? wanted : firstD);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday

    const weeks = [], monthMarks = [];
    let col = 0, lastMonth = -1;
    const cur = new Date(start);
    while (cur <= maxD) {
      const wk = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(cur); d.setDate(cur.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        wk.push({ key, score: map[key] });
      }
      if (cur.getMonth() !== lastMonth) { monthMarks.push({ col, label: MON[cur.getMonth()] }); lastMonth = cur.getMonth(); }
      weeks.push(wk); col++; cur.setDate(cur.getDate() + 7);
    }

    const months = [];
    for (let back = 1; back >= 0; back--) {
      const d = new Date(maxD.getFullYear(), maxD.getMonth() - back, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return { map, weeks, monthMarks, months };
  }, [history]);

  if (!weeks.length) return null;
  const selZone = sel ? getZone(sel.score) : null;

  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Sentiment calendar · past year</div>
          <div className="mt-1 text-[11px] text-dashboard-faint">Every trading day, tinted by its contrarian score. Tap a day to read it.</div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-dashboard-faint">
          <span style={{ color: solid(20) }}>FEAR</span>
          <span className="h-1.5 w-24 rounded-full" style={{ background: 'linear-gradient(90deg,#23d18b,#8fe04f,#f7b737,#fb8a3c,#f64f68)' }} />
          <span style={{ color: solid(80) }}>GREED</span>
        </div>
      </div>

      {/* Selected-day detail */}
      {sel && (
        <div className="mb-3 rounded-lg border border-dashboard-border bg-dashboard-bg/50 p-3">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="font-mono text-3xl font-bold leading-none tabular-nums" style={{ color: selZone.color }}>{sel.score}</div>
              <div className="mt-1 font-mono text-[10px] text-dashboard-faint">{fmtDate(sel.key)}</div>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] tracking-wide" style={{ color: selZone.color }}>{selZone.label}</div>
              <p className="mt-1 text-[12px] leading-snug text-dashboard-muted">{meaning(sel.score)}</p>
            </div>
            <button onClick={() => setSel(null)} className="ml-auto self-start font-mono text-[12px] text-dashboard-faint hover:text-dashboard-text">✕</button>
          </div>
          {breakdown && (
            <div className="mt-3 border-t border-dashboard-hairline pt-3">
              <div className="eyebrow mb-2">That day’s breakdown</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {Object.entries(breakdown).filter(([k]) => WEIGHTS[k]).sort((a, b) => (WEIGHTS[b[0]] || 0) - (WEIGHTS[a[0]] || 0)).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-dashboard-muted">{IND_LABEL[k] || k}</span>
                    <span className="font-mono text-[12px] font-bold tabular-nums" style={{ color: barColor(v) }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Year heatmap */}
      <div className="overflow-x-auto pb-1">
        <div className="relative mb-1 h-3" style={{ minWidth: weeks.length * PITCH + 'px' }}>
          {monthMarks.map((m, i) => (
            <span key={i} className="absolute font-mono text-[9px] text-dashboard-faint" style={{ left: m.col * PITCH + 'px' }}>{m.label}</span>
          ))}
        </div>
        <div className="inline-grid gap-[3px]" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(5, 1fr)' }}>
          {weeks.flatMap((wk, ci) => wk.map((cell, ri) => (
            <div
              key={ci + '-' + ri}
              onClick={() => cell.score != null && setSel(cell)}
              title={cell.score != null ? `${cell.key} · ${cell.score}` : cell.key}
              className={`h-[12px] w-[12px] rounded-[3px] ${cell.score != null ? 'cursor-pointer' : ''}`}
              style={{
                background: cell.score != null ? heatColor(cell.score) : '#0e1420',
                border: sel && sel.key === cell.key ? '1px solid #e9edf4' : '1px solid rgba(255,255,255,0.03)',
              }}
            />
          )))}
        </div>
      </div>

      {/* Recent month detail */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {months.map((m, mi) => <MonthCard key={mi} year={m.year} month={m.month} map={map} sel={sel} onSelect={setSel} />)}
      </div>
    </section>
  );
}

function MonthCard({ year, month, map, sel, onSelect }) {
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ d, key, score: map[key] });
  }
  return (
    <div className="rounded-lg border border-dashboard-hairline bg-dashboard-bg/40 p-3">
      <div className="mb-2 font-mono text-[11px] tracking-wide text-dashboard-muted">{MON[month]} {year}</div>
      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d, i) => <div key={'h' + i} className="text-center font-mono text-[8px] text-dashboard-faint">{d}</div>)}
        {cells.map((c, i) => c == null ? <div key={i} /> : (
          <div
            key={i}
            onClick={() => c.score != null && onSelect(c)}
            title={c.score != null ? `${c.key} · ${c.score}` : c.key}
            className={`flex aspect-square items-center justify-center rounded font-mono text-[11px] font-semibold ${c.score != null ? 'cursor-pointer' : ''}`}
            style={c.score != null
              ? { background: heatColor(c.score), color: 'rgba(255,255,255,0.92)', outline: sel && sel.key === c.key ? '1.5px solid #e9edf4' : 'none' }
              : { background: '#0e1420', color: '#586a86' }}
          >
            {c.score != null ? c.score : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
