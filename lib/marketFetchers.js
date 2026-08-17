// Server-side daily fetchers for the cron refresh. Pulls the latest bars from
// each free source and upserts into market_data using the SERVICE_ROLE key
// (bypasses RLS — must never be exposed to the client).
//
// Mirrors the one-off Python backfill scripts, but only grabs a short recent
// window (last ~7 points) since it runs daily. Full history was seeded once.

import { scoreFromRawData } from './scoring';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';
const TAIL = 7; // how many recent points to upsert per series each run

// market_data series -> scoring input key (mirrors page.js SYMBOL_MAP).
const SCORE_MAP = {
  VIX: 'vix', VSTN: 'vix9d', VIX3M: 'vix3m', DXY: 'dxy', SPY: 'spy',
  SPX: 'spx', RSP: 'rsp', NVDA: 'nvda', SMH: 'smh', GLD: 'gld',
  HYG: 'hyg', LQD: 'lqd', ADD: 'nyad', FG: 'fear_greed', PCR: 'pcr',
};

const YAHOO = {
  VIX: '^VIX', DXY: 'DX-Y.NYB', SPX: '^GSPC', SPY: 'SPY', RSP: 'RSP',
  NVDA: 'NVDA', SMH: 'SMH', GLD: 'GLD', HYG: 'HYG', LQD: 'LQD',
};
const CBOE = { VIX3M: 'VIX3M', VSTN: 'VSTN' };

const toDate = (epochSec) => new Date(epochSec * 1000).toISOString().slice(0, 10);
const num = (s) => {
  const v = parseFloat(String(s).trim());
  return Number.isFinite(v) ? v : null;
};
const row = (symbol, date, close, source, o = null, h = null, l = null, vol = null) =>
  ({ symbol, date, open: o, high: h, low: l, close, volume: vol, source });

async function fetchYahoo() {
  const out = [];
  for (const [sym, tk] of Object.entries(YAHOO)) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tk)}?range=1mo&interval=1d`;
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) continue;
      const res = (await r.json())?.chart?.result?.[0];
      if (!res) continue;
      const ts = res.timestamp || [];
      const q = res.indicators.quote[0];
      for (let i = Math.max(0, ts.length - TAIL); i < ts.length; i++) {
        const c = q.close?.[i];
        if (c == null) continue;
        out.push(row(sym, toDate(ts[i]), c, 'yahoo',
          q.open?.[i] ?? null, q.high?.[i] ?? null, q.low?.[i] ?? null, q.volume?.[i] || null));
      }
    } catch { /* skip this symbol */ }
  }
  return out;
}

async function fetchCboe() {
  const out = [];
  for (const [sym, name] of Object.entries(CBOE)) {
    try {
      const r = await fetch(`https://cdn.cboe.com/api/global/us_indices/daily_prices/${name}_History.csv`,
        { headers: { 'User-Agent': UA } });
      if (!r.ok) continue;
      const lines = (await r.text()).trim().split('\n');
      const header = lines[0].split(',').map(s => s.trim().toUpperCase());
      const hasOhlc = header.includes('OPEN');
      for (let i = Math.max(1, lines.length - TAIL); i < lines.length; i++) {
        const p = lines[i].split(',');
        const m = p[0].trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) continue;
        const date = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
        const close = hasOhlc ? num(p[header.indexOf('CLOSE')]) : num(p[1]);
        if (close == null) continue;
        out.push(row(sym, date, close, 'cboe',
          hasOhlc ? num(p[header.indexOf('OPEN')]) : null,
          hasOhlc ? num(p[header.indexOf('HIGH')]) : null,
          hasOhlc ? num(p[header.indexOf('LOW')]) : null));
      }
    } catch { /* skip */ }
  }
  return out;
}

async function fetchCnn() {
  try {
    const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      { headers: { 'User-Agent': UA, Referer: 'https://www.cnn.com/', Accept: 'application/json' } });
    if (!r.ok) return [];
    const j = await r.json();
    const out = [];
    const take = (arr, sym) => {
      const dedup = {};
      for (const p of arr || []) dedup[toDate(p.x / 1000)] = p.y;
      Object.entries(dedup).sort().slice(-TAIL)
        .forEach(([d, v]) => out.push(row(sym, d, v, 'cnn')));
    };
    take(j.fear_and_greed_historical?.data, 'FG');
    take(j.put_call_options?.data, 'PCR');
    return out;
  } catch { return []; }
}

async function fetchWsjAdd() {
  try {
    const url = 'https://www.wsj.com/market-data/stocks/marketsdiary?id=%7B%22application%22%3A%22WSJ%22%2C%22marketsDiaryType%22%3A%22overview%22%7D&type=mdc_marketsdiary';
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) return [];
    const data = (await r.json()).data;
    const issues = Object.fromEntries(data.instrumentSets[0].instruments.map(x => [x.name, x]));
    const adv = parseInt(issues.Advancing.NYSE.replace(/,/g, ''), 10);
    const dec = parseInt(issues.Declining.NYSE.replace(/,/g, ''), 10);
    const [m, d, y] = data.timestamp.split(' ').pop().split('/');
    const date = `20${y.padStart(2, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!Number.isFinite(adv) || !Number.isFinite(dec)) return [];
    return [row('ADD', date, adv - dec, 'wsj')];
  } catch { return []; }
}

async function upsert(rows) {
  if (!rows.length) return 0;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/rest/v1/market_data?on_conflict=symbol,date`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return rows.length;
}

// Paginated Supabase REST select (REST caps at 1000 rows/request).
async function sbSelect(path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('missing SUPABASE_URL / key for select');
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + PAGE - 1}` },
    });
    if (!res.ok) throw new Error(`select ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return out;
}

// Compute one day's live/eod sentiment score from grouped market_data.
function scoreOneDay(bySym, spx, date) {
  const today = { fear_greed: null, pcr: null };
  const prev = {};
  for (const [sym, key] of Object.entries(SCORE_MAP)) {
    const arr = bySym[sym];
    if (!arr) continue;
    const i = arr.idx[date];
    if (i == null) continue;
    today[key] = arr[i].close;
    if (i > 0) prev[key] = arr[i - 1].close;
  }
  const si = spx.idx[date];
  const win = spx.slice(Math.max(0, si - 49), si + 1).map((x) => x.close);
  const high = win.length ? Math.max(...win) : today.spx;
  const dd = high > 0 ? ((today.spx / high) - 1) * 100 : 0;
  return scoreFromRawData(today, prev, { drawdownPct: dd, includeEod: true });
}

// Load the recent market_data window once, grouped by symbol (120d covers the
// prev-day deltas + 50d drawdown that scoring needs). Shared by the score sync
// and the brief so we only read it once per refresh.
async function loadGrouped() {
  const since = new Date();
  since.setDate(since.getDate() - 120);
  const md = await sbSelect(`market_data?select=symbol,date,close&date=gte.${since.toISOString().slice(0, 10)}&order=date.asc`);
  const bySym = {};
  for (const r of md) (bySym[r.symbol] ||= []).push({ date: r.date, close: Number(r.close) });
  for (const s of Object.keys(bySym)) bySym[s].idx = Object.fromEntries(bySym[s].map((x, i) => [x.date, i]));
  return { bySym, spx: bySym.SPX || [] };
}

// The 11 scoring indicators — used to measure how "complete" a day's composite is.
const ALL_INDICATORS = ['vix', 'vix_term', 'cnn_fg', 'dxy', 'rsp_spy', 'nyse_ad', 'nvda_smh', 'spx_gold', 'hyg_lqd', 'drawdown', 'pcr'];
const RESCORE_TAIL = 4; // also re-score the last few days each run so late-arriving FG/PCR fill in

// After market_data is refreshed, persist daily scores into daily_readings for
// any dates newer than the latest stored score (self-healing across missed runs)
// AND re-score the last few days (idempotent upsert) so indicators that publish a
// day late — CNN Fear & Greed / Put-Call — get folded into that day's composite.
async function syncScores({ bySym, spx }, { dry }) {
  const latest = await sbSelect('daily_readings?select=date&order=date.desc&limit=1');
  const lastScored = latest?.[0]?.date || '1970-01-01';
  const tailStart = spx.length ? spx[Math.max(0, spx.length - RESCORE_TAIL)].date : '1970-01-01';

  const rows = [];
  let newDays = 0;
  for (const { date } of spx) {
    if (date > lastScored || date >= tailStart) {
      const r = scoreOneDay(bySym, spx, date);
      rows.push({ date, live_score: r.liveScore, eod_score: r.eodScore });
      if (date > lastScored) newDays += 1;
    }
  }

  const summary = { scored: rows.length, newDays, from: rows[0]?.date ?? null, to: rows.at(-1)?.date ?? null };
  if (dry || rows.length === 0) return summary;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing SUPABASE_SERVICE_ROLE_KEY for score upsert');
  const res = await fetch(`${url}/rest/v1/daily_readings?on_conflict=date`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`score upsert ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return summary;
}

const BRIEF_MODEL = 'claude-sonnet-5';
const INDICATOR_NAMES = {
  vix: 'VIX', vix_term: 'VIX Term Structure', cnn_fg: 'CNN Fear & Greed', dxy: 'DXY',
  rsp_spy: 'RSP/SPY Breadth', nyse_ad: 'NYSE A/D', nvda_smh: 'NVDA/SMH', spx_gold: 'SPX/Gold',
  hyg_lqd: 'HYG/LQD Credit', drawdown: 'SPX Drawdown', pcr: 'Put/Call Ratio',
};

// Contrarian read of the day's sentiment via Claude (server-side, ANTHROPIC_API_KEY).
// One short call per day; the single composite is the full 11-indicator score.
async function generateBriefText({ scores, score }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const isExtreme = score <= 35 || score >= 65;
  const lengthInstruction = isExtreme
    ? 'Write 4-5 sentences. Be specific about which indicators are most significant and what the contrarian trade implies.'
    : 'Write 2-3 sentences.';
  const breakdown = Object.entries(scores)
    .map(([k, v]) => `  ${INDICATOR_NAMES[k] || k}: ${v}/100`).join('\n');
  const prompt = `You are a contrarian market analyst. Your dashboard scores market sentiment 0-100:
- 0-25: Extreme fear / strong contrarian BUY opportunity
- 25-45: Fear / elevated buy signal
- 45-55: Neutral
- 55-75: Complacency / contrarian SELL caution
- 75-100: Extreme greed / high sell risk

Today's composite: ${score}/100

Indicator breakdown (0 = max fear/buy, 100 = max greed/sell):
${breakdown}

Give a concise contrarian read of today's market sentiment. Focus on what the readings imply for forward risk/reward from a contrarian perspective - not what the market did today, but what the setup suggests. Respond with only the read itself, no preamble. ${lengthInstruction}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: BRIEF_MODEL,
      max_tokens: isExtreme ? 400 : 250,
      // Pure interpretation of pre-computed scores — no reasoning budget needed.
      // Sonnet 5 defaults to adaptive thinking when omitted; disable it so the
      // whole max_tokens budget is the brief and content[0] is the text block.
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.content?.find((b) => b.type === 'text')?.text ?? '').trim();
}

// Generate + store the brief for the latest trading day, once. Skips if that
// day already has a brief (so it stays stable until the next day's data lands);
// regenerates if a prior run wrote the score row but the brief failed.
async function ensureLatestBrief({ bySym, spx }, { dry }) {
  if (!spx.length) return { status: 'no-data' };
  const date = spx.at(-1).date;
  const existing = await sbSelect(`daily_readings?select=brief&date=eq.${date}`);
  if (existing?.[0]?.brief) return { status: 'cached', date };
  if (dry) return { status: 'would-generate', date };

  const r = scoreOneDay(bySym, spx, date);
  let text;
  try {
    text = await generateBriefText({ scores: r.scores, score: r.eodScore });
  } catch (e) {
    return { status: 'error', date, error: String(e) };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { status: 'error', date, error: 'missing SUPABASE_SERVICE_ROLE_KEY' };
  const res = await fetch(`${url}/rest/v1/daily_readings?date=eq.${date}`, {
    method: 'PATCH',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify({ brief: text }),
  });
  if (!res.ok) return { status: 'error', date, error: `patch ${res.status}: ${(await res.text()).slice(0, 150)}` };
  return { status: 'generated', date, chars: text.length };
}

// Best-effort audit row for each scheduled run. Needs the service_role key —
// if it's absent (the very failure we'd want to log) this no-ops and the error
// still surfaces in Vercel logs.
async function recordRun(row) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    await fetch(`${url}/rest/v1/cron_runs`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (e) {
    console.error('cron_runs audit failed:', e);
  }
}

// Run all four fetchers, upsert everything, sync scores, generate the brief, and
// record a completeness audit so missing data can't slip by unnoticed.
// { dry: true } skips all writes (test without the service_role key).
export async function refreshAll({ dry = false } = {}) {
  const [yahoo, cboe, cnn, wsj] = await Promise.all([
    fetchYahoo(), fetchCboe(), fetchCnn(), fetchWsjAdd(),
  ]);
  const all = [...yahoo, ...cboe, ...cnn, ...wsj];
  const counts = { yahoo: yahoo.length, cboe: cboe.length, cnn: cnn.length, wsj: wsj.length };

  let upserted = 0, scores, brief, ok = true, error = null;
  let latestDate = null, indicatorsUsed = null, missing = [];
  try {
    upserted = dry ? 0 : await upsert(all);
    const grouped = await loadGrouped();
    scores = await syncScores(grouped, { dry });
    brief = await ensureLatestBrief(grouped, { dry });
    // Completeness of the newest scored day: which of the 11 indicators were present.
    latestDate = grouped.spx.at(-1)?.date ?? null;
    if (latestDate) {
      const present = Object.keys(scoreOneDay(grouped.bySym, grouped.spx, latestDate).scores);
      indicatorsUsed = present.length;
      missing = ALL_INDICATORS.filter((k) => !present.includes(k));
    }
  } catch (e) {
    ok = false;
    error = String(e);
    scores = scores ?? { error };
    brief = brief ?? { error };
  }

  const completeness = { latest_date: latestDate, indicators_used: indicatorsUsed, missing_indicators: missing };
  if (!dry) {
    await recordRun({
      ok, error,
      latest_date: latestDate,
      indicators_used: indicatorsUsed,
      missing_indicators: missing,
      fetched: counts,
      rows_written: upserted,
      scores_synced: scores?.scored ?? 0,
      brief_status: brief?.status ?? (brief?.error ? 'error' : null),
    });
  }

  return {
    dry, upserted, counts, scores, brief, completeness,
    latest: all.filter(r => ['SPX', 'VIX', 'FG', 'PCR', 'ADD'].includes(r.symbol))
      .reduce((m, r) => { m[r.symbol] = { date: r.date, close: r.close }; return m; }, {}),
  };
}
