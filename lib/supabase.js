import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function saveDailyReading(data) {
  const { data: result, error } = await supabase
    .from('daily_readings')
    .upsert({
      date: data.date,
      live_score: data.liveScore,
      eod_score: data.eodScore,
      vix: data.vix,
      vix9d: data.vix9d,
      vix3m: data.vix3m,
      dxy: data.dxy,
      spy: data.spy,
      spx: data.spx,
      rsp: data.rsp,
      nvda: data.nvda,
      smh: data.smh,
      gld: data.gld,
      hyg: data.hyg,
      lqd: data.lqd,
      nyad: data.nyad,
      fear_greed: data.fear_greed,
      pcr: data.pcr,
      drawdown_pct: data.drawdown_pct,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'date' });

  if (error) console.error('Save error:', error);
  return { result, error };
}

export async function loadHistory() {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('daily_readings')
      .select('*')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('Load error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function loadHistoryRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('daily_readings')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) console.error('Range load error:', error);
  return data || [];
}

// Load OHLC candles for a single symbol from market_data (public read).
// Optional startDate/endDate are inclusive 'YYYY-MM-DD' bounds.
export async function loadMarketData(symbol, startDate, endDate) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from('market_data')
      .select('date, open, high, low, close, volume')
      .eq('symbol', symbol)
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (startDate) q = q.gte('date', startDate);
    if (endDate) q = q.lte('date', endDate);
    const { data, error } = await q;
    if (error) { console.error('market_data load error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// Recent closes for every symbol, grouped by symbol (ascending by date).
// Used to build today's live reading + a real SPX drawdown window.
export async function loadMarketSnapshot(days = 120) {
  const { data: latest } = await supabase
    .from('market_data')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);
  if (!latest || latest.length === 0) return {};
  const maxDate = new Date(latest[0].date);
  const since = new Date(maxDate);
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('market_data')
      .select('symbol, date, close')
      .gte('date', sinceStr)
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('snapshot load error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const grouped = {};
  for (const r of all) {
    (grouped[r.symbol] ||= []).push({ date: r.date, close: Number(r.close) });
  }
  return grouped;
}

// Latest bar per symbol (date, close, source) for the ops/status view.
// One tiny indexed query per symbol so stale series still report their real
// last date. Pass the expected symbol list so gaps show up as "no data".
export async function loadMarketFreshness(symbols) {
  return Promise.all(
    symbols.map(async (symbol) => {
      const { data, error } = await supabase
        .from('market_data')
        .select('date, close, source')
        .eq('symbol', symbol)
        .order('date', { ascending: false })
        .limit(1);
      if (error) {
        console.error('freshness load error', symbol, error);
        return { symbol, latest: null, close: null, source: null };
      }
      const r = data?.[0];
      return {
        symbol,
        latest: r?.date ?? null,
        close: r ? Number(r.close) : null,
        source: r?.source ?? null,
      };
    })
  );
}

// Distinct symbols available in market_data, for populating the selector.
export async function loadMarketSymbols() {
  const { data, error } = await supabase
    .from('market_data')
    .select('symbol')
    .order('symbol', { ascending: true });
  if (error) { console.error('symbols load error:', error); return []; }
  return [...new Set((data || []).map(r => r.symbol))];
}

export async function saveInputValues(userId, curr, prev) {
  const { error } = await supabase
    .from('user_inputs')
    .upsert({
      user_id: userId || 'default',
      curr_values: curr,
      prev_values: prev,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) console.error('Save input error:', error);
  return !error;
}

export async function loadInputValues(userId) {
  const { data, error } = await supabase
    .from('user_inputs')
    .select('*')
    .eq('user_id', userId || 'default')
    .single();

  if (error && error.code !== 'PGRST116') console.error('Load input error:', error);
  return data;
}
