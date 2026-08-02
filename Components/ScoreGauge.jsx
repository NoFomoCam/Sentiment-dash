'use client';

// Hero for the single composite score. Form: a headline number + a diverging
// fear<->greed meter (green -> neutral -> red) with a live marker. One axis.
const ZONES = [
  { key: 'BUY', color: '#22c55e' },
  { key: 'WATCH', color: '#84cc16' },
  { key: 'NEUTRAL', color: '#eab308' },
  { key: 'CAUTION', color: '#f97316' },
  { key: 'SELL', color: '#ef4444' },
];

function meaning(score) {
  if (score < 20) return 'Extreme fear — historically a strong contrarian BUY zone.';
  if (score < 35) return 'Fear building — leaning buy; watch for price confirmation.';
  if (score < 45) return 'Mild fear tilt — no strong contrarian edge yet.';
  if (score < 55) return 'Neutral — wait for a clearer signal before committing.';
  if (score < 65) return 'Complacency creeping in — stay selective on new longs.';
  if (score < 75) return 'Greed — elevated correction risk; tighten stops.';
  return 'Extreme greed — high sell risk; contrarian caution warranted.';
}

export default function ScoreGauge({ label, sublabel, score, zone }) {
  const c = zone.color;
  return (
    <div className="bg-gradient-to-br from-dashboard-card to-dashboard-bg border border-dashboard-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] tracking-[3px] font-bold text-dashboard-muted">{label}</div>
          <div className="text-[8px] text-dashboard-muted tracking-wider mt-0.5">{sublabel}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] tracking-[2px] font-extrabold" style={{ color: c }}>{zone.label}</div>
          <div className="text-[8px] text-dashboard-muted tracking-wider">CONTRARIAN</div>
        </div>
      </div>

      {/* Headline number */}
      <div className="flex items-end justify-center gap-1 mb-4">
        <span className="text-6xl font-extrabold leading-none tabular-nums" style={{ color: c }}>{score}</span>
        <span className="text-lg font-bold text-dashboard-muted mb-1">/100</span>
      </div>

      {/* Fear <-> Greed meter (5 diverging zones + live marker) */}
      <div className="relative">
        <div className="flex h-3 rounded-sm overflow-hidden gap-[2px]">
          {ZONES.map((z) => (
            <div key={z.key} className="flex-1" style={{ background: z.color, opacity: 0.32 }} />
          ))}
        </div>
        {/* marker */}
        <div className="absolute -top-1.5 -translate-x-1/2" style={{ left: `${Math.max(0, Math.min(100, score))}%` }}>
          <div className="w-0 h-0 mx-auto" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `7px solid ${c}` }} />
          <div className="w-[2px] h-3 mx-auto" style={{ background: c, boxShadow: '0 0 0 1px #0a0f1a' }} />
        </div>
        <div className="flex justify-between mt-2 text-[8px] font-mono tracking-wider">
          <span className="text-dashboard-buy">0 · FEAR / BUY</span>
          <span className="text-dashboard-sell">GREED / SELL · 100</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-dashboard-border text-[10px] leading-relaxed text-dashboard-text text-center">
        {meaning(score)}
      </div>
    </div>
  );
}
