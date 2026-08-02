// Shared rules/definitions glossary + helpers to map a live indicator score to
// its plain-English contrarian state. HIGH score = greed/sell, LOW = fear/buy.

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

// scoring.js indicator key -> GUIDE label. drawdown has no glossary entry.
export const KEY_TO_GUIDE = {
  vix: 'VIX', vix_term: 'VIX Term Structure', cnn_fg: 'Fear & Greed', dxy: 'DXY (Dollar)',
  rsp_spy: 'RSP / SPY', nyse_ad: 'NYSE A/D', nvda_smh: 'NVDA / SMH', spx_gold: 'SPX / Gold',
  hyg_lqd: 'HYG / LQD', pcr: 'Put/Call Ratio',
};

// GUIDE rows run SELL(high) -> BUY(low). Map a 0-100 score to its row, matching
// the score-zone bar (75+/55/35/20 breakpoints).
export function rowIndexForScore(score) {
  return score >= 75 ? 0 : score >= 55 ? 1 : score >= 35 ? 2 : score >= 20 ? 3 : 4;
}

export function guideEntry(key) {
  return GUIDE.find((g) => g.label === KEY_TO_GUIDE[key]) || null;
}

// The live contrarian state (GUIDE row) for an indicator at a given score.
export function signalForScore(key, score) {
  const entry = guideEntry(key);
  return entry ? entry.rows[rowIndexForScore(score)] : null;
}
