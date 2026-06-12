// Contrarian sentiment scoring engine
// HIGH score (75-100) = greed/complacency = SELL risk
// LOW score (0-25) = fear/panic = BUY opportunity

export function scoreVix(v) {
  if (v < 12) return 92;
  if (v < 15) return 85;
  if (v < 18) return 68;
  if (v < 22) return 50;
  if (v < 28) return 28;
  return 10;
}

export function scoreVixTerm(ratio) {
  if (ratio < 0.75) return 85;
  if (ratio < 0.88) return 68;
  if (ratio < 0.98) return 48;
  if (ratio < 1.08) return 28;
  return 10;
}

export function scoreCnnFearGreed(v) {
  if (v > 75) return 88;
  if (v > 60) return 72;
  if (v > 45) return 50;
  if (v > 25) return 28;
  return 10;
}

export function scoreDxy(chg) {
  if (chg < -0.8) return 85;
  if (chg < -0.3) return 68;
  if (chg < 0.3) return 50;
  if (chg < 0.8) return 28;
  return 10;
}

export function scoreRspSpy(chg, mktDown) {
  if (mktDown) {
    if (chg > 0.5) return 60;
    if (chg > -0.3) return 40;
    return 10;
  }
  if (chg > 0.5) return 85;
  if (chg > 0.2) return 70;
  if (chg > -0.2) return 50;
  if (chg > -0.5) return 28;
  return 10;
}

export function scoreNyseAd(val) {
  if (val > 800) return 85;
  if (val > 300) return 70;
  if (val > -100) return 50;
  if (val > -800) return 28;
  return 10;
}

export function scoreNvdaSmh(chg, mktDown) {
  if (mktDown) {
    if (chg > 1.0) return 60;
    if (chg > -0.5) return 40;
    return 10;
  }
  if (chg > 1.5) return 85;
  if (chg > 0.5) return 70;
  if (chg > -0.5) return 50;
  if (chg > -1.5) return 28;
  return 10;
}

export function scoreSpxGold(chg, mktDown) {
  if (mktDown) {
    if (chg > 0.5) return 45;
    if (chg < -1.5) return 10;
    return 25;
  }
  if (chg > 1.5) return 85;
  if (chg > 0.5) return 70;
  if (chg > -0.5) return 50;
  if (chg > -1.5) return 28;
  return 10;
}

export function scoreHygLqd(chg, mktDown) {
  const bt = mktDown ? 0.6 : 0.15;
  const et = mktDown ? 1.0 : 0.5;
  if (chg > et) return 85;
  if (chg > bt) return 68;
  if (chg > -bt) return 50;
  if (chg > -et) return 28;
  return 10;
}

export function scoreDrawdown(dd) {
  if (dd <= -20) return 8;
  if (dd <= -13) return 18;
  if (dd <= -8) return 30;
  if (dd <= -4) return 45;
  if (dd <= -1.5) return 55;
  if (dd <= -0.3) return 68;
  return 80;
}

export function scorePcr(v) {
  if (v > 1.0) return 10;
  if (v > 0.8) return 28;
  if (v > 0.55) return 50;
  if (v > 0.40) return 72;
  return 88;
}

export function drawdownCeiling(dd) {
  if (dd <= -20) return 30;
  if (dd <= -13) return 42;
  if (dd <= -8) return 52;
  return 100;
}

export const WEIGHTS = {
  vix: 16,
  vix_term: 10,
  cnn_fg: 11,
  dxy: 10,
  rsp_spy: 12,
  nyse_ad: 10,
  nvda_smh: 8,
  spx_gold: 8,
  hyg_lqd: 7,
  drawdown: 12,
  pcr: 8,
};

export function computeComposite(scores, includeEodOnly = false) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [key, score] of Object.entries(scores)) {
    if (key === 'pcr' && !includeEodOnly) continue;
    const weight = WEIGHTS[key];
    if (weight) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
}

export function scoreFromRawData(today, prev, options = {}) {
  const { drawdownPct = 0, includeEod = false } = options;
  const spyChg = ((today.spy - prev.spy) / prev.spy) * 100;
  const mktDown = spyChg < -1.0;
  const scores = {};

  if (today.vix) scores.vix = scoreVix(today.vix);
  if (today.vix9d && today.vix3m) scores.vix_term = scoreVixTerm(today.vix9d / today.vix3m);
  if (today.fear_greed != null) scores.cnn_fg = scoreCnnFearGreed(today.fear_greed);
  if (today.dxy && prev.dxy) scores.dxy = scoreDxy(((today.dxy - prev.dxy) / prev.dxy) * 100);
  if (today.rsp && today.spy && prev.rsp && prev.spy) {
    scores.rsp_spy = scoreRspSpy(((today.rsp / today.spy) / (prev.rsp / prev.spy) - 1) * 100, mktDown);
  }
  if (today.nyad != null) scores.nyse_ad = scoreNyseAd(today.nyad);
  if (today.nvda && today.smh && prev.nvda && prev.smh) {
    scores.nvda_smh = scoreNvdaSmh(((today.nvda / today.smh) / (prev.nvda / prev.smh) - 1) * 100, mktDown);
  }
  if (today.spx && today.gld && prev.spx && prev.gld) {
    scores.spx_gold = scoreSpxGold(((today.spx / today.gld) / (prev.spx / prev.gld) - 1) * 100, mktDown);
  }
  if (today.hyg && today.lqd && prev.hyg && prev.lqd) {
    scores.hyg_lqd = scoreHygLqd(((today.hyg / today.lqd) / (prev.hyg / prev.lqd) - 1) * 100, mktDown);
  }
  scores.drawdown = scoreDrawdown(drawdownPct);
  if (today.pcr) scores.pcr = scorePcr(today.pcr);

  const liveScore = Math.min(computeComposite(scores, false), drawdownCeiling(drawdownPct));
  const eodScore = Math.min(computeComposite(scores, true), drawdownCeiling(drawdownPct));

  return { scores, liveScore, eodScore, mktDown };
}

export function getZone(score) {
  if (score < 20) return { label: 'EXTREME BUY', color: '#22c55e' };
  if (score < 35) return { label: 'BUY / FEAR', color: '#4ade80' };
  if (score < 45) return { label: 'WATCH', color: '#a3e635' };
  if (score < 55) return { label: 'NEUTRAL', color: '#eab308' };
  if (score < 65) return { label: 'CAUTION', color: '#f97316' };
  if (score < 75) return { label: 'CAUTION / GREED', color: '#ef4444' };
  return { label: 'EXTREME SELL', color: '#dc2626' };
}
