import { refreshAll } from '../../../../lib/marketFetchers';

// Node runtime (needs fetch + a little time); allow up to 60s for the sweep.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const dry = new URL(req.url).searchParams.get('dry') === '1';
    const summary = await refreshAll({ dry });
    return Response.json({ ok: true, at: new Date().toISOString(), ...summary });
  } catch (e) {
    console.error('cron refresh failed:', e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
