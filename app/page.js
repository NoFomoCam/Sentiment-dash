'use client';

import { useState, useEffect } from 'react';
import { loadHistory, saveDailyReading } from '../lib/supabase';
import { scoreFromRawData, getZone } from '../lib/scoring';
import ScoreGauge from '../Components/ScoreGauge';
import IndicatorBreakdown from '../Components/IndicatorBreakdown';
import SentimentChart from '../Components/SentimentChart';
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

  // Load history and restore cached brief on mount
  useEffect(() => {
    async function init() {
      try {
        const hist = await loadHistory();
        if (hist.length > 0) setHistory(hist);
      } catch (e) {
        console.error('Failed to load history:', e);
      }

      computeScores(FALLBACK, hist);
      setLiveData(FALLBACK);
      setLoading(false);

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
  function computeScores(data, currentHistory) {
    const hist = currentHistory ?? history;
    const today = {
      vix: Number(data.vix), vix9d: Number(data.vix9d), vix3m: Number(data.vix3m),
      dxy: Number(data.dxy), spy: Number(data.spy), spx: Number(data.spx),
      rsp: Number(data.rsp), nvda: Number(data.nvda), smh: Number(data.smh),
      gld: Number(data.gld), hyg: Number(data.hyg), lqd: Number(data.lqd),
      nyad: Number(data.nyad), fear_greed: Number(data.fear_greed), pcr: Number(data.pcr),
    };
    const prev = {
      vix: Number(data.vix_prev), spy: Number(data.spy_prev), spx: Number(data.spx_prev),
      dxy: Number(data.dxy_prev), rsp: Number(data.rsp_prev),
      nvda: Number(data.nvda_prev), smh: Number(data.smh_prev),
      gld: Number(data.gld_prev), hyg: Number(data.hyg_prev), lqd: Number(data.lqd_prev),
    };

    const spxHist = hist.filter(h => h.spx).slice(-50).map(h => h.spx);
    const spx50High = spxHist.length ? Math.max(...spxHist, today.spx) : today.spx;
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
