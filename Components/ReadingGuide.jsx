'use client';

import { useState } from 'react';
import { GUIDE } from '../lib/guide';

const TAG_COLOR = { SELL: '#f64f68', CAUTION: '#fb8a3c', NEUTRAL: '#f7b737', WATCH: '#8fe04f', BUY: '#23d18b' };

// A human, contrarian takeaway per state — the "so what."
const TAKEAWAY = {
  SELL: 'This is the greed / complacency end — a spot to trim, tighten stops, and be skeptical of chasing strength.',
  CAUTION: 'Leaning greedy. Stay selective and don’t force new longs off of this alone.',
  NEUTRAL: 'No real edge here right now — it isn’t tilting the read either way.',
  WATCH: 'Fear is starting to build. This is where opportunity forms — watch for price to confirm.',
  BUY: 'Peak fear — the kind of extreme that has historically come right before a bounce. The contrarian buy end.',
};

function TagChip({ tag }) {
  const c = TAG_COLOR[tag] || '#f7b737';
  return (
    <span className="pill font-semibold" style={{ color: c, borderColor: c + '55', background: c + '14' }}>{tag}</span>
  );
}

function Ladder({ ind, current }) {
  return (
    <div className="mt-3 divide-y divide-dashboard-hairline rounded-lg border border-dashboard-hairline">
      {ind.rows.map((row, j) => {
        const c = TAG_COLOR[row.tag] || '#f7b737';
        const isNow = current && row.signal === current;
        return (
          <div key={j} className="flex items-start justify-between gap-3 px-3 py-2.5"
            style={isNow ? { background: c + '12', borderLeft: `2px solid ${c}` } : { borderLeft: '2px solid transparent' }}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                <span className="text-[12px] font-semibold text-dashboard-text">{row.signal}</span>
                <span className="font-mono text-[10px] text-dashboard-faint">{row.range}</span>
                {isNow && <span className="font-mono text-[9px] font-bold tracking-wide" style={{ color: c }}>← NOW</span>}
              </div>
              <p className="mt-1 pl-4 text-[12px] leading-snug text-dashboard-muted">{row.plain}</p>
            </div>
            <TagChip tag={row.tag} />
          </div>
        );
      })}
    </div>
  );
}

export default function ReadingGuide({ onClose, openLabel = null, highlightSignal = null }) {
  const [open, setOpen] = useState(() => {
    const i = GUIDE.findIndex((g) => g.label === openLabel);
    return i >= 0 ? i : null;
  });

  const curInd = GUIDE.find((g) => g.label === openLabel) || null;
  const curRow = curInd && highlightSignal ? curInd.rows.find((r) => r.signal === highlightSignal) : null;
  const curColor = curRow ? (TAG_COLOR[curRow.tag] || '#f7b737') : '#8ea3c6';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#070b14]/95 p-4 backdrop-blur-sm">
      <div className="mx-auto my-6 max-w-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Reading guide</h2>
            <p className="mt-1 text-[12px] text-dashboard-muted">Plain-English on what each signal is actually telling you — and what it means for a contrarian.</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg border border-dashboard-border bg-dashboard-card px-3 py-1.5 font-mono text-[11px] text-dashboard-muted hover:text-dashboard-text">✕ Close</button>
        </div>

        {/* Right-now read for the indicator you tapped */}
        {curRow && (
          <div className="mb-5 rounded-xl border p-4" style={{ borderColor: curColor + '55', background: curColor + '0e' }}>
            <div className="eyebrow" style={{ color: curColor }}>Right now · {curInd.label}</div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="text-lg font-bold" style={{ color: curColor }}>{curRow.signal}</span>
              <TagChip tag={curRow.tag} />
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-dashboard-text">{curRow.plain}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-dashboard-muted">
              <span className="font-semibold" style={{ color: curColor }}>Contrarian read — </span>{TAKEAWAY[curRow.tag]}
            </p>
            <p className="mt-2.5 border-t border-dashboard-hairline pt-2.5 text-[11px] text-dashboard-faint">
              What it measures: {curInd.what}
            </p>
          </div>
        )}

        {/* What the number means */}
        <div className="surface mb-5 p-4">
          <div className="eyebrow mb-3">The 0–100 score</div>
          <div className="flex h-8 overflow-hidden rounded-md">
            {[['0–20', 'BUY', '#23d18b'], ['20–35', 'WATCH', '#8fe04f'], ['35–55', 'NEUTRAL', '#f7b737'], ['55–75', 'CAUTION', '#fb8a3c'], ['75–100', 'SELL', '#f64f68']].map(([r, l, c]) => (
              <div key={l} className="flex flex-1 flex-col items-center justify-center gap-0.5 border-r border-dashboard-bg" style={{ background: c + '2a' }}>
                <span className="font-mono text-[9px] font-bold" style={{ color: c }}>{l}</span>
                <span className="font-mono text-[7px]" style={{ color: c + 'aa' }}>{r}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-dashboard-muted">
            It’s contrarian, so it reads backwards from the mood: a <span className="font-semibold text-dashboard-buy">low</span> score means everyone’s fearful — usually where bounces start — and a <span className="font-semibold text-dashboard-sell">high</span> score means everyone’s greedy, which is when corrections tend to bite.
          </p>
        </div>

        {/* The 11 indicators */}
        <div className="eyebrow mb-2">The signals behind the score</div>
        {GUIDE.map((ind, i) => {
          const isOpen = open === i;
          return (
            <div key={ind.label} className="mb-1.5 overflow-hidden rounded-lg border" style={{ borderColor: isOpen ? '#2c3648' : '#1a2334' }}>
              <button onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 bg-dashboard-card px-3.5 py-3 text-left hover:bg-dashboard-elevated">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-dashboard-text">{ind.label}</div>
                  <div className="mt-0.5 text-[11px] text-dashboard-faint">{ind.what}</div>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-dashboard-faint">{isOpen ? '–' : '+'}</span>
              </button>
              {isOpen && <div className="px-3 pb-3"><Ladder ind={ind} current={i === (curInd ? GUIDE.indexOf(curInd) : -1) ? highlightSignal : null} /></div>}
            </div>
          );
        })}

        <p className="mt-4 text-center font-mono text-[10px] tracking-wide text-dashboard-faint">
          Contrarian model · high = greed = correction risk · low = fear = opportunity
        </p>
      </div>
    </div>
  );
}
