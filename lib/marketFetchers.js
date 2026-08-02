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

// After market_data is refreshed, persist daily scores into daily_readings for
// any dates newer than the latest stored score. Self-healing: if a run was
// missed, the next run backfills every intervening trading day.
async function syncScores({ dry }) {
  const latest = await sbSelect('daily_readings?select=date&order=date.desc&limit=1');
  const lastScored = latest?.[0]?.date || '1970-01-01';

  const since = new Date();
  since.setDate(since.getDate() - 120); // enough lead-in for prev-day + 50d drawdown
  const md = await sbSelect(`market_data?select=symbol,date,close&date=gte.${since.toISOString().slice(0, 10)}&order=date.asc`);

  const bySym = {};
  for (const r of md) (bySym[r.symbol] ||= []).push({ date: r.date, close: Number(r.close) });
  for (const s of Object.keys(bySym)) bySym[s].idx = Object.fromEntries(bySym[s].map((x, i) => [x.date, i]));
  const spx = bySym.SPX || [];

  const rows = [];
  for (const { date } of spx) {
    if (date <= lastScored) continue;
    const r = scoreOneDay(bySym, spx, date);
    rows.push({ date, live_score: r.liveScore, eod_score: r.eodScore });
  }

  const summary = { scored: rows.length, from: rows[0]?.date ?? null, to: rows.at(-1)?.date ?? null };
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

// Run all four fetchers, upsert everything, then sync daily scores.
// { dry: true } skips writes (test without the service_role key).
export async function refreshAll({ dry = false } = {}) {
  const [yahoo, cboe, cnn, wsj] = await Promise.all([
    fetchYahoo(), fetchCboe(), fetchCnn(), fetchWsjAdd(),
  ]);
  const all = [...yahoo, ...cboe, ...cnn, ...wsj];
  const upserted = dry ? 0 : await upsert(all);

  let scores;
  try {
    scores = await syncScores({ dry }); // reads market_data back after the upsert above
  } catch (e) {
    scores = { error: String(e) };
  }

  return {
    dry,
    upserted,
    counts: { yahoo: yahoo.length, cboe: cboe.length, cnn: cnn.length, wsj: wsj.length },
    scores,
    latest: all.filter(r => ['SPX', 'VIX', 'FG', 'PCR', 'ADD'].includes(r.symbol))
      .reduce((m, r) => { m[r.symbol] = { date: r.date, close: r.close }; return m; }, {}),
  };
}
