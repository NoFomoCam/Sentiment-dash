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
