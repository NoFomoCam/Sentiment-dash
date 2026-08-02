'use client';

import { useState } from 'react';

// Plain-English rules / definitions for every indicator. HIGH score = greed =
// correction risk; LOW score = fear = buy signal. Ported from the OG build.
export const GUIDE = [
  { label: 'VIX', what: 'Market fear index — how nervous options traders are right now',
    rows: [
      { signal: 'Extreme Complacency', range: '< 13', plain: 'Nobody is scared at all. Markets feel invincible. Danger zone for longs.', tag: 'SELL', color: '#ef4444' },
      { signal: 'Low Vol / Complacent', range: '13–17', plain: 'Very calm. Traders not buying protection. Vulnerable to shock.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'Normal Range', range: '17–22', plain: 'Moderate fear. No strong contrarian edge either way.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Elevated Fear', range: '22–30', plain: 'Traders nervous, buying puts. Starting to signal opportunity.', tag: 'WATCH', color: '#84cc16' },
      { signal: 'Panic / Max Fear', range: '> 30', plain: 'Full panic. Historically near market bottoms. Strong buy signal.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'VIX Term Structure', what: 'VIX9D ÷ VIX3M — shape of the volatility curve near-term vs long-term',
    rows: [
      { signal: 'Deep Contango', range: 'Ratio < 0.80', plain: 'Near-term fear is way cheaper than long-term. Pure complacency. Nobody hedging short-term. Vulnerable.', tag: 'SELL', color: '#ef4444' },
      { signal: 'Contango', range: '0.80–0.90', plain: 'Normal — short-term slightly calmer. Healthy but cautious.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'Flattening', range: '0.90–1.00', plain: 'Curve flattening. Traders starting to hedge near-term. Neutral signal.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Backwardation', range: '1.00–1.10', plain: 'Near-term fear EXCEEDS long-term. Acute panic. Often marks a bottom.', tag: 'WATCH', color: '#84cc16' },
      { signal: 'Extreme Backwardation', range: '> 1.10', plain: 'Full inversion. Maximum near-term panic. Strong historical buy signal.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'Fear & Greed', what: 'CNN composite of 7 market sentiment indicators, scored 0–100',
    rows: [
      { signal: 'Extreme Greed', range: '> 75', plain: 'Everyone euphoric and bullish. Market historically ripe for pullback.', tag: 'SELL', color: '#ef4444' },
      { signal: 'Greed', range: '55–75', plain: 'Sentiment leaning bullish. Exercise caution on new longs.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'Neutral', range: '45–55', plain: 'No strong lean either way. Wait for clearer signal.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Fear', range: '25–45', plain: 'Sentiment bearish. Potential opportunity forming.', tag: 'WATCH', color: '#84cc16' },
      { signal: 'Extreme Fear', range: '< 25', plain: 'Maximum pessimism. Historically a strong buy signal.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'DXY (Dollar)', what: 'US Dollar strength — falling dollar = risk-on euphoria, rising dollar = risk-off or rate fears',
    rows: [
      { signal: '$ Collapsing', range: '< −0.5%', plain: 'Dollar dumped. Money flooding risk assets. Euphoric environment.', tag: 'SELL', color: '#ef4444' },
      { signal: '$ Weakening', range: '−0.5 to −0.2%', plain: 'Dollar softening. Risk appetite elevated.', tag: 'CAUTION', color: '#f97316' },
      { signal: '$ Stable', range: '±0.2%', plain: 'Dollar flat. No strong signal.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: '$ Strengthening', range: '+0.2 to +0.5%', plain: 'Dollar bid. Risk-off flavor. Watch equities.', tag: 'WATCH', color: '#84cc16' },
      { signal: '$ Surging', range: '> +0.5%', plain: 'Dollar surging. Could be rate fears or panic. Equity headwind, often near equity lows.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'RSP / SPY', what: 'Equal-weight S&P vs cap-weight S&P — signals depend on whether market is up or down',
    rows: [
      { signal: 'Broad Advance', range: 'UP DAY: RSP >> SPY', plain: 'On a UP day — every stock participating. All-in euphoria. Late stage rally signal.', tag: 'SELL', color: '#ef4444' },
      { signal: 'Advancing', range: 'UP DAY: RSP > SPY', plain: 'On an UP day — healthy breadth but watch for overextension.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'Flat / Mixed', range: '~Equal', plain: 'No breadth edge either way.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Resilient Breadth', range: 'DOWN DAY: RSP > SPY', plain: 'On a DOWN day — equal weight held better than mega caps. Selling is orderly. Neutral — not capitulation yet.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Broad Capitulation', range: 'DOWN DAY: RSP << SPY', plain: 'On a DOWN day — everything getting sold equally. Full capitulation across the market. Strong buy signal.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'NYSE A/D', what: 'Daily advances minus declines — how many stocks rose vs fell today',
    rows: [
      { signal: 'Strong Advance', range: '> +500', plain: 'Vast majority of stocks rallying. Broad euphoria.', tag: 'SELL', color: '#ef4444' },
      { signal: 'Advancing', range: '+100 to +500', plain: 'More advancers than decliners. Bullish breadth.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'Flat', range: '−100 to +100', plain: 'Even split. No breadth signal.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Declining', range: '−100 to −500', plain: 'More stocks falling than rising. Underlying weakness.', tag: 'WATCH', color: '#84cc16' },
      { signal: 'Collapsing', range: '< −500', plain: 'Mass selling across all stocks. Capitulation territory. Strong buy zone.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'NVDA / SMH', what: 'NVDA vs semiconductor ETF — reads differently on up days vs down days',
    rows: [
      { signal: 'Speculative Surge', range: 'UP DAY: NVDA >> SMH', plain: 'On an UP day — NVDA leading the sector. Pure speculation and momentum. Top signal.', tag: 'SELL', color: '#ef4444' },
      { signal: 'NVDA Leading', range: 'UP DAY: NVDA > SMH', plain: 'On an UP day — risk appetite elevated in tech.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'In Line', range: '~Equal', plain: 'Normal behavior. No strong signal.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'NVDA Defensive', range: 'DOWN DAY: NVDA > SMH', plain: 'On a DOWN day — NVDA holding up better than semis. Not speculation — just relative resilience. Neutral.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Tech Deleveraging', range: 'DOWN DAY: NVDA << SMH', plain: 'On a DOWN day — NVDA getting hammered harder than sector. Forced growth selling. Buy signal territory.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'SPX / Gold', what: 'S&P 500 vs Gold ratio — reads differently on up days vs down days',
    rows: [
      { signal: 'Max Risk-On', range: 'UP DAY: SPX >> Gold', plain: 'On an UP day — stocks massively outperforming safety. Euphoria. Sell signal.', tag: 'SELL', color: '#ef4444' },
      { signal: 'Risk-On', range: 'UP DAY: SPX > Gold', plain: 'On an UP day — stocks favored over safety.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'Balanced', range: '~Equal', plain: 'Neither risk-on nor risk-off dominating.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Gold Sold ($ Driven)', range: 'DOWN DAY: ratio rises', plain: 'On a DOWN day — ratio rising means gold sold off harder than stocks, likely because the dollar surged. NOT a risk-on signal. Neutral — wait for clearer read.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Flight to Safety', range: 'DOWN DAY: Gold >> SPX', plain: 'On a DOWN day — gold rising while stocks fall. True risk-off. Money leaving equities for safety. Buy signal.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'HYG / LQD', what: 'High yield (junk) bonds vs investment grade — credit market risk appetite',
    rows: [
      { signal: 'Credit Euphoria', range: '> +0.3% (normal) / +0.8% (down day)', plain: 'Investors buying junk aggressively. Zero fear of default. Top signal.', tag: 'SELL', color: '#ef4444' },
      { signal: 'Credit Buying', range: '> +0.1% (normal) / +0.4% (down day)', plain: 'Risk appetite in credit elevated. Thresholds higher on down days to filter noise.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'Stable', range: 'Within threshold', plain: 'Credit markets calm. No directional signal.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Credit Stress', range: 'Ratio declining', plain: 'Investors avoiding junk, preferring quality. Stress building.', tag: 'WATCH', color: '#84cc16' },
      { signal: 'Credit Panic', range: 'Sharp decline', plain: 'Full flight from junk bonds. Near capitulation in credit.', tag: 'BUY', color: '#22c55e' },
    ] },
  { label: 'Put/Call Ratio', what: 'Ratio of put options (bets down) to call options (bets up) — from CBOE equity data, updated after 4PM EST',
    rows: [
      { signal: 'Extreme Complacency', range: '< 0.50', plain: 'Everyone buying calls, nobody hedging. Pure euphoria. Very dangerous.', tag: 'SELL', color: '#ef4444' },
      { signal: 'Complacent', range: '0.50–0.65', plain: 'More calls than puts. Bullish complacency.', tag: 'CAUTION', color: '#f97316' },
      { signal: 'Neutral', range: '0.65–0.80', plain: 'Normal balance of puts and calls.', tag: 'NEUTRAL', color: '#eab308' },
      { signal: 'Defensive', range: '0.80–1.00', plain: 'More protection being bought. Healthy fear building.', tag: 'WATCH', color: '#84cc16' },
      { signal: 'Max Fear', range: '> 1.00', plain: 'More puts than calls. Mass panic hedging. Historically a strong buy signal.', tag: 'BUY', color: '#22c55e' },
    ] },
];

const tagStyle = (tag) => ({
  fontSize: '9px', fontWeight: '800', letterSpacing: '2px', padding: '3px 8px', borderRadius: '2px', fontFamily: 'monospace', flexShrink: 0,
  background: tag === 'SELL' ? '#ef444422' : tag === 'BUY' ? '#22c55e22' : tag === 'CAUTION' ? '#f9731622' : tag === 'WATCH' ? '#84cc1622' : '#eab30822',
  color: tag === 'SELL' ? '#ef4444' : tag === 'BUY' ? '#22c55e' : tag === 'CAUTION' ? '#f97316' : tag === 'WATCH' ? '#84cc16' : '#eab308',
  border: `1px solid ${tag === 'SELL' ? '#ef444444' : tag === 'BUY' ? '#22c55e44' : tag === 'CAUTION' ? '#f9731644' : tag === 'WATCH' ? '#84cc1644' : '#eab30844'}`,
});

export default function ReadingGuide({ onClose }) {
  const [open, setOpen] = useState(null);
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
          <div key={ind.label} style={{ marginBottom: '6px', border: '1px solid #1e293b', borderRadius: '4px', overflow: 'hidden' }}>
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
                {ind.rows.map((row, j) => (
                  <div key={j} style={{ padding: '10px 14px', borderTop: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>{row.signal}</span>
                        <span style={{ fontSize: '9px', color: '#334155' }}>({row.range})</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5', paddingLeft: '16px' }}>{row.plain}</div>
                    </div>
                    <div style={tagStyle(row.tag)}>{row.tag}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop: '16px', fontSize: '9px', color: '#1e293b', textAlign: 'center' }}>CONTRARIAN MODEL · HIGH = GREED = CORRECTION RISK · LOW = FEAR = BUY SIGNAL</div>
      </div>
    </div>
  );
}
