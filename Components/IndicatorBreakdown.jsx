'use client';

import { WEIGHTS } from '../lib/scoring';
import { signalForScore, KEY_TO_GUIDE } from '../lib/guide';

const INDICATOR_LABELS = {
  vix: 'VIX', vix_term: 'VIX Term', cnn_fg: 'Fear & Greed', dxy: 'DXY',
  rsp_spy: 'RSP / SPY', nyse_ad: 'NYSE A/D', nvda_smh: 'NVDA / SMH',
  spx_gold: 'SPX / Gold', hyg_lqd: 'HYG / LQD', drawdown: 'SPX Drawdown', pcr: 'Put/Call Ratio',
};

function getBarColor(score) {
  if (score < 25) return '#22c55e';
  if (score < 45) return '#4ade80';
  if (score < 55) return '#eab308';
  if (score < 70) return '#f97316';
  return '#ef4444';
}

// onExplain(guideLabel, signalName) opens the Reading Guide at that indicator
// with the current state highlighted. Rows without a glossary entry (drawdown)
// still render, just not tappable.
export default function IndicatorBreakdown({ scores, onExplain }) {
  const entries = Object.entries(scores)
    .filter(([key]) => WEIGHTS[key])
    .sort((a, b) => (WEIGHTS[b[0]] || 0) - (WEIGHTS[a[0]] || 0));

  return (
    <div className="bg-gradient-to-br from-dashboard-card to-dashboard-bg border border-dashboard-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] tracking-[3px] text-dashboard-muted">SCORE BREAKDOWN BY WEIGHT</div>
        <div className="text-[8px] text-dashboard-muted font-mono">tap a row to explain ⓘ</div>
      </div>
      <div className="space-y-1">
        {entries.map(([key, score]) => {
          const sig = signalForScore(key, score);
          const guideLabel = KEY_TO_GUIDE[key];
          const barColor = getBarColor(score);
          const Row = (
            <div className="flex items-center gap-3 py-1">
              <div className="w-24 text-[10px] text-dashboard-muted truncate shrink-0 text-left">
                {INDICATOR_LABELS[key] || key}
              </div>
              <div className="flex-1 h-3 bg-dashboard-bg rounded-sm overflow-hidden">
                <div className="h-full rounded-sm transition-all duration-500"
                  style={{ width: `${score}%`, backgroundColor: barColor }} />
              </div>
              <div className="w-8 text-right text-[10px] font-bold shrink-0" style={{ color: barColor }}>
                {score}
              </div>
              <div className="w-28 text-[9px] truncate shrink-0 text-left" style={{ color: sig ? sig.color : '#475569' }}>
                {sig ? sig.signal : ''}
              </div>
            </div>
          );
          return guideLabel && sig ? (
            <button
              key={key}
              onClick={() => onExplain?.(guideLabel, sig.signal)}
              className="w-full rounded-sm hover:bg-dashboard-bg/60 cursor-pointer"
            >
              {Row}
            </button>
          ) : (
            <div key={key}>{Row}</div>
          );
        })}
      </div>
    </div>
  );
}
