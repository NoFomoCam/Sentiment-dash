import Link from 'next/link';

export const metadata = {
  title: 'Sentiment Reader — Contrarian market sentiment for SPX / NDX',
  description: 'Eleven fear-and-greed signals distilled into one contrarian 0–100 score for SPX & NDX, updated every close. See when the crowd is too scared to sell and too greedy to buy.',
};

// Gauge mark (matches the app favicon/logo).
function Gauge({ score = 62, size = 340 }) {
  const cx = 160, cy = 150, r = 120;
  const pt = (ang, rad) => [cx + rad * Math.cos((ang * Math.PI) / 180), cy - rad * Math.sin((ang * Math.PI) / 180)];
  const p0 = pt(180, r), p1 = pt(0, r);
  const needle = pt(180 - 1.8 * score, r - 20);
  const ticks = [];
  for (let s = 0; s <= 100; s += 10) {
    const ang = 180 - 1.8 * s;
    const o = pt(ang, r - 16), inr = pt(ang, r - (s % 50 === 0 ? 28 : 23));
    ticks.push([o, inr, s % 50 === 0]);
  }
  return (
    <svg viewBox="0 0 320 176" width={size} height={(size * 176) / 320} aria-hidden="true">
      <defs>
        <linearGradient id="arc" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#23d18b" />
          <stop offset="27%" stopColor="#8fe04f" />
          <stop offset="50%" stopColor="#f7b737" />
          <stop offset="73%" stopColor="#fb8a3c" />
          <stop offset="100%" stopColor="#f64f68" />
        </linearGradient>
      </defs>
      <path d={`M${p0[0]} ${p0[1]} A${r} ${r} 0 0 1 ${p1[0]} ${p1[1]}`} fill="none" stroke="url(#arc)" strokeWidth="10" strokeLinecap="round" />
      {ticks.map(([o, inr, big], i) => (
        <line key={i} x1={o[0]} y1={o[1]} x2={inr[0]} y2={inr[1]} stroke="#465675" strokeWidth={big ? 2 : 1} />
      ))}
      <line x1={cx} y1={cy} x2={needle[0]} y2={needle[1]} stroke="#e9edf4" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#e9edf4" />
    </svg>
  );
}

const FEATURES = [
  { t: 'One contrarian score', d: 'Eleven weighted signals — VIX & its term structure, breadth, credit spreads, put/call, CNN Fear & Greed and more — distilled into a single 0–100 read.' },
  { t: 'The sentiment calendar', d: 'A year of market emotion at a glance. Every trading day tinted by its score, so fear troughs and greed runs jump out. Tap any day to read it.' },
  { t: 'Plain-English signals', d: 'Tap any indicator for a human read of what it’s saying right now — and what it means for a contrarian, not an instruction manual.' },
  { t: 'Sentiment × price divergence', d: 'Our own signal: when price makes a new high the mood won’t confirm (or a new low it won’t), you see it flagged.' },
  { t: 'Charts + drawing tools', d: 'SPX, NDX, QQQ, VIX and more — with trend lines, rays, fib retracements, moving averages, and a shared time window across every chart.' },
  { t: 'A daily read', d: 'A written contrarian take each day after the close, so you start the next session knowing where the crowd is leaning.' },
];

// Deterministic decorative heatmap (illustrative, not live data).
function heat(s) {
  const stops = [[20, [35, 209, 139]], [40, [150, 224, 79]], [50, [247, 183, 55]], [65, [251, 138, 60]], [82, [246, 79, 104]]];
  let c = stops[stops.length - 1][1];
  if (s <= stops[0][0]) c = stops[0][1];
  else for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (s >= a[0] && s <= b[0]) { const t = (s - a[0]) / (b[0] - a[0]); c = a[1].map((v, k) => Math.round(v + (b[1][k] - v) * t)); break; }
  }
  const inten = Math.min(1, Math.abs(s - 50) / 26);
  return `rgba(${c[0]},${c[1]},${c[2]},${(0.3 + 0.7 * inten).toFixed(2)})`;
}
const DEMO = Array.from({ length: 90 }, (_, i) => 50 + Math.round(28 * Math.sin(i / 3.3) + 10 * Math.sin(i / 1.7)));

export default function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-6 sm:px-6">
      {/* Nav */}
      <nav className="flex items-center justify-between">
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
        <Link href="/" className="rounded-lg border border-dashboard-border bg-dashboard-card px-3.5 py-1.5 font-mono text-[12px] text-dashboard-muted transition-colors hover:border-dashboard-brand/50 hover:text-dashboard-text">
          Open dashboard →
        </Link>
      </nav>

      {/* Hero */}
      <section className="grid items-center gap-8 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
        <div className="animate-fade-up">
          <div className="eyebrow">Contrarian market sentiment · SPX / NDX</div>
          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            The crowd is loudest <span className="text-dashboard-brand">right before the turn.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-dashboard-muted">
            Sentiment Reader distills eleven fear-and-greed signals into one contrarian score, 0–100 — so you can see when the market is too scared to sell and too greedy to buy. Rebuilt every weekday after the U.S. close.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/" className="rounded-lg bg-dashboard-brand px-5 py-2.5 font-mono text-[13px] font-semibold text-[#0a0d14] transition-transform hover:-translate-y-0.5">
              Open the dashboard →
            </Link>
            <span className="font-mono text-[11px] text-dashboard-faint">Free while in beta</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashboard-border bg-gradient-to-b from-dashboard-elevated to-dashboard-card p-8 shadow-card">
          <Gauge score={62} />
          <div className="-mt-4 text-center">
            <span className="font-mono text-6xl font-bold tabular-nums text-dashboard-caution">62</span>
            <span className="ml-1 text-xl font-semibold text-dashboard-faint">/100</span>
            <div className="mt-1 font-mono text-[11px] tracking-[0.2em] text-dashboard-caution">CAUTION · GREED BUILDING</div>
          </div>
        </div>
      </section>

      {/* Thesis */}
      <section className="rounded-2xl border border-dashboard-border bg-dashboard-card p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="eyebrow">How it reads</div>
            <p className="mt-3 text-[15px] leading-relaxed text-dashboard-text">
              It’s <span className="font-semibold">contrarian</span>, so it reads backwards from the mood.
              A <span className="font-semibold text-dashboard-buy">low</span> score means everyone’s fearful — historically where bounces start.
              A <span className="font-semibold text-dashboard-sell">high</span> score means everyone’s greedy — where corrections tend to bite.
              You lean against the extremes.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <div className="h-3 rounded-full" style={{ background: 'linear-gradient(90deg,#23d18b,#8fe04f,#f7b737,#fb8a3c,#f64f68)' }} />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-dashboard-faint">
              <span className="text-dashboard-buy">0 · FEAR / BUY</span>
              <span className="text-dashboard-sell">GREED / SELL · 100</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <h2 className="text-2xl font-bold tracking-tight">Everything in one read.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-xl border border-dashboard-border bg-dashboard-card p-5">
              <div className="h-1 w-8 rounded-full bg-dashboard-brand/70" />
              <h3 className="mt-3 text-[15px] font-semibold">{f.t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-dashboard-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Calendar showcase */}
      <section className="rounded-2xl border border-dashboard-border bg-gradient-to-b from-dashboard-elevated to-dashboard-card p-6 sm:p-8">
        <div className="eyebrow">The sentiment calendar</div>
        <h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight">A year of market emotion, at a glance.</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-dashboard-muted">Every trading day tinted by its contrarian score — extremes glow, neutral days recede.</p>
        <div className="mt-6 overflow-x-auto">
          <div className="inline-grid gap-[3px]" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(5, 1fr)' }}>
            {DEMO.map((s, i) => (
              <div key={i} className="h-[13px] w-[13px] rounded-[3px]" style={{ background: heat(s), border: '1px solid rgba(255,255,255,0.03)' }} />
            ))}
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] text-dashboard-faint">Illustrative — see the live calendar in the dashboard.</p>
      </section>

      {/* Final CTA */}
      <section className="py-20 text-center">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Start reading the market’s mood.</h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] text-dashboard-muted">One contrarian number, the signals behind it, and a year of history — free while it’s in beta.</p>
        <Link href="/" className="mt-7 inline-block rounded-lg bg-dashboard-brand px-6 py-3 font-mono text-[13px] font-semibold text-[#0a0d14] transition-transform hover:-translate-y-0.5">
          Open the dashboard →
        </Link>
      </section>

      <footer className="border-t border-dashboard-hairline py-8 text-center font-mono text-[11px] text-dashboard-faint">
        Sentiment Reader · contrarian sentiment for SPX / NDX · not financial advice
      </footer>
    </main>
  );
}
