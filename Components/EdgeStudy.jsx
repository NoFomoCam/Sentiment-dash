'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { loadMarketData } from '../lib/supabase';

// Does buying fear / fading greed actually pay? We join every historical
// sentiment score to SPX's forward return N trading days later and bucket by
// how extreme the reading was. All numbers are measured, not assumed.

const HORIZONS = [1, 5, 20];
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

export default function EdgeStudy({ history }) {
  const [spx, setSpx] = useState(null);
  const [thr, setThr] = useState(THRESHOLDS[1]); // Strong (30/70) — balanced sample sizes
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
  }, [spx, history]);

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

  return (
    <div className="surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">The edge · measured, not claimed</div>
          <h3 className="mt-1 text-lg font-semibold text-dashboard-text">Does buying fear actually pay?</h3>
          <p className="mt-1 max-w-xl text-[13px] leading-snug text-dashboard-muted">
            Every past reading, matched to what the S&amp;P 500 did over the next 1, 5 and 20 trading days —
            then split by how extreme the crowd was.
          </p>
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
            <table className="w-full min-w-[440px] text-[12px]">
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

          {/* Neutral daily bias */}
          <div className="mt-4 rounded-lg border border-dashboard-hairline bg-dashboard-bg/40 px-4 py-3 text-[12px] leading-snug text-dashboard-muted">
            <span className="eyebrow">Neutral-day bias</span>{' '}
            <span className="ml-1">
              On the {A.byH[1].neutral.n} days the read sat between {thr.lo}–{thr.hi}, the next day averaged{' '}
              <strong style={{ color: A.byH[1].neutral.avg >= 0 ? C_FEAR : C_GREED }}>{fmtPct(A.byH[1].neutral.avg, 2)}</strong>{' '}
              and closed higher {A.byH[1].neutral.up.toFixed(0)}% of the time — the crowd in the middle carries little edge either way.
            </span>
          </div>

          <p className="mt-3 font-mono text-[10px] leading-relaxed text-dashboard-faint">
            {A.nAll.toLocaleString()} scored trading days, {A.from} → {A.to}. Forward returns use S&amp;P 500 closes N trading days later.
            Extreme buckets are deliberately small — that’s the point of an extreme. Past behavior is not a guarantee of future results.
          </p>
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
