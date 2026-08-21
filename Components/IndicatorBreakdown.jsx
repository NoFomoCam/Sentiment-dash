'use client';

import { WEIGHTS } from '../lib/scoring';
import { signalForScore, KEY_TO_GUIDE } from '../lib/guide';

const INDICATOR_LABELS = {
  vix: 'VIX', vix_term: 'VIX Term', cnn_fg: 'Fear & Greed', dxy: 'DXY',
  rsp_spy: 'RSP / SPY', nyse_ad: 'NYSE A/D', nvda_smh: 'NVDA / SMH',
  spx_gold: 'SPX / Gold', hyg_lqd: 'HYG / LQD', drawdown: 'SPX Drawdown', pcr: 'Put/Call Ratio',
};

function getBarColor(score) {
  if (score < 25) return '#23d18b';
  if (score < 45) return '#8fe04f';
  if (score < 55) return '#f7b737';
  if (score < 70) return '#fb8a3c';
  return '#f64f68';
}

// onExplain(guideLabel, signalName) opens the Reading Guide at that indicator
// with the current state highlighted. Rows without a glossary entry (drawdown)
// still render, just not tappable.
export default function IndicatorBreakdown({ scores, onExplain }) {
  const entries = Object.entries(scores)
    .filter(([key]) => WEIGHTS[key])
    .sort((a, b) => (WEIGHTS[b[0]] || 0) - (WEIGHTS[a[0]] || 0));

  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="eyebrow">Score breakdown · by weight</div>
        <div className="font-mono text-[10px] text-dashboard-faint">tap a row ⓘ</div>
      </div>

      <div className="divide-y divide-dashboard-hairline">
        {entries.map(([key, score]) => {
          const sig = signalForScore(key, score);
          const guideLabel = KEY_TO_GUIDE[key];
          const barColor = getBarColor(score);
          const tappable = guideLabel && sig;

          const Row = (
            <div className="py-2.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-left text-[12px] font-medium text-dashboard-text">
                  {INDICATOR_LABELS[key] || key}
                </span>
                <span
                  className="shrink-0 text-right text-[11px] font-semibold"
                  style={{ color: sig ? sig.color : '#586a86' }}
                >
                  {sig ? sig.signal : ''}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-dashboard-bg ring-1 ring-inset ring-dashboard-hairline">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${score}%`, backgroundColor: barColor, boxShadow: `0 0 10px ${barColor}66` }}
                  />
                </div>
                <span
                  className="w-7 shrink-0 text-right text-[13px] font-bold tabular-nums"
                  style={{ color: barColor }}
                >
                  {score}
                </span>
              </div>
            </div>
          );

          return tappable ? (
            <button
              key={key}
              onClick={() => onExplain?.(guideLabel, sig.signal)}
              className="group -mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left transition-colors hover:bg-dashboard-elevated/70"
            >
              {Row}
            </button>
          ) : (
            <div key={key}>{Row}</div>
          );
        })}
      </div>
    </section>
  );
}
