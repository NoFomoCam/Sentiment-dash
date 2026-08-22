'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DISCLAIMER_FULL } from '../lib/legal';

function useCountUp(target, ms = 1300, start = true) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf, t0;
    const tick = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, start]);
  return v;
}

function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}

function heat(s) {
  const stops = [[20, [34, 231, 167]], [40, [170, 240, 92]], [50, [255, 201, 62]], [65, [255, 150, 62]], [82, [255, 74, 110]]];
  let c = stops[stops.length - 1][1];
  if (s <= stops[0][0]) c = stops[0][1];
  else for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (s >= a[0] && s <= b[0]) { const t = (s - a[0]) / (b[0] - a[0]); c = a[1].map((v, k) => Math.round(v + (b[1][k] - v) * t)); break; }
  }
  const inten = Math.min(1, Math.abs(s - 50) / 26);
  return `rgba(${c[0]},${c[1]},${c[2]},${(0.62 + 0.38 * inten).toFixed(2)})`;
}

const TAPE = [
  ['SPX', '7,674', '+0.43%', 1], ['NDX', '29,213', '−0.72%', -1], ['QQQ', '710.9', '−0.51%', -1],
  ['VIX', '16.0', '+1.8%', 1], ['NVDA', '225.0', '+0.9%', 1], ['SMH', '594', '+0.8%', 1],
  ['SPY', '767', '+0.44%', 1], ['RSP', '221', '+0.2%', 1], ['DXY', '99.6', '−0.1%', -1],
  ['GLD', '405', '+0.9%', 1], ['HYG', '79.6', '+0.1%', 1], ['SMH', '594', '+0.8%', 1],
];

function AnimatedGauge({ score }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 120); return () => clearTimeout(t); }, []);
  const cx = 160, cy = 150, r = 120;
  const pt = (a, rad) => [cx + rad * Math.cos((a * Math.PI) / 180), cy - rad * Math.sin((a * Math.PI) / 180)];
  const p0 = pt(180, r), p1 = pt(0, r);
  const ticks = [];
  for (let s = 0; s <= 100; s += 10) { const a = 180 - 1.8 * s; ticks.push([pt(a, r - 16), pt(a, r - (s % 50 === 0 ? 28 : 23)), s % 50 === 0]); }
  const rot = ready ? (score - 50) * 1.8 : -90;
  return (
    <svg viewBox="0 0 320 176" width="100%" style={{ maxWidth: 340 }} aria-hidden="true">
      <defs>
        <linearGradient id="lgarc" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#23d18b" /><stop offset="27%" stopColor="#8fe04f" /><stop offset="50%" stopColor="#f7b737" /><stop offset="73%" stopColor="#fb8a3c" /><stop offset="100%" stopColor="#f64f68" />
        </linearGradient>
      </defs>
      <path d={`M${p0[0]} ${p0[1]} A${r} ${r} 0 0 1 ${p1[0]} ${p1[1]}`} fill="none" stroke="url(#lgarc)" strokeWidth="10" strokeLinecap="round" />
      {ticks.map(([o, inr, big], i) => <line key={i} x1={o[0]} y1={o[1]} x2={inr[0]} y2={inr[1]} stroke="#465675" strokeWidth={big ? 2 : 1} />)}
      <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 1.5s cubic-bezier(.22,1,.28,1)' }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 20)} stroke="#e9edf4" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="#e9edf4" />
      </g>
    </svg>
  );
}

function Stat({ n, suffix, label, play }) {
  const v = useCountUp(n, 1400, play);
  return (
    <div className="text-center">
      <div className="font-mono text-3xl font-bold tabular-nums text-dashboard-text sm:text-4xl">{v}{suffix}</div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}

// A month of illustrative scores for the animated calendar.
const LEAD = 2;
function ProofStat({ value, tint, label }) {
  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-bg/50 p-4 text-center">
      <div className="font-mono text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: tint }}>{value}</div>
      <div className="mt-1 text-[11px] leading-tight text-dashboard-faint">{label}</div>
    </div>
  );
}

const MDAYS = Array.from({ length: 22 }, (_, i) => 44 + Math.round(22 * Math.sin(i / 2.6) + 9 * Math.cos(i / 1.4)));

export default function LandingClient() {
  const score = useCountUp(62, 1600);
  const [statsRef, statsSeen] = useInView();
  const [calRef, calSeen] = useInView(0.25);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-6 sm:px-6">
      {/* Nav */}
      <nav className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#10151f" stroke="#22304a" />
            <path d="M6 21 A10 10 0 0 1 11 12.34" stroke="#23d18b" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M11 12.34 A10 10 0 0 1 21 12.34" stroke="#f7b737" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M21 12.34 A10 10 0 0 1 26 21" stroke="#f64f68" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <line x1="16" y1="21" x2="18.2" y2="12.9" stroke="#e9edf4" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="16" cy="21" r="2.1" fill="#e9edf4" />
          </svg>
          <span className="font-bold tracking-tight">Sentiment Reader</span>
        </div>
        <Link href="/" className="rounded-lg border border-dashboard-border bg-dashboard-card px-3.5 py-1.5 font-mono text-[12px] text-dashboard-muted transition-colors hover:border-dashboard-brand/50 hover:text-dashboard-text">Open dashboard →</Link>
      </nav>

      {/* Ticker tape */}
      <div className="relative -mx-5 overflow-hidden border-y border-dashboard-hairline bg-dashboard-card/60 py-2.5 sm:-mx-6">
        <div className="marquee-track flex w-max gap-8 whitespace-nowrap font-mono text-[12px]">
          {[...TAPE, ...TAPE].map(([sym, val, chg, dir], i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="font-semibold text-dashboard-text">{sym}</span>
              <span className="text-dashboard-muted">{val}</span>
              <span style={{ color: dir > 0 ? '#23d18b' : dir < 0 ? '#f64f68' : '#8497b3' }}>{chg}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="grid items-center gap-8 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
        <div style={{ animation: 'rise .7s cubic-bezier(.16,1,.3,1) both' }}>
          <div className="eyebrow">Contrarian market sentiment · SPX / NDX</div>
          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            The crowd is loudest <span className="text-dashboard-brand">right before the turn.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-dashboard-muted">
            One contrarian score, 0–100, distilled from eleven fear-and-greed signals — so you can see when the market’s too scared to sell and too greedy to buy. Backed by decades of data and rebuilt every weekday after the U.S. close.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/" className="rounded-lg bg-dashboard-brand px-5 py-2.5 font-mono text-[13px] font-semibold text-[#0a0d14] transition-transform hover:-translate-y-0.5">Open the dashboard →</Link>
            <span className="font-mono text-[11px] text-dashboard-faint">Free while in beta</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashboard-border bg-gradient-to-b from-dashboard-elevated to-dashboard-card p-8 shadow-card" style={{ animation: 'rise .7s .1s cubic-bezier(.16,1,.3,1) both' }}>
          <AnimatedGauge score={62} />
          <div className="-mt-4 text-center">
            <span className="font-mono text-6xl font-bold tabular-nums text-dashboard-caution" style={{ textShadow: '0 0 40px rgba(251,138,60,.4)' }}>{score}</span>
            <span className="ml-1 text-xl font-semibold text-dashboard-faint">/100</span>
            <div className="mt-1 font-mono text-[11px] tracking-[0.2em] text-dashboard-caution">CAUTION · GREED BUILDING</div>
          </div>
        </div>
      </section>

      {/* Data-depth strip */}
      <section ref={statsRef} className="grid grid-cols-2 gap-4 rounded-2xl border border-dashboard-border bg-dashboard-card p-6 sm:grid-cols-4">
        <Stat n={56} suffix="yr" label="of market history" play={statsSeen} />
        <Stat n={17} suffix="" label="symbols tracked" play={statsSeen} />
        <Stat n={11} suffix="" label="fear/greed signals" play={statsSeen} />
        <div className="text-center">
          <div className="font-mono text-3xl font-bold text-dashboard-text sm:text-4xl">1×</div>
          <div className="eyebrow mt-1">every close</div>
        </div>
      </section>

      {/* Thesis */}
      <section className="mt-4 rounded-2xl border border-dashboard-border bg-dashboard-card p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="eyebrow">How it reads</div>
            <p className="mt-3 text-[15px] leading-relaxed text-dashboard-text">
              It’s <span className="font-semibold">contrarian</span>, so it reads backwards from the mood.
              A <span className="font-semibold text-dashboard-buy">low</span> score means everyone’s fearful — historically where bounces start.
              A <span className="font-semibold text-dashboard-sell">high</span> score means everyone’s greedy — where corrections tend to bite. You lean against the extremes.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <div className="h-3 rounded-full" style={{ background: 'linear-gradient(90deg,#23d18b,#8fe04f,#f7b737,#fb8a3c,#f64f68)' }} />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-dashboard-faint"><span className="text-dashboard-buy">0 · FEAR / BUY</span><span className="text-dashboard-sell">GREED / SELL · 100</span></div>
          </div>
        </div>
      </section>

      {/* Charts + data breadth */}
      <section className="py-16">
        <div className="eyebrow">More than a number</div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">The whole board, not just the score.</h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-dashboard-muted">
          Candlestick charts for every symbol, with trend lines, rays, fib retracements and moving averages. A shared time window across all of them. Plus our own sentiment-vs-price divergence signal, the indicator breakdown, and a daily contrarian read.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {['SPX', 'NDX', 'SPY', 'QQQ', 'RSP', 'VIX', 'VIX3M', 'NVDA', 'SMH', 'DXY', 'GLD', 'HYG', 'LQD'].map((s) => (
            <span key={s} className="rounded-md border border-dashboard-border bg-dashboard-card px-2.5 py-1 font-mono text-[11px] text-dashboard-muted">{s}</span>
          ))}
        </div>
      </section>

      {/* Animated sentiment calendar with scores */}
      <section ref={calRef} className="rounded-2xl border border-dashboard-border bg-gradient-to-b from-dashboard-elevated to-dashboard-card p-6 sm:p-8">
        <div className="eyebrow">The sentiment calendar</div>
        <h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">A map of market emotion — years of it.</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-dashboard-muted">Every trading day scored and tinted. Extremes glow, neutral days recede — so fear troughs and greed runs jump right out.</p>
        <div className="mt-6 grid grid-cols-7 gap-1.5" style={{ maxWidth: 360 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={'h' + i} className="text-center font-mono text-[9px] text-dashboard-faint">{d}</div>)}
          {Array.from({ length: LEAD }).map((_, i) => <div key={'b' + i} />)}
          {MDAYS.map((s, i) => (
            <div key={i}
              className="flex aspect-square items-center justify-center rounded-md font-mono text-[12px] font-semibold"
              style={{
                background: heat(s), color: 'rgba(255,255,255,0.92)',
                opacity: calSeen ? 1 : 0,
                animation: calSeen ? `cellpop .45s ${i * 28}ms cubic-bezier(.2,1.3,.4,1) both` : 'none',
              }}>
              {s}
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10px] text-dashboard-faint">Illustrative — the live calendar in the dashboard runs on real data, back through the years.</p>
      </section>

      {/* The proof — historical edge, with full disclosure */}
      <section className="mt-4 rounded-2xl border border-dashboard-border bg-dashboard-card p-6 sm:p-8">
        <div className="eyebrow">The proof · measured, not claimed</div>
        <h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">When the crowd panicked, the market paid.</h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-dashboard-muted">
          We matched every reading since 2007 to what the S&amp;P 500 actually did next. The pattern is real — and we’re honest about its limits.
        </p>

        <blockquote className="mt-6 border-l-2 border-dashboard-buy/60 pl-4 text-[15px] italic leading-relaxed text-dashboard-text sm:text-[17px]">
          “After the score hit extreme fear, the S&amp;P 500 averaged{' '}
          <span className="not-italic font-semibold text-dashboard-buy">+2.5%</span> over the next 20 trading days —
          versus <span className="not-italic font-semibold text-dashboard-steel">+1.1%</span> on any given day.”
        </blockquote>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <ProofStat value="+2.5%" tint="#23d18b" label="after extreme fear" />
          <ProofStat value="+1.1%" tint="#8ea3c6" label="on any given day" />
          <ProofStat value="1,568" tint="#8ea3c6" label="days measured" />
        </div>

        <p className="mt-5 text-[13px] leading-relaxed text-dashboard-muted">
          Fear snapped back; greed, on the other hand, tended to keep grinding — so we read a hot number as a cue to{' '}
          <em>manage risk</em>, never as a signal to short. Every figure in the app shows its sample size and date range.
        </p>

        <p className="mt-5 border-t border-dashboard-hairline pt-4 font-mono text-[10px] leading-relaxed text-dashboard-faint">
          {DISCLAIMER_FULL}
        </p>
      </section>

      {/* Final CTA */}
      <section className="py-20 text-center">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Start reading the market’s mood.</h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] text-dashboard-muted">One contrarian number, the signals behind it, the charts, and decades of history — free while it’s in beta.</p>
        <Link href="/" className="mt-7 inline-block rounded-lg bg-dashboard-brand px-6 py-3 font-mono text-[13px] font-semibold text-[#0a0d14] transition-transform hover:-translate-y-0.5">Open the dashboard →</Link>
      </section>

      <footer className="border-t border-dashboard-hairline py-8 text-center font-mono text-[11px] text-dashboard-faint">
        Sentiment Reader · contrarian sentiment for SPX / NDX · not financial advice
      </footer>
    </main>
  );
}
