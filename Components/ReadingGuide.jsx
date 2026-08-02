'use client';

import { useState } from 'react';
import { GUIDE } from '../lib/guide';

const tagStyle = (tag) => ({
  fontSize: '9px', fontWeight: '800', letterSpacing: '2px', padding: '3px 8px', borderRadius: '2px', fontFamily: 'monospace', flexShrink: 0,
  background: tag === 'SELL' ? '#ef444422' : tag === 'BUY' ? '#22c55e22' : tag === 'CAUTION' ? '#f9731622' : tag === 'WATCH' ? '#84cc1622' : '#eab30822',
  color: tag === 'SELL' ? '#ef4444' : tag === 'BUY' ? '#22c55e' : tag === 'CAUTION' ? '#f97316' : tag === 'WATCH' ? '#84cc16' : '#eab308',
  border: `1px solid ${tag === 'SELL' ? '#ef444444' : tag === 'BUY' ? '#22c55e44' : tag === 'CAUTION' ? '#f9731644' : tag === 'WATCH' ? '#84cc1644' : '#eab30844'}`,
});

// openLabel: GUIDE.label to auto-expand. highlightSignal: signal name of the row
// to highlight (the indicator's current live state).
export default function ReadingGuide({ onClose, openLabel = null, highlightSignal = null }) {
  const [open, setOpen] = useState(() => {
    const i = GUIDE.findIndex((g) => g.label === openLabel);
    return i >= 0 ? i : null;
  });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,13,26,0.98)', zIndex: 100, overflowY: 'auto', padding: '16px', fontFamily: 'monospace' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '4px', color: '#334155', marginBottom: '4px' }}>REFERENCE</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '2px' }}>HOW TO READ THIS</div>
          </div>
          <button onClick={onClose} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px', padding: '6px 14px', borderRadius: '3px', cursor: 'pointer' }}>✕ CLOSE</button>
        </div>

        {/* Score zone bar */}
        <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '3px', color: '#334155', marginBottom: '10px' }}>THE SCORE — WHAT IT MEANS</div>
          <div style={{ display: 'flex', height: '32px', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
            {[['0–20', 'BUY', '#22c55e'], ['20–35', 'WATCH', '#84cc16'], ['35–55', 'NEUTRAL', '#eab308'], ['55–75', 'CAUTION', '#f97316'], ['75–100', 'SELL', '#ef4444']].map(([r, l, c]) => (
              <div key={l} style={{ flex: 1, background: c + '33', borderRight: '1px solid #060d1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                <div style={{ fontSize: '9px', fontWeight: '800', color: c }}>{l}</div>
                <div style={{ fontSize: '7px', color: c + '88' }}>{r}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '9px', lineHeight: '1.6' }}>
            <div style={{ color: '#22c55e' }}>🟢 LOW (0–35) = fear/panic in the market = potential BUY signal. Look for long entries.</div>
            <div style={{ color: '#ef4444' }}>🔴 HIGH (65–100) = greed/complacency = correction risk. Tighten stops, reduce size.</div>
          </div>
        </div>

        <div style={{ fontSize: '9px', letterSpacing: '3px', color: '#334155', marginBottom: '10px' }}>INDICATOR GLOSSARY — TAP ANY TO EXPAND</div>
        {GUIDE.map((ind, i) => (
          <div key={ind.label} style={{ marginBottom: '6px', border: `1px solid ${open === i ? '#334155' : '#1e293b'}`, borderRadius: '4px', overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === i ? null : i)}
              style={{ width: '100%', background: open === i ? '#0f172a' : '#0a1628', border: 'none', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '1px' }}>{ind.label}</div>
                <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{ind.what}</div>
              </div>
              <div style={{ color: '#334155', fontSize: '14px', flexShrink: 0 }}>{open === i ? '▲' : '▼'}</div>
            </button>
            {open === i && (
              <div>
                {ind.rows.map((row, j) => {
                  const isNow = open === i && highlightSignal && row.signal === highlightSignal;
                  return (
                    <div key={j} style={{ padding: '10px 14px', borderTop: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', background: isNow ? row.color + '14' : 'transparent', borderLeft: isNow ? `2px solid ${row.color}` : '2px solid transparent' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>{row.signal}</span>
                          <span style={{ fontSize: '9px', color: '#334155' }}>({row.range})</span>
                          {isNow && <span style={{ fontSize: '8px', fontWeight: '800', letterSpacing: '1px', color: row.color }}>← NOW</span>}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', paddingLeft: '16px' }}>{row.plain}</div>
                      </div>
                      <div style={tagStyle(row.tag)}>{row.tag}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop: '16px', fontSize: '9px', color: '#1e293b', textAlign: 'center' }}>CONTRARIAN MODEL · HIGH = GREED = CORRECTION RISK · LOW = FEAR = BUY SIGNAL</div>
      </div>
    </div>
  );
}
