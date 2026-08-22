'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { loadMarketData } from '../lib/supabase';
import { getZone } from '../lib/scoring';
import { DISCLAIMER_SHORT } from '../lib/legal';

// Does buying fear / fading greed actually pay? We join every historical
// sentiment score to SPX's forward return N trading days later and bucket by
// how extreme the reading was. All numbers are measured, not assumed.

const HORIZONS = [1, 5, 20, 60];
const THRESHOLDS = [
  { key: 'm', lo: 40, hi: 60, label: 'Mild', sub: '≤40 / ≥60' },
  { key: 's', lo: 30, hi: 70, label: 'Strong', sub: '≤30 / ≥70' },
  { key: 'x', lo: 25, hi: 75, label: 'Extreme', sub: '≤25 / ≥75' },
];

const C_FEAR = '#23d18b';
const C_BASE = '#8ea3c6';
const C_GREED = '#f64f68';

const fmtPct = (x, d = 2) => (x >= 0 ? '+' : '') + x.toFixed(d) + '%';
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function median(a) {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
}
const upRate = (a) => (a.length ? (a.filter((x) => x > 0).length / a.length) * 100 : 0);

// Full-spectrum score buckets for the heatmap grid.
const GRID_BUCKETS = [
  { key: '< 20', lo: 0, hi: 20, mood: 'fear' },
  { key: '20–30', lo: 20, hi: 30, mood: 'fear' },
  { key: '30–40', lo: 30, hi: 40, mood: 'fear' },
  { key: '40–50', lo: 40, hi: 50, mood: 'neutral' },
  { key: '50–60', lo: 50, hi: 60, mood: 'neutral' },
  { key: '60–70', lo: 60, hi: 70, mood: 'greed' },
  { key: '≥ 70', lo: 70, hi: 101, mood: 'greed' },
];

// Cell shade: green when the bucket beat a random day at that horizon, red when
// it lagged; opacity scales with the size of the gap.
function edgeColor(edge, maxAbs) {
  if (edge == null || maxAbs <= 0) return 'transparent';
  // sqrt compression so a single extreme bucket (e.g. deep-panic <20) doesn't
  // wash every other cell to near-transparent.
  const t = Math.sqrt(Math.min(1, Math.abs(edge) / maxAbs));
  const a = (0.08 + 0.6 * t).toFixed(3);
  return edge >= 0 ? `rgba(35,209,139,${a})` : `rgba(246,79,104,${a})`;
}
const moodDot = (mood) => (mood === 'fear' ? C_FEAR : mood === 'greed' ? C_GREED : C_BASE);

export default function EdgeStudy({ history }) {
  const [spx, setSpx] = useState(null);
  const [thr, setThr] = useState(THRESHOLDS[1]); // Strong (30/70) — balanced sample sizes
  const [era, setEra] = useState('all'); // 'all' (2007+) | 'recent' (2021+, current CNN-era method)
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Scores begin 2007-12; only need SPX from a bit before that (+ trailing
    // bars for the forward window, which are all present up to today).
    loadMarketData('SPX', '2007-06-01')
      .then((rows) => { if (!cancelled) setSpx(rows || []); })
      .catch(() => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; };
  }, []);

  // One sample per scored day: its score + SPX forward returns at each horizon.
  const samples = useMemo(() => {
    if (!spx || !spx.length || !history) return null;
    const idx = new Map();
    spx.forEach((r, i) => idx.set(r.date, i));
    const out = [];
    for (const row of history) {
      if (era === 'recent' && row.date < '2021-01-01') continue;
      const score = row.eod_score ?? row.live_score;
      if (score == null) continue;
      const i = idx.get(row.date);
      if (i == null) continue;
      const base = Number(spx[i].close);
      if (!base) continue;
      const fwd = {};
      for (const h of HORIZONS) {
        const j = i + h;
        if (j < spx.length) fwd[h] = (Number(spx[j].close) / base - 1) * 100;
      }
      out.push({ date: row.date, score, fwd });
    }
    return out;
  }, [spx, history, era]);

  const A = useMemo(() => {
    if (!samples || !samples.length) return null;
    const fear = samples.filter((s) => s.score <= thr.lo);
    const greed = samples.filter((s) => s.score >= thr.hi);
    const neutral = samples.filter((s) => s.score > thr.lo && s.score < thr.hi);
    const stat = (arr, h) => {
      const v = arr.map((s) => s.fwd[h]).filter((x) => x != null);
      return { n: v.length, avg: mean(v), med: median(v), up: upRate(v) };
    };
    const perH = HORIZONS.map((h) => ({
      h,
      all: stat(samples, h),
      fear: stat(fear, h),
      neutral: stat(neutral, h),
      greed: stat(greed, h),
    }));
    const dates = samples.map((s) => s.date).sort();
    const byH = Object.fromEntries(perH.map((r) => [r.h, r]));
    // Verdict: does fear beat baseline AND greed lag baseline at the 20d horizon?
    const h20 = byH[20];
    const fearEdge = h20.fear.avg - h20.all.avg;
    const greedEdge = h20.greed.avg - h20.all.avg;
    const fearWorks = fearEdge > 0.25;   // fear meaningfully beats baseline
    const greedInverts = greedEdge < -0.1; // greed actually underperforms
    return {
      perH, byH, fear, greed, neutral,
      nAll: samples.length, from: dates[0], to: dates[dates.length - 1],
      fearEdge, greedEdge, fearWorks, greedInverts,
    };
  }, [samples, thr]);

  const chartData = useMemo(() => {
    if (!A) return [];
    return A.perH.map((r) => ({
      label: r.h === 1 ? '1 day' : `${r.h} days`,
      Fear: +r.fear.avg.toFixed(2),
      Baseline: +r.all.avg.toFixed(2),
      Greed: +r.greed.avg.toFixed(2),
    }));
  }, [A]);

  // What history says about *today's* score level (independent of the fear/greed
  // threshold) — the actionable "for you, right now" read.
  const today = useMemo(() => {
    if (!history || !history.length || !samples) return null;
    const last = history[history.length - 1];
    const score = last.eod_score ?? last.live_score;
    if (score == null) return null;
    const band = 5;
    const near = samples.filter((s) => Math.abs(s.score - score) <= band && s.date !== last.date);
    const stat = (h) => {
      const v = near.map((s) => s.fwd[h]).filter((x) => x != null);
      return { n: v.length, avg: mean(v), up: upRate(v) };
    };
    const baseAvg = (h) => mean(samples.map((s) => s.fwd[h]).filter((x) => x != null));
    const s20 = stat(20);
    const base20 = baseAvg(20);
    const edge20 = s20.avg - base20;
    const lean = edge20 > 0.5 ? 'a bit stronger than' : edge20 < -0.5 ? 'a bit softer than' : 'right in line with';
    return { score, date: last.date, band, s20, base20, edge20, lean, zone: getZone(score) };
  }, [history, samples]);

  // Full score-bucket × horizon matrix, each cell shaded by edge vs baseline.
  const grid = useMemo(() => {
    if (!samples || !samples.length) return null;
    const baseline = {};
    for (const h of HORIZONS) baseline[h] = mean(samples.map((s) => s.fwd[h]).filter((x) => x != null));
    let maxAbs = 0;
    const rows = GRID_BUCKETS.map((b) => {
      const inB = samples.filter((s) => s.score >= b.lo && s.score < b.hi);
      const cells = HORIZONS.map((h) => {
        const v = inB.map((s) => s.fwd[h]).filter((x) => x != null);
        const avg = v.length ? mean(v) : null;
        const edge = avg == null ? null : avg - baseline[h];
        if (edge != null && v.length >= 8) maxAbs = Math.max(maxAbs, Math.abs(edge));
        return { n: v.length, avg, edge };
      });
      return { ...b, n: inB.length, cells };
    });
    return { rows, baseline, maxAbs };
  }, [samples]);

  return (
    <div className="surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">The edge · measured, not claimed</div>
          <h3 className="mt-1 text-lg font-semibold text-dashboard-text">Does buying fear actually pay?</h3>
          <p className="mt-1 max-w-xl text-[13px] leading-snug text-dashboard-muted">
            Every past reading, matched to what the S&amp;P 500 did over the next 1, 5, 20 and 60 trading days —
            then split by how extreme the crowd was.
          </p>
          <div className="mt-3 inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-dashboard-faint">Period</span>
            <div className="flex rounded-lg border border-dashboard-border bg-dashboard-bg/60 p-0.5">
              {[['all', 'All · 2007+'], ['recent', 'Current method · 2021+']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setEra(k)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] transition ${
                    era === k ? 'bg-dashboard-border/70 text-dashboard-text' : 'text-dashboard-faint hover:text-dashboard-muted'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Threshold selector */}
        <div className="flex rounded-lg border border-dashboard-border bg-dashboard-bg/60 p-0.5">
          {THRESHOLDS.map((t) => (
            <button
              key={t.key}
              onClick={() => setThr(t)}
              className={`rounded-md px-3 py-1.5 text-center font-mono text-[11px] transition ${
                thr.key === t.key ? 'bg-dashboard-border/70 text-dashboard-text' : 'text-dashboard-faint hover:text-dashboard-muted'
              }`}
            >
              <span className="block leading-none">{t.label}</span>
              <span className="block text-[9px] leading-tight opacity-70">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {err && (
        <p className="mt-6 font-mono text-[12px] text-dashboard-sell">Couldn’t load S&amp;P 500 history.</p>
      )}
      {!err && !A && (
        <p className="mt-6 font-mono text-[12px] text-dashboard-faint">Crunching the history…</p>
      )}

      {A && (
        <>
          {/* Today's edge — what history says about the current level */}
          {today && (
            <div className="mt-5 rounded-xl border p-4" style={{ borderColor: `${today.zone.color}55`, background: `${today.zone.color}0f` }}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="text-center">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-dashboard-faint">Right now</div>
                  <div className="font-mono text-3xl font-bold leading-none tabular-nums" style={{ color: today.zone.color }}>{today.score}</div>
                  <div className="mt-1 font-mono text-[10px] tracking-wide" style={{ color: today.zone.color }}>{today.zone.label}</div>
                </div>
                <p className="min-w-[220px] flex-1 text-[13px] leading-snug text-dashboard-muted">
                  The last <strong className="text-dashboard-text">{today.s20.n}</strong> times the read sat near{' '}
                  <strong className="text-dashboard-text">{today.score}</strong> (±{today.band}), the S&amp;P averaged{' '}
                  <strong style={{ color: today.edge20 >= 0 ? C_FEAR : C_GREED }}>{fmtPct(today.s20.avg, 1)}</strong> over the next month —{' '}
                  {today.lean} a normal month ({fmtPct(today.base20, 1)}), higher {today.s20.up.toFixed(0)}% of the time.
                  {today.s20.n < 10 && <span className="text-dashboard-faint"> (Thin sample — read lightly.)</span>}
                </p>
              </div>
            </div>
          )}

          {/* Headline callouts */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Callout
              tint={C_FEAR}
              tag={`After extreme fear (≤${thr.lo})`}
              big={fmtPct(A.byH[20].fear.avg, 1)}
              sub={`avg 20-day · ${A.byH[20].fear.up.toFixed(0)}% higher · ${A.byH[20].fear.n} days`}
            />
            <Callout
              tint={C_BASE}
              tag="Any random day (baseline)"
              big={fmtPct(A.byH[20].all.avg, 1)}
              sub={`avg 20-day · ${A.byH[20].all.up.toFixed(0)}% higher · ${A.nAll} days`}
            />
            <Callout
              tint={C_GREED}
              tag={`After extreme greed (≥${thr.hi})`}
              big={fmtPct(A.byH[20].greed.avg, 1)}
              sub={`avg 20-day · ${A.byH[20].greed.up.toFixed(0)}% higher · ${A.byH[20].greed.n} days`}
            />
          </div>

          {/* Verdict line */}
          <div
            className="mt-4 rounded-lg border px-4 py-3 text-[13px] leading-snug"
            style={{
              borderColor: A.fearWorks ? 'rgba(35,209,139,0.4)' : 'rgba(142,163,198,0.35)',
              background: A.fearWorks ? 'rgba(35,209,139,0.06)' : 'rgba(142,163,198,0.05)',
              color: '#c9d4e8',
            }}
          >
            {A.fearWorks && A.greedInverts ? (
              <>
                <strong className="text-dashboard-buy">Both sides work.</strong> Buying extreme fear beat a random day by{' '}
                <strong>{fmtPct(A.fearEdge, 1)}</strong> over 20 days, and fading extreme greed avoided{' '}
                <strong>{fmtPct(-A.greedEdge, 1)}</strong> of it. The full contrarian tilt shows up in the tape.
              </>
            ) : A.fearWorks ? (
              <>
                <strong className="text-dashboard-buy">Buying fear is the edge.</strong> After extreme fear (≤{thr.lo}), the S&amp;P averaged{' '}
                <strong>{fmtPct(A.byH[20].fear.avg, 1)}</strong> over the next 20 days — <strong>{fmtPct(A.fearEdge, 1)}</strong> better than a
                random day, higher {A.byH[20].fear.up.toFixed(0)}% of the time. Extreme greed, though, kept grinding up
                ({fmtPct(A.byH[20].greed.avg, 1)}) — so a hot reading is a cue to <em>tighten risk</em>, not to short. Fear snaps back; greed persists.
              </>
            ) : (
              <>
                <strong className="text-dashboard-neutral">Softer at this cutoff.</strong> At ≤{thr.lo}/≥{thr.hi}, fear’s 20-day edge over
                baseline is {fmtPct(A.fearEdge, 1)} — tighten the threshold to concentrate the signal.
              </>
            )}
          </div>

          {/* Bar chart: avg forward return by horizon */}
          <div className="mt-5 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barGap={2} barCategoryGap="24%">
                <ReferenceLine y={0} stroke="#22304a" />
                <XAxis dataKey="label" tick={{ fill: '#8497b3', fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }} axisLine={{ stroke: '#22304a' }} tickLine={false} />
                <YAxis tick={{ fill: '#6b7c99', fontSize: 10 }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                <Tooltip
                  cursor={{ fill: 'rgba(142,163,198,0.06)' }}
                  contentStyle={{ background: '#10151f', border: '1px solid #22304a', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#c9d4e8', fontFamily: 'monospace' }}
                  formatter={(v, n) => [fmtPct(v, 2), n]}
                />
                <Bar dataKey="Fear" fill={C_FEAR} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="Baseline" fill={C_BASE} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="Greed" fill={C_GREED} radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-dashboard-faint">
            <Legend color={C_FEAR} label={`Extreme fear (≤${thr.lo})`} />
            <Legend color={C_BASE} label="Baseline (all days)" />
            <Legend color={C_GREED} label={`Extreme greed (≥${thr.hi})`} />
            <span className="ml-auto">avg SPX forward return</span>
          </div>

          {/* Detail table */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-dashboard-faint">
                  <th className="pb-2 font-normal">Signal</th>
                  <th className="pb-2 text-right font-normal">Days</th>
                  {HORIZONS.map((h) => (
                    <th key={h} className="pb-2 text-right font-normal">{h === 1 ? '1d' : `${h}d`} avg · up%</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                <Row A={A} bucket="fear" tint={C_FEAR} name={`Fear ≤${thr.lo}`} nOf={A.byH[1].fear.n} />
                <Row A={A} bucket="all" tint={C_BASE} name="All days" nOf={A.nAll} />
                <Row A={A} bucket="greed" tint={C_GREED} name={`Greed ≥${thr.hi}`} nOf={A.byH[1].greed.n} />
              </tbody>
            </table>
          </div>

          {/* The edge grid — full score spectrum × horizon heatmap */}
          {grid && (
            <div className="mt-6">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="eyebrow">The edge grid</div>
                <div className="font-mono text-[10px] text-dashboard-faint">avg forward return · shaded vs a random day</div>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[440px]">
                  <div className="grid" style={{ gridTemplateColumns: '68px repeat(4, 1fr)' }}>
                    <div className="pb-1 font-mono text-[9px] uppercase tracking-wide text-dashboard-faint">Score</div>
                    {HORIZONS.map((h) => (
                      <div key={h} className="pb-1 text-center font-mono text-[10px] text-dashboard-faint">{h === 1 ? '1d' : `${h}d`}</div>
                    ))}
                  </div>
                  {grid.rows.map((r) => (
                    <div key={r.key} className="grid items-stretch gap-1 py-0.5" style={{ gridTemplateColumns: '68px repeat(4, 1fr)' }}>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-dashboard-muted">
                        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: moodDot(r.mood) }} />
                        {r.key}
                      </div>
                      {r.cells.map((c, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center justify-center rounded-md py-2"
                          style={{ background: edgeColor(c.edge, grid.maxAbs), border: '1px solid rgba(34,48,74,0.55)' }}
                          title={c.n ? `${c.n} days · ${fmtPct(c.avg, 2)} avg · ${fmtPct(c.edge, 2)} vs baseline` : 'no data'}
                        >
                          {c.avg == null ? (
                            <span className="font-mono text-[11px] text-dashboard-faint">—</span>
                          ) : (
                            <>
                              <span className={`font-mono text-[12px] font-semibold tabular-nums ${c.n < 8 ? 'opacity-50' : ''}`} style={{ color: '#e6ecf7' }}>
                                {fmtPct(c.avg, 1)}
                              </span>
                              <span className="font-mono text-[8px] text-dashboard-faint">n={c.n}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-dashboard-faint">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'rgba(35,209,139,0.6)' }} /> beat a random day</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'rgba(246,79,104,0.6)' }} /> lagged it</span>
                <span>· shade = size of the gap · n = sample size</span>
              </div>
            </div>
          )}

          {/* Neutral daily bias */}
          <div className="mt-4 rounded-lg border border-dashboard-hairline bg-dashboard-bg/40 px-4 py-3 text-[12px] leading-snug text-dashboard-muted">
            <span className="eyebrow">Neutral-day bias</span>{' '}
            <span className="ml-1">
              On the {A.byH[1].neutral.n} days the read sat between {thr.lo}–{thr.hi}, the next day averaged{' '}
              <strong style={{ color: A.byH[1].neutral.avg >= 0 ? C_FEAR : C_GREED }}>{fmtPct(A.byH[1].neutral.avg, 2)}</strong>{' '}
              and closed higher {A.byH[1].neutral.up.toFixed(0)}% of the time — the crowd in the middle carries little edge either way.
            </span>
          </div>

          <div className="mt-4 rounded-lg border border-dashboard-hairline bg-dashboard-bg/40 px-4 py-3">
            <p className="font-mono text-[10px] leading-relaxed text-dashboard-faint">
              {A.nAll.toLocaleString()} scored trading days, {A.from} → {A.to}. Forward returns use S&amp;P 500 closes N trading days later;
              extreme buckets are deliberately small — that’s the point of an extreme.
            </p>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-dashboard-muted">{DISCLAIMER_SHORT}</p>
          </div>
        </>
      )}
    </div>
  );
}

function Callout({ tint, tag, big, sub }) {
  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-bg/50 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: tint }}>{tag}</div>
      <div className="mt-1 font-mono text-2xl font-bold tabular-nums" style={{ color: tint }}>{big}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-dashboard-faint">{sub}</div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Row({ A, bucket, tint, name, nOf }) {
  return (
    <tr className="border-t border-dashboard-hairline">
      <td className="py-2">
        <span className="inline-flex items-center gap-2 text-dashboard-text">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tint }} />
          {name}
        </span>
      </td>
      <td className="py-2 text-right tabular-nums text-dashboard-muted">{nOf.toLocaleString()}</td>
      {HORIZONS.map((h) => {
        const s = A.byH[h][bucket];
        return (
          <td key={h} className="py-2 text-right tabular-nums">
            <span className="font-semibold" style={{ color: s.avg >= 0 ? C_FEAR : C_GREED }}>{fmtPct(s.avg, 2)}</span>
            <span className="ml-2 text-dashboard-faint">{s.up.toFixed(0)}%</span>
          </td>
        );
      })}
    </tr>
  );
}
