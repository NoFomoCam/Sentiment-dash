'use client';

export default function ScoreGauge({ label, sublabel, score, zone }) {
  // Gauge needle rotation: 0 = -90deg (left), 100 = 90deg (right)
  const rotation = -90 + (score / 100) * 180;

  return (
    <div className="bg-gradient-to-br from-dashboard-card to-dashboard-bg border border-dashboard-border 
                    rounded-lg p-4 text-center">
      <div className="text-[10px] tracking-[2px] font-bold" style={{ color: zone.color }}>
        {label}
      </div>
      <div className="text-[8px] text-dashboard-muted tracking-wider mb-3">{sublabel}</div>

      {/* Gauge SVG */}
      <div className="relative w-32 h-20 mx-auto">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background arc segments */}
          <path d="M 20 100 A 80 80 0 0 1 60 34" stroke="#22c55e" strokeWidth="8" fill="none" opacity="0.3" />
          <path d="M 60 34 A 80 80 0 0 1 100 20" stroke="#4ade80" strokeWidth="8" fill="none" opacity="0.3" />
          <path d="M 100 20 A 80 80 0 0 1 140 34" stroke="#eab308" strokeWidth="8" fill="none" opacity="0.3" />
          <path d="M 140 34 A 80 80 0 0 1 165 60" stroke="#f97316" strokeWidth="8" fill="none" opacity="0.3" />
          <path d="M 165 60 A 80 80 0 0 1 180 100" stroke="#ef4444" strokeWidth="8" fill="none" opacity="0.3" />

          {/* Needle */}
          <g transform={`rotate(${rotation}, 100, 100)`}>
            <line x1="100" y1="100" x2="100" y2="30" stroke={zone.color} strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="100" r="5" fill={zone.color} />
          </g>
        </svg>
      </div>

      {/* Score number */}
      <div className="text-3xl font-extrabold mt-1" style={{ color: zone.color }}>
        {score}
      </div>
      <div className="text-[9px] tracking-wider font-bold" style={{ color: zone.color }}>
        {zone.label}
      </div>
    </div>
  );
}
