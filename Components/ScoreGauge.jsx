'use client';

// Hero for the single composite score: a headline number + a diverging
// fear<->greed meter (green -> amber -> red) with a live marker. One axis; the
// score's position, the zone chip, and the number all carry the reading so it
// never depends on color alone.

function meaning(score) {
  if (score < 20) return 'Extreme fear — historically a strong contrarian BUY zone.';
  if (score < 35) return 'Fear building — leaning buy; watch for price confirmation.';
  if (score < 45) return 'Mild fear tilt — no strong contrarian edge yet.';
  if (score < 55) return 'Neutral — wait for a clearer signal before committing.';
  if (score < 65) return 'Complacency creeping in — stay selective on new longs.';
  if (score < 75) return 'Greed — elevated correction risk; tighten stops.';
  return 'Extreme greed — high sell risk; contrarian caution warranted.';
}

const METER = 'linear-gradient(90deg,#23d18b 0%,#8fe04f 27%,#f7b737 50%,#fb8a3c 73%,#f64f68 100%)';

export default function ScoreGauge({ label, sublabel, score, zone }) {
  const c = zone.color;
  const pos = Math.max(0, Math.min(100, score));

  return (
    <section className="surface p-6 sm:p-7 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">{label}</div>
          <div className="mt-1 text-[11px] text-dashboard-faint">{sublabel}</div>
        </div>
        <span
          className="pill font-semibold"
          style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: c, boxShadow: `0 0 8px ${c}` }}
          />
          {zone.label}
        </span>
      </div>

      {/* Headline number */}
      <div className="mt-4 flex items-end justify-center gap-2">
        <span
          className="font-black leading-none tabular-nums tracking-tight text-[84px] sm:text-[104px]"
          style={{ color: c, textShadow: `0 0 44px ${c}40` }}
        >
          {score}
        </span>
        <span className="mb-3 text-2xl font-semibold text-dashboard-faint">/100</span>
      </div>

      {/* Fear <-> Greed meter with live marker */}
      <div className="mt-5">
        <div className="relative">
          <div className="h-2.5 rounded-full" style={{ background: METER }} />
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos}%` }}
          >
            <div
              className="h-4 w-4 rounded-full border-2 border-dashboard-bg"
              style={{ background: c, boxShadow: `0 0 0 2px ${c}66, 0 0 16px ${c}` }}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-between font-mono text-[10px] tracking-wide">
          <span className="text-dashboard-buy">0 · FEAR / BUY</span>
          <span className="hidden text-dashboard-faint sm:inline">NEUTRAL</span>
          <span className="text-dashboard-sell">GREED / SELL · 100</span>
        </div>
      </div>

      <p className="mt-5 border-t border-dashboard-hairline pt-4 text-center text-[13px] leading-relaxed text-dashboard-text">
        {meaning(score)}
      </p>
    </section>
  );
}
