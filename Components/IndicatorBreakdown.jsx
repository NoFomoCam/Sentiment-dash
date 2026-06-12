'use client';

import { WEIGHTS } from '../lib/scoring';

const INDICATOR_LABELS = {
  vix: 'VIX',
  vix_term: 'VIX Term',
  cnn_fg: 'Fear & Greed',
  dxy: 'DXY',
  rsp_spy: 'RSP / SPY',
  nyse_ad: 'NYSE A/D',
  nvda_smh: 'NVDA / SMH',
  spx_gold: 'SPX / Gold',
  hyg_lqd: 'HYG / LQD',
  drawdown: 'SPX Drawdown',
  pcr: 'Put/Call Ratio',
};

function getBarColor(score) {
  if (score < 25) return '#22c55e';
  if (score < 45) return '#4ade80';
  if (score < 55) return '#eab308';
  if (score < 70) return '#f97316';
  return '#ef4444';
}

export default function IndicatorBreakdown({ scores }) {
  const entries = Object.entries(scores)
    .filter(([key]) => WEIGHTS[key])
    .sort((a, b) => (WEIGHTS[b[0]] || 0) - (WEIGHTS[a[0]] || 0));

  return (
    <div className="bg-gradient-to-br from-dashboard-card to-dashboard-bg border border-dashboard-border rounded-lg p-4">
      <div className="text-[9px] tracking-[3px] text-dashboard-muted mb-3">
        SCORE BREAKDOWN BY WEIGHT
      </div>
      <div className="space-y-2">
        {entries.map(([key, score]) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-24 text-[10px] text-dashboard-muted truncate">
              {INDICATOR_LABELS[key] || key}
            </div>
            <div className="flex-1 h-3 bg-dashboard-bg rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-500"
                style={{
                  width: `${score}%`,
                  backgroundColor: getBarColor(score),
                }}
              />
            </div>
            <div className="w-8 text-right text-[10px] font-bold" style={{ color: getBarColor(score) }}>
              {score}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
