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

// 5 tiers: [≤20, 21-40, 41-60, 61-80, >80] — low score = fear/buy, high = greed/sell
const SIGNAL_LABELS = {
  vix:      ['Spike / Opp',     'Elevated / Watch', 'Normal vol',      'Complacent',      'Very complacent'],
  vix_term: ['Inversion / Panic','Stress / Caution', 'Normal',          'Flat / Watch',    'Backwardation'],
  cnn_fg:   ['Extreme Fear',    'Fear / Watch',     'Neutral',         'Greed / Caution', 'Extreme Greed'],
  dxy:      ['USD surge / R-off','USD rising',       'USD stable',      'USD falling',     'USD weak / R-on'],
  rsp_spy:  ['Breadth collapse','Narrow breadth',   'Even breadth',    'Broad advance',   'Very broad'],
  nyse_ad:  ['Breadth crash',   'Neg A/D',          'Mixed A/D',       'Pos A/D',         'Strong breadth'],
  nvda_smh: ['Semi breakdown',  'Semis lagging',    'Semis inline',    'Semis leading',   'Momentum / Froth'],
  spx_gold: ['Gold surge / R-off','Gold outperf.',  'Balanced',        'Equities lead',   'Risk-on surge'],
  hyg_lqd:  ['Credit stress',  'Spreads widening', 'Stable spreads',  'Tightening',      'Credit boom'],
  drawdown: ['Crash territory', 'Major correction', 'Pullback',        'Near highs',      'At / near ATH'],
  pcr:      ['Extreme hedging', 'Hedged / Fearful', 'Normal',          'Call heavy',      'Extreme calls'],
};

function getSignalLabel(key, score) {
  const map = SIGNAL_LABELS[key];
  if (!map) return '';
  const idx = score <= 20 ? 0 : score <= 40 ? 1 : score <= 60 ? 2 : score <= 80 ? 3 : 4;
  return map[idx];
}

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
            <div className="w-24 text-[10px] text-dashboard-muted truncate shrink-0">
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
            <div className="w-8 text-right text-[10px] font-bold shrink-0" style={{ color: getBarColor(score) }}>
              {score}
            </div>
            <div className="w-28 text-[9px] text-dashboard-muted truncate shrink-0">
              {getSignalLabel(key, score)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
