// Server-side daily fetchers for the cron refresh. Pulls the latest bars from
// each free source and upserts into market_data using the SERVICE_ROLE key
// (bypasses RLS — must never be exposed to the client).
//
// Mirrors the one-off Python backfill scripts, but only grabs a short recent
// window (last ~7 points) since it runs daily. Full history was seeded once.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';
const TAIL = 7; // how many recent points to upsert per series each run

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

// Run all four fetchers, upsert everything, return a per-source summary.
// { dry: true } skips the write (test without the service_role key).
export async function refreshAll({ dry = false } = {}) {
  const [yahoo, cboe, cnn, wsj] = await Promise.all([
    fetchYahoo(), fetchCboe(), fetchCnn(), fetchWsjAdd(),
  ]);
  const all = [...yahoo, ...cboe, ...cnn, ...wsj];
  const upserted = dry ? 0 : await upsert(all);
  return {
    dry,
    upserted,
    counts: { yahoo: yahoo.length, cboe: cboe.length, cnn: cnn.length, wsj: wsj.length },
    latest: all.filter(r => ['SPX', 'VIX', 'FG', 'PCR', 'ADD'].includes(r.symbol))
      .reduce((m, r) => { m[r.symbol] = { date: r.date, close: r.close }; return m; }, {}),
  };
}
