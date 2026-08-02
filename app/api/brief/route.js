const INDICATOR_NAMES = {
  vix: 'VIX',
  vix_term: 'VIX Term Structure',
  cnn_fg: 'CNN Fear & Greed',
  dxy: 'DXY',
  rsp_spy: 'RSP/SPY Breadth',
  nyse_ad: 'NYSE A/D',
  nvda_smh: 'NVDA/SMH',
  spx_gold: 'SPX/Gold',
  hyg_lqd: 'HYG/LQD Credit',
  drawdown: 'SPX Drawdown',
  pcr: 'Put/Call Ratio',
};

// Lightweight abuse guard (pre-auth). The brief calls a paid model, and the
// route is publicly reachable, so we: reject cross-origin callers, cap volume
// per warm instance, and validate the payload. Per-user gating lands with auth.
const RL = { windowMs: 60_000, max: 20, hits: [] };
function rateLimited() {
  const now = Date.now();
  RL.hits = RL.hits.filter((t) => now - t < RL.windowMs);
  if (RL.hits.length >= RL.max) return true;
  RL.hits.push(now);
  return false;
}
function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin POSTs frequently omit the Origin header
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}
const validScore = (n) => Number.isFinite(n) && n >= 0 && n <= 100;

export async function POST(req) {
  if (!sameOrigin(req)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  if (rateLimited()) {
    return Response.json({ error: 'rate limited, try again shortly' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
  const { liveScore, eodScore, scores } = body;
  if (!validScore(liveScore) || !validScore(eodScore) || !scores || typeof scores !== 'object') {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const isExtreme = liveScore <= 35 || liveScore >= 65;
  const lengthInstruction = isExtreme
    ? 'Write 4-5 sentences. Be specific about which indicators are most significant and what the contrarian trade implies.'
    : 'Write 2-3 sentences.';

  const breakdown = Object.entries(scores)
    .map(([k, v]) => `  ${INDICATOR_NAMES[k] || k}: ${v}/100`)
    .join('\n');

  const prompt = `You are a contrarian market analyst. Your dashboard scores market sentiment 0–100:
- 0–25: Extreme fear / strong contrarian BUY opportunity
- 25–45: Fear / elevated buy signal
- 45–55: Neutral
- 55–75: Complacency / contrarian SELL caution
- 75–100: Extreme greed / high sell risk

Today's composite: LIVE ${liveScore}/100  |  EOD (with PCR) ${eodScore}/100

Indicator breakdown (0 = max fear/buy, 100 = max greed/sell):
${breakdown}

Give a concise contrarian read of today's market sentiment. Focus on what the readings imply for forward risk/reward from a contrarian perspective — not what the market did today, but what the setup suggests. ${lengthInstruction}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: isExtreme ? 400 : 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Anthropic API error:', err);
    return Response.json({ error: 'Brief generation failed' }, { status: 500 });
  }

  const data = await response.json();
  const brief = data.content?.[0]?.text ?? '';

  return Response.json({ brief });
}
