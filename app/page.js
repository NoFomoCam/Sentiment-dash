'use client';

import { useState, useEffect } from 'react';
import { loadHistory, loadMarketSymbols, loadMarketSnapshot } from '../lib/supabase';
import { scoreFromRawData, getZone } from '../lib/scoring';
import ScoreGauge from '../Components/ScoreGauge';
import IndicatorBreakdown from '../Components/IndicatorBreakdown';
import SentimentChart from '../Components/SentimentChart';
import SentimentCalendar from '../Components/SentimentCalendar';
import PriceChart from '../Components/PriceChart';
import DivergenceChart from '../Components/DivergenceChart';
import DivergenceSignal from '../Components/DivergenceSignal';
import EdgeStudy from '../Components/EdgeStudy';
import LazySection from '../Components/LazySection';
import { DISCLAIMER_FULL } from '../lib/legal';
import WeeklyBiasChart from '../Components/WeeklyBiasChart';
import ReadingGuide from '../Components/ReadingGuide';

// Default fallback values (Jun 9 2026) — only used if market_data can't load.
const FALLBACK = {
  vix: 19.88, vix_prev: 18.93,
  vix9d: 24.28, vix9d_prev: 20.60,
  vix3m: 21.31, vix3m_prev: 20.79,
  dxy: 99.972, dxy_prev: 100.00,
  spy: 737.05, spy_prev: 739.22,
  spx: 7386.66, spx_prev: 7405.72,
  rsp: 209.19, rsp_prev: 207.61,
  nvda: 208.19, nvda_prev: 208.64,
  smh: 591.01, smh_prev: 598.16,
  gld: 390.78, gld_prev: 397.27,
  hyg: 79.62, hyg_prev: 79.54,
  lqd: 108.41, lqd_prev: 108.06,
  nyad: 716, nyad_prev: -126,
  fear_greed: 33, fear_greed_prev: 40,
  pcr: 0.67, pcr_prev: 0.44,
};

// Map market_data series -> scoring input key.
// VSTN is Cam's established short-term-vol input (fills the vix9d/term-structure slot).
// FG (CNN Fear&Greed composite) and PCR (raw put/call) are stored as their own
// market_data series (source=cnn), so all 11 indicators compute from real data.
const SYMBOL_MAP = {
  VIX: 'vix', VSTN: 'vix9d', VIX3M: 'vix3m', DXY: 'dxy', SPY: 'spy',
  SPX: 'spx', RSP: 'rsp', NVDA: 'nvda', SMH: 'smh', GLD: 'gld',
  HYG: 'hyg', LQD: 'lqd', ADD: 'nyad', FG: 'fear_greed', PCR: 'pcr',
};

// Build a FALLBACK-shaped reading from real market_data snapshot.
// Returns { data, asOf, spxCloses } or null if there isn't enough data.
function snapshotToLiveData(snap) {
  if (!snap || !snap.SPX || snap.SPX.length < 2) return null;
  const data = { fear_greed: null, fear_greed_prev: null, pcr: null, pcr_prev: null };
  for (const [sym, key] of Object.entries(SYMBOL_MAP)) {
    const arr = snap[sym];
    if (!arr || arr.length === 0) continue;
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2] || last;
    data[key] = last.close;
    data[`${key}_prev`] = prev.close;
  }
  return {
    data,
    asOf: snap.SPX[snap.SPX.length - 1].date,
    spxCloses: snap.SPX.map(r => r.close),
  };
}

// Deterministic contrarian read straight from the scores — shown until the
// cron's Claude brief is available (needs Anthropic credits). Upgrades silently
// to the AI read once one is stored for the day.
const READ_NAMES = {
  vix: 'VIX', vix_term: 'VIX term structure', cnn_fg: 'Fear & Greed', dxy: 'the dollar',
  rsp_spy: 'breadth (RSP/SPY)', nyse_ad: 'NYSE A/D', nvda_smh: 'NVDA/SMH', spx_gold: 'SPX/Gold',
  hyg_lqd: 'credit (HYG/LQD)', drawdown: 'SPX drawdown', pcr: 'put/call',
};
function ruleBasedRead(score, zone, scores) {
  const buys = Object.entries(scores).filter(([k, v]) => v <= 25 && READ_NAMES[k]).map(([k]) => READ_NAMES[k]);
  const sells = Object.entries(scores).filter(([k, v]) => v >= 75 && READ_NAMES[k]).map(([k]) => READ_NAMES[k]);
  let s = `Composite reads ${score}/100 — ${(zone.label || '').toLowerCase()}. `;
  if (buys.length) s += `Strongest fear signals (contrarian buy lean): ${buys.join(', ')}. `;
  if (sells.length) s += `Greed / complacency to watch: ${sells.join(', ')}. `;
  s += score < 40
    ? 'Overall the setup leans toward a bounce / relief into the next session.'
    : score > 65
      ? 'Overall the setup leans toward elevated correction risk — tighten up.'
      : 'No strong directional edge — wait for price confirmation before committing.';
  return s;
}

// Weekday distance from a data date to today; data auto-refreshes each weekday
// after the close, so a healthy reading is <=1 trading day behind.
function tradingDaysBehind(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
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

// Gauge logo mark (matches the favicon).
function BrandMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#10151f" stroke="#22304a" />
      <g fill="none" strokeWidth="3.2" strokeLinecap="round">
        <path d="M6 21 A10 10 0 0 1 11 12.34" stroke="#23d18b" />
        <path d="M11 12.34 A10 10 0 0 1 21 12.34" stroke="#f7b737" />
        <path d="M21 12.34 A10 10 0 0 1 26 21" stroke="#f64f68" />
      </g>
      <line x1="16" y1="21" x2="18.2" y2="12.9" stroke="#e9edf4" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2.1" fill="#e9edf4" />
    </svg>
  );
}

// Slim bar that slides in on scroll so the current score stays in view.
function StickyScore({ score, zone }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 340);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 border-b border-dashboard-border bg-dashboard-bg/90 backdrop-blur transition-transform duration-200 ${show ? 'translate-y-0' : '-translate-y-full'}`}
      aria-hidden={!show}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <BrandMark size={18} />
          <span className="text-[12px] font-semibold text-dashboard-text">Sentiment Reader</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold leading-none tabular-nums" style={{ color: zone.color }}>{score}</span>
          <span className="font-mono text-[10px] tracking-wide" style={{ color: zone.color }}>{zone.label}</span>
        </div>
      </div>
    </div>
  );
}

// Data-freshness badge: green live / amber behind / amber fallback.
function FreshnessPill({ usingFallback, behind, dataDate, refreshing }) {
  if (usingFallback) {
    return (
      <span className="pill text-dashboard-caution" style={{ borderColor: '#fb8a3c55', background: '#fb8a3c14' }}>
        ⚠ Fallback values
      </span>
    );
  }
  if (behind <= 1) {
    return (
      <span className="pill text-dashboard-buy" style={{ borderColor: '#23d18b44', background: '#23d18b12' }}>
        <span className="h-1.5 w-1.5 rounded-full bg-dashboard-buy" style={{ boxShadow: '0 0 8px #23d18b' }} />
        Live · {dataDate}{refreshing && ' · ↻'}
      </span>
    );
  }
  return (
    <span className="pill text-dashboard-caution" style={{ borderColor: '#fb8a3c55', background: '#fb8a3c14' }}>
      ⚠ {behind}d behind · {dataDate}
    </span>
  );
}

function Divider({ children }) {
  return (
    <div className="mb-3 mt-9 flex items-center gap-3">
      <div className="h-px flex-1 bg-dashboard-hairline" />
      <span className="eyebrow">{children}</span>
      <div className="h-px flex-1 bg-dashboard-hairline" />
    </div>
  );
}

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-dashboard-border bg-dashboard-card ' +
  'px-3 py-1.5 font-mono text-[11px] tracking-wide text-dashboard-muted transition-colors ' +
  'hover:border-dashboard-brand/50 hover:text-dashboard-text disabled:opacity-50 disabled:cursor-not-allowed';

// One shared date-window drives every chart on the page.
const WINDOWS = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];
function WindowPicker({ win, setWin }) {
  return (
    <div className="flex items-center gap-1">
      <span className="eyebrow mr-1 hidden sm:inline">Window</span>
      {WINDOWS.map((w) => (
        <button
          key={w}
          onClick={() => setWin(w)}
          className={`rounded-md border px-2.5 py-1 font-mono text-[11px] tracking-wide transition-colors ${
            win === w
              ? 'border-dashboard-brand/60 bg-dashboard-brand/15 text-dashboard-brand'
              : 'border-dashboard-border text-dashboard-muted hover:text-dashboard-text'
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [history, setHistory] = useState([]);
  const [score, setScore] = useState(0);         // single composite (full 11 indicators)
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [symbols, setSymbols] = useState([]);
  const [dataDate, setDataDate] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [guideTarget, setGuideTarget] = useState(null); // { label, signal } or null
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [win, setWin] = useState('6M');   // shared date-window across all charts

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (reloadKey > 0) setRefreshing(true);
      let hist = [];
      try {
        hist = await loadHistory();
        if (!cancelled && hist.length > 0) {
          setHistory(hist);
          // The day's brief is generated + stored by the daily cron; show the latest.
          const latest = hist[hist.length - 1];
          if (latest?.brief) setBrief(latest.brief);
        }
      } catch (e) {
        console.error('Failed to load history:', e);
      }

      // Compute today's score from real market_data; fall back to hardcoded values.
      let baseData = FALLBACK;
      let spxCloses = null;
      try {
        const snap = await loadMarketSnapshot();
        const built = snapshotToLiveData(snap);
        if (built) {
          baseData = built.data;
          spxCloses = built.spxCloses;
          if (!cancelled) { setDataDate(built.asOf); setUsingFallback(false); }
        } else if (!cancelled) {
          setUsingFallback(true); // real data present but too thin to build a reading
        }
      } catch (e) {
        console.error('Failed to load market snapshot:', e);
        if (!cancelled) setUsingFallback(true);
      }

      if (!cancelled) computeScores(baseData, hist, spxCloses);
      if (!cancelled) { setLoading(false); setRefreshing(false); }

      try {
        const syms = await loadMarketSymbols();
        if (!cancelled && syms.length > 0) setSymbols(syms);
      } catch (e) {
        console.error('Failed to load symbols:', e);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // The single score is the full composite (all 11 indicators, incl. PCR).
  function computeScores(data, currentHistory, spxCloses) {
    const hist = currentHistory ?? history;
    const num = v => (v == null || v === '' ? null : Number(v));
    const today = {
      vix: Number(data.vix), vix9d: Number(data.vix9d), vix3m: Number(data.vix3m),
      dxy: Number(data.dxy), spy: Number(data.spy), spx: Number(data.spx),
      rsp: Number(data.rsp), nvda: Number(data.nvda), smh: Number(data.smh),
      gld: Number(data.gld), hyg: Number(data.hyg), lqd: Number(data.lqd),
      nyad: Number(data.nyad), fear_greed: num(data.fear_greed), pcr: num(data.pcr),
    };
    const prev = {
      vix: Number(data.vix_prev), spy: Number(data.spy_prev), spx: Number(data.spx_prev),
      dxy: Number(data.dxy_prev), rsp: Number(data.rsp_prev),
      nvda: Number(data.nvda_prev), smh: Number(data.smh_prev),
      gld: Number(data.gld_prev), hyg: Number(data.hyg_prev), lqd: Number(data.lqd_prev),
    };

    let spxSeries = spxCloses && spxCloses.length ? spxCloses : hist.filter(h => h.spx).map(h => h.spx);
    spxSeries = spxSeries.slice(-50);
    const spx50High = spxSeries.length ? Math.max(...spxSeries, today.spx) : today.spx;
    const ddPct = spx50High > 0 ? ((today.spx / spx50High) - 1) * 100 : 0;

    const result = scoreFromRawData(today, prev, { drawdownPct: ddPct, includeEod: true });
    setScores(result.scores);
    setScore(result.eodScore);
    return result;
  }

  const zone = getZone(score);
  const behind = tradingDaysBehind(dataDate);
  // Where today's score sits vs the past ~year (context for the number).
  const yearScores = history.slice(-252).map((h) => h.eod_score ?? h.live_score).filter((v) => v != null).map(Number);
  const percentile = yearScores.length >= 20
    ? Math.round((100 * yearScores.filter((v) => v <= score).length) / yearScores.length)
    : null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-dashboard-muted">
        <BrandMark size={26} />
        <span className="font-mono text-sm">Loading sentiment…</span>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <StickyScore score={score} zone={zone} />
      {showGuide && (
        <ReadingGuide
          onClose={() => setShowGuide(false)}
          openLabel={guideTarget?.label}
          highlightSignal={guideTarget?.signal}
        />
      )}

      {/* Brand bar */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <h1 className="text-lg font-bold leading-none tracking-tight">Sentiment Reader</h1>
            <div className="eyebrow mt-1.5">Contrarian · SPX / NDX</div>
          </div>
        </div>
        <FreshnessPill usingFallback={usingFallback} behind={behind} dataDate={dataDate} refreshing={refreshing} />
      </header>

      {/* Workspace controls: shared window + utilities */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <WindowPicker win={win} setWin={setWin} />
        <div className="flex gap-2">
          <button onClick={() => { setGuideTarget(null); setShowGuide(true); }} className={ghostBtn}>
            ? Rules &amp; definitions
          </button>
          <button onClick={() => setReloadKey((k) => k + 1)} disabled={refreshing} className={ghostBtn}>
            {refreshing ? '↻ …' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Chart-first workspace: price chart centerpiece + sentiment readout rail */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 lg:order-1">
          <PriceChart symbols={symbols} defaultSymbol="SPX" win={win} height={520} history={history} />
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <ScoreGauge label="Sentiment Score" sublabel="Full 11-indicator composite" score={score} zone={zone} percentile={percentile} />

          <section className="surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="eyebrow">Today&apos;s contrarian read</div>
              <span
                className={`pill ${brief ? 'text-dashboard-buy' : 'text-dashboard-faint'}`}
                style={brief ? { borderColor: '#23d18b44', background: '#23d18b12' } : { borderColor: '#22304a' }}
              >
                {brief ? (<><span className="h-1.5 w-1.5 rounded-full bg-dashboard-buy" />AI read</>) : 'Auto'}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-dashboard-text">
              {brief || ruleBasedRead(score, zone, scores)}
            </p>
            {!brief && (
              <p className="mt-2.5 text-[11px] italic leading-relaxed text-dashboard-faint">
                Auto-generated from the indicator scores. A written Claude read posts here each day once the API has credit.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Indicator breakdown (full width) */}
      <div className="mt-4">
        <IndicatorBreakdown
          scores={scores}
          onExplain={(label, signal) => { setGuideTarget({ label, signal }); setShowGuide(true); }}
        />
      </div>

      {/* Our own signal: sentiment vs price divergence */}
      <div className="mt-4">
        <DivergenceSignal history={history} />
      </div>

      {/* Sentiment history — driven by the shared window */}
      <div className="mt-4">
        <SentimentChart history={history} win={win} />
      </div>

      <Divider>The edge</Divider>
      <LazySection minHeight={560}><EdgeStudy history={history} /></LazySection>

      <Divider>Sentiment calendar</Divider>
      <LazySection minHeight={480}><SentimentCalendar history={history} /></LazySection>

      <Divider>Divergence analysis</Divider>
      <LazySection minHeight={440}><DivergenceChart /></LazySection>

      <Divider>This week</Divider>
      <LazySection minHeight={320}><WeeklyBiasChart history={history} /></LazySection>

      {/* Footer */}
      <footer className="mt-10 border-t border-dashboard-hairline pt-5 text-center">
        <div className="flex items-center justify-center gap-2 text-dashboard-muted">
          <BrandMark size={18} />
          <span className="text-[12px] font-semibold text-dashboard-text">Sentiment Reader</span>
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-dashboard-faint">
          Auto-updates each weekday after the U.S. close · ~6PM ET
          {dataDate && <> · latest {dataDate}</>}
          <br />
          Not financial advice ·{' '}
          <a href="/status" className="text-dashboard-muted underline decoration-dashboard-border underline-offset-2 hover:text-dashboard-brand">
            System status
          </a>
        </p>
        <p className="mx-auto mt-3 max-w-2xl font-mono text-[9px] leading-relaxed text-dashboard-faint/80">
          {DISCLAIMER_FULL}
        </p>
      </footer>
    </main>
  );
}
