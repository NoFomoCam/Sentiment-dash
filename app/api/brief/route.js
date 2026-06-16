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

export async function POST(req) {
  const { liveScore, eodScore, scores } = await req.json();

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
