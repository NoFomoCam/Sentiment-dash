'use client';

import { useState, useEffect } from 'react';
import { loadHistory, saveDailyReading } from '../lib/supabase';
import { scoreFromRawData, getZone } from '../lib/scoring';
import ScoreGauge from '../components/ScoreGauge';
import IndicatorBreakdown from '../components/IndicatorBreakdown';
import SentimentChart from '../components/SentimentChart';
import ManualInput from '../components/ManualInput';

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

export default function Dashboard() {
  const [liveData, setLiveData] = useState(null);
  const [history, setHistory] = useState([]);
  const [liveScore, setLiveScore] = useState(0);
  const [eodScore, setEodScore] = useState(0);
  const [scores, setScores] = useState({});
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load history from Supabase on mount
  useEffect(() => {
    async function init() {
      try {
        const hist = await loadHistory();
        if (hist.length > 0) setHistory(hist);
      } catch (e) {
        console.error('Failed to load history:', e);
      }

      // Compute initial scores from fallback
      computeScores(FALLBACK);
      setLiveData(FALLBACK);
      setLoading(false);
    }
    init();
  }, []);

  function computeScores(data) {
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

    // Compute drawdown from history
    const spxHist = history.filter(h => h.spx).slice(-50).map(h => h.spx);
    const spx50High = spxHist.length ? Math.max(...spxHist, today.spx) : today.spx;
    const ddPct = spx50High > 0 ? ((today.spx / spx50High) - 1) * 100 : 0;

    const result = scoreFromRawData(today, prev, { drawdownPct: ddPct, includeEod: true });
    setScores(result.scores);
    setLiveScore(result.liveScore);
    setEodScore(result.eodScore);
  }

  function handleManualUpdate(updated) {
    setLiveData(updated);
    computeScores(updated);

    // Save to Supabase
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    saveDailyReading({
      date: dateStr,
      liveScore, eodScore,
      vix: updated.vix, vix9d: updated.vix9d, vix3m: updated.vix3m,
      dxy: updated.dxy, spy: updated.spy, spx: updated.spx,
      rsp: updated.rsp, nvda: updated.nvda, smh: updated.smh,
      gld: updated.gld, hyg: updated.hyg, lqd: updated.lqd,
      nyad: updated.nyad, fear_greed: updated.fear_greed, pcr: updated.pcr,
    }).catch(console.error);
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
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setShowInput(!showInput)}
          className="px-4 py-2 bg-dashboard-buy/20 border border-dashboard-buy text-dashboard-buy 
                     font-mono text-xs tracking-wider rounded cursor-pointer hover:bg-dashboard-buy/30"
        >
          ✎ ENTER LIVE VALUES
        </button>
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

      {/* Sentiment Chart - TradingView Lightweight Charts */}
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
