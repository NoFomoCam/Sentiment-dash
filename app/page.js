'use client';

import { useState, useEffect } from 'react';
import { loadHistory, loadMarketSymbols, loadMarketSnapshot } from '../lib/supabase';
import { scoreFromRawData, getZone } from '../lib/scoring';
import ScoreGauge from '../Components/ScoreGauge';
import IndicatorBreakdown from '../Components/IndicatorBreakdown';
import SentimentChart from '../Components/SentimentChart';
import PriceChart from '../Components/PriceChart';
import DivergenceChart from '../Components/DivergenceChart';
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

  useEffect(() => {
    async function init() {
      let hist = [];
      try {
        hist = await loadHistory();
        if (hist.length > 0) {
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
          setDataDate(built.asOf);
        }
      } catch (e) {
        console.error('Failed to load market snapshot:', e);
      }

      computeScores(baseData, hist, spxCloses);
      setLoading(false);

      try {
        const syms = await loadMarketSymbols();
        if (syms.length > 0) setSymbols(syms);
      } catch (e) {
        console.error('Failed to load symbols:', e);
      }
    }
    init();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dashboard-muted font-mono text-sm">Loading sentiment data...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-4 py-6">
      {showGuide && (
        <ReadingGuide
          onClose={() => setShowGuide(false)}
          openLabel={guideTarget?.label}
          highlightSignal={guideTarget?.signal}
        />
      )}
      {/* Header */}
      <div className="dashboard-header mb-6">
        <div className="text-[9px] tracking-[3px] text-dashboard-muted mb-1">
          SPX / NDX PRODUCTS
        </div>
        <h1 className="text-2xl font-extrabold tracking-wider">
          MARKET SENTIMENT CONSOLE
        </h1>
        {dataDate && (
          <div className="mt-1 text-[9px] font-mono tracking-wider text-dashboard-muted">
            <span className="text-dashboard-buy">● LIVE DATA</span> · AS OF {dataDate} ·
            {' '}11/11 INDICATORS LIVE
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => { setGuideTarget(null); setShowGuide(true); }}
          className="px-3 py-1.5 bg-dashboard-card border border-dashboard-border text-dashboard-muted
                     font-mono text-[10px] tracking-wider rounded cursor-pointer hover:text-dashboard-text hover:border-dashboard-muted"
        >
          ? RULES / DEFINITIONS
        </button>
      </div>

      {/* Score gauge — single composite */}
      <div className="mb-6">
        <ScoreGauge label="SENTIMENT SCORE" sublabel="FULL 11-INDICATOR COMPOSITE" score={score} zone={zone} />
      </div>

      {/* Indicator Breakdown */}
      <IndicatorBreakdown
        scores={scores}
        onExplain={(label, signal) => { setGuideTarget({ label, signal }); setShowGuide(true); }}
      />

      {/* Contrarian read — Claude brief when available, else rule-based from the numbers */}
      <div className="mt-4 bg-gradient-to-br from-dashboard-card to-dashboard-bg border border-dashboard-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[9px] tracking-[3px] text-dashboard-muted">TODAY&apos;S CONTRARIAN READ</div>
          <span className={`font-mono text-[8px] tracking-wider px-1.5 py-0.5 rounded border ${
            brief ? 'text-dashboard-buy border-dashboard-buy/40 bg-dashboard-buy/10'
                  : 'text-dashboard-muted border-dashboard-border'}`}>
            {brief ? '● AI READ' : 'AUTO'}
          </span>
        </div>
        <p className="text-[11px] text-dashboard-text leading-relaxed">
          {brief || ruleBasedRead(score, zone, scores)}
        </p>
        {!brief && (
          <p className="mt-2 text-[9px] text-dashboard-muted italic">
            Auto-generated from the indicator scores. A written Claude read posts here each day once the API has credit.
          </p>
        )}
      </div>

      {/* Price Charts (raw market data) */}
      <div className="mt-6">
        <PriceChart symbols={symbols} defaultSymbol="VIX" />
      </div>

      {/* Sentiment Chart */}
      <div className="mt-6">
        <SentimentChart history={history} />
      </div>

      {/* Divergence analysis (separate from the candlestick price charts) */}
      <div className="mt-6 mb-2 flex items-center gap-3">
        <div className="flex-1 h-px bg-dashboard-border" />
        <span className="font-mono text-[9px] text-dashboard-muted tracking-wider">DIVERGENCE ANALYSIS</span>
        <div className="flex-1 h-px bg-dashboard-border" />
      </div>
      <DivergenceChart />

      {/* This week — rolling 5-day bias */}
      <div className="mt-6 mb-2 flex items-center gap-3">
        <div className="flex-1 h-px bg-dashboard-border" />
        <span className="font-mono text-[9px] text-dashboard-muted tracking-wider">THIS WEEK</span>
        <div className="flex-1 h-px bg-dashboard-border" />
      </div>
      <WeeklyBiasChart history={history} />

      {/* Footer */}
      <div className="mt-8 text-center text-[9px] text-dashboard-muted tracking-wider leading-relaxed">
        DATA AUTO-UPDATES EACH WEEKDAY AFTER THE U.S. CLOSE
        {' · '}~6PM ET (7PM DURING DAYLIGHT TIME)
        {dataDate && <> · LATEST {dataDate}</>}
        <br />V2.0 · NOT FINANCIAL ADVICE
        {' · '}
        <a href="/status" className="underline hover:text-dashboard-text">SYSTEM STATUS</a>
      </div>
    </main>
  );
}
