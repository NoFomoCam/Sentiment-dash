'use client';

import { useState, useEffect } from 'react';
import { loadHistory, saveDailyReading, loadMarketSymbols, loadMarketSnapshot } from '../lib/supabase';
import { scoreFromRawData, getZone } from '../lib/scoring';
import ScoreGauge from '../Components/ScoreGauge';
import IndicatorBreakdown from '../Components/IndicatorBreakdown';
import SentimentChart from '../Components/SentimentChart';
import PriceChart from '../Components/PriceChart';
import ManualInput from '../Components/ManualInput';

// Default fallback values (Jun 9 2026)
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
// market_data series (source=cnn), so all 11 indicators now compute from real data.
const SYMBOL_MAP = {
  VIX: 'vix', VSTN: 'vix9d', VIX3M: 'vix3m', DXY: 'dxy', SPY: 'spy',
  SPX: 'spx', RSP: 'rsp', NVDA: 'nvda', SMH: 'smh', GLD: 'gld',
  HYG: 'hyg', LQD: 'lqd', ADD: 'nyad', FG: 'fear_greed', PCR: 'pcr',
};

// Build a FALLBACK-shaped live reading from real market_data snapshot.
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

const BRIEF_CACHE_KEY = 'sentiment_brief';

export default function Dashboard() {
  const [liveData, setLiveData] = useState(null);
  const [history, setHistory] = useState([]);
  const [liveScore, setLiveScore] = useState(0);
  const [eodScore, setEodScore] = useState(0);
  const [scores, setScores] = useState({});
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brief, setBrief] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [symbols, setSymbols] = useState([]);
  const [dataDate, setDataDate] = useState(null);
  const [liveFromRealData, setLiveFromRealData] = useState(false);

  // Load history and restore cached brief on mount
  useEffect(() => {
    async function init() {
      let hist = [];
      try {
        hist = await loadHistory();
        if (hist.length > 0) setHistory(hist);
      } catch (e) {
        console.error('Failed to load history:', e);
      }

      // Build today's live reading from real market_data; fall back to hardcoded values.
      let baseData = FALLBACK;
      let spxCloses = null;
      try {
        const snap = await loadMarketSnapshot();
        const built = snapshotToLiveData(snap);
        if (built) {
          baseData = built.data;
          spxCloses = built.spxCloses;
          setDataDate(built.asOf);
          setLiveFromRealData(true);
        }
      } catch (e) {
        console.error('Failed to load market snapshot:', e);
      }

      computeScores(baseData, hist, spxCloses);
      setLiveData(baseData);
      setLoading(false);

      // Populate the price-chart symbol selector from market_data
      try {
        const syms = await loadMarketSymbols();
        if (syms.length > 0) setSymbols(syms);
      } catch (e) {
        console.error('Failed to load symbols:', e);
      }

      // Restore today's brief from localStorage
      try {
        const cached = JSON.parse(localStorage.getItem(BRIEF_CACHE_KEY) || 'null');
        const today = new Date().toISOString().split('T')[0];
        if (cached?.date === today && cached?.brief) {
          setBrief(cached.brief);
        }
      } catch {}
    }
    init();
  }, []);

  // Returns the computed result so callers can use values immediately (not stale state)
  // fear_greed / pcr are kept null-able so a missing source excludes them from the composite.
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

    // Prefer a real SPX close series (from market_data) for the drawdown window.
    let spxSeries = spxCloses && spxCloses.length ? spxCloses : hist.filter(h => h.spx).map(h => h.spx);
    spxSeries = spxSeries.slice(-50);
    const spx50High = spxSeries.length ? Math.max(...spxSeries, today.spx) : today.spx;
    const ddPct = spx50High > 0 ? ((today.spx / spx50High) - 1) * 100 : 0;

    const result = scoreFromRawData(today, prev, { drawdownPct: ddPct, includeEod: true });
    setScores(result.scores);
    setLiveScore(result.liveScore);
    setEodScore(result.eodScore);
    return result;
  }

  async function handleManualUpdate(updated) {
    setLiveData(updated);
    const result = computeScores(updated);

    const dateStr = updated.date || new Date().toISOString().split('T')[0];

    setSaving(true);
    try {
      await saveDailyReading({
        date: dateStr,
        liveScore: result.liveScore,
        eodScore: result.eodScore,
        vix: updated.vix, vix9d: updated.vix9d, vix3m: updated.vix3m,
        dxy: updated.dxy, spy: updated.spy, spx: updated.spx,
        rsp: updated.rsp, nvda: updated.nvda, smh: updated.smh,
        gld: updated.gld, hyg: updated.hyg, lqd: updated.lqd,
        nyad: updated.nyad, fear_greed: updated.fear_greed, pcr: updated.pcr,
      });
      const hist = await loadHistory();
      if (hist.length > 0) setHistory(hist);
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  }

  async function generateBrief(currentScores, currentLive, currentEod) {
    setBriefLoading(true);
    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          liveScore: currentLive,
          eodScore: currentEod,
          scores: currentScores,
        }),
      });
      const data = await res.json();
      if (data.brief) {
        setBrief(data.brief);
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(BRIEF_CACHE_KEY, JSON.stringify({ date: today, brief: data.brief }));
      }
    } catch (e) {
      console.error('Brief error:', e);
    } finally {
      setBriefLoading(false);
    }
  }

  const liveZone = getZone(liveScore);
  const eodZone = getZone(eodScore);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dashboard-muted font-mono text-sm">Loading sentiment data...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-4 py-6">
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
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <button
          onClick={() => setShowInput(!showInput)}
          className="px-4 py-2 bg-dashboard-buy/20 border border-dashboard-buy text-dashboard-buy
                     font-mono text-xs tracking-wider rounded cursor-pointer hover:bg-dashboard-buy/30"
        >
          ✎ ENTER LIVE VALUES
        </button>
        {saving && (
          <span className="text-[10px] text-dashboard-muted font-mono tracking-wider animate-pulse">
            SAVING...
          </span>
        )}
      </div>

      {/* Manual Input Panel */}
      {showInput && (
        <ManualInput
          current={liveData || FALLBACK}
          onUpdate={handleManualUpdate}
          onClose={() => setShowInput(false)}
        />
      )}

      {/* Score Gauges */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <ScoreGauge label="LIVE SCORE" sublabel="EXCLUDES PCR" score={liveScore} zone={liveZone} />
        <ScoreGauge label="EOD SCORE" sublabel="INCL. PCR" score={eodScore} zone={eodZone} />
      </div>

      {/* Indicator Breakdown */}
      <IndicatorBreakdown scores={scores} />

      {/* AI Brief */}
      <div className="mt-4 bg-gradient-to-br from-dashboard-card to-dashboard-bg border border-dashboard-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[9px] tracking-[3px] text-dashboard-muted">TODAY'S BRIEF</div>
          <button
            onClick={() => generateBrief(scores, liveScore, eodScore)}
            disabled={briefLoading}
            className="px-3 py-1 bg-dashboard-buy/10 border border-dashboard-buy/40 text-dashboard-buy
                       font-mono text-[10px] tracking-wider rounded cursor-pointer
                       hover:bg-dashboard-buy/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {briefLoading ? 'GENERATING...' : brief ? '↺ REGENERATE' : '▶ GENERATE'}
          </button>
        </div>
        {brief ? (
          <p className="text-[11px] text-dashboard-text leading-relaxed">{brief}</p>
        ) : (
          <p className="text-[10px] text-dashboard-muted italic">
            Click GENERATE for a contrarian read of today's setup.
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

      {/* Footer */}
      <div className="mt-8 text-center text-[9px] text-dashboard-muted tracking-wider">
        V2.0 · NOT FINANCIAL ADVICE
      </div>
    </main>
  );
}

