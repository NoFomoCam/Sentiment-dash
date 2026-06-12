'use client';

export default function ScoreGauge({ label, sublabel, score, zone }) {
  const rotation = -90 + (score / 100) * 180;

  return (
    <div className="bg-gradient-to-br from-dashboard-card to-dashboard-bg border border-dashboard-border rounded-lg p-4 text-center">
      <div className="text-[10px] tracking-[2px] font-bold" style={{ color: zone.color }}>
        {label}
      </div>
      <div className="text-[8px] text-dashboard-muted tracking-wider mb-3">{sublabel}</div>

      <div className="relative w-32 h-20 mx-auto">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          <path d="M 20 100 A 80 80 0 0 1 60 34" stroke="#22c55e" strokeWidth="8" fill="none" opacity="0.3" />
          <path d="M 60 34 A 80 80 0 0 1 100 20" stroke="#4ade80" strokeWidth="8" fill="none" opacity="0.3" />
          <path d="M 100 20 A 80 80 0 0 1 140 34" stroke="#eab308" strokeWidth="8" fill="none" opacity="0.3" />
          <path d="M 140 34 A 80 80 0 0 1 165 60" stroke="#f97316" strokeWidth="8" fill="none" opacity="0.3" />
          <path d="M 165 60 A 80 80 0 0 1 180 100" stroke="#ef4444" strokeWidth="8" fill="none" opacity="0.3" />

          <g transform={`rotate(${rotation}, 100, 100)`}
            
