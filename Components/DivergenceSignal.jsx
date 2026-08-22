'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadMarketData } from '../lib/supabase';

// Our own signal: treat the contrarian composite as an oscillator and compare its
// swing highs/lows against SPX's over the last ~2 weeks. Classic divergence read:
// a new price high the sentiment doesn't confirm (or a new low it doesn't confirm)
// often precedes a turn.
const LOOK = 10; // trading days per comparison window

function detect(rows) {
  if (rows.length < LOOK * 2 + 1) return { type: 'insufficient' };
  const recent = rows.slice(-LOOK);
  const prior = rows.slice(-LOOK * 2, -LOOK);
  const maxBy = (a, k) => a.reduce((m, x) => (x[k] > m[k] ? x : m));
  const minBy = (a, k) => a.reduce((m, x) => (x[k] < m[k] ? x : m));
  const rH = maxBy(recent, 'price'), pH = maxBy(prior, 'price');
  const rL = minBy(recent, 'price'), pL = minBy(prior, 'price');

  if (rH.price > pH.price && rH.score < pH.score - 2) return { type: 'bearish', a: pH, b: rH };
  if (rL.price < pL.price && rL.score > pL.score + 2) return { type: 'bullish', a: pL, b: rL };

  const last = rows[rows.length - 1], ref = rows[rows.length - 1 - LOOK];
  const dP = last.price - ref.price, dS = last.score - ref.score;
  if (Math.sign(dP) === Math.sign(dS) && Math.abs(dS) >= 3) return { type: 'confirm' };
  return { type: 'inline' };
}

const STATE = {
  bearish: {
    label: 'BEARISH DIVERGENCE', color: '#f64f68',
    text: 'SPX pushed to a higher high, but the sentiment composite made a lower high — the advance isn’t confirmed. Conviction is thinning; watch for a stall or reversal.',
  },
  bullish: {
    label: 'BULLISH DIVERGENCE', color: '#23d18b',
    text: 'SPX slid to a lower low, but the sentiment composite made a higher low — sellers are running out of steam. A bottoming tell; watch for a turn up.',
  },
  confirm: {
    label: 'IN CONFIRMATION', color: '#8ea3c6',
    text: 'Price and sentiment are moving together — no divergence. The current move has conviction behind it.',
  },
  inline: {
    label: 'NO DIVERGENCE', color: '#8497b3',
    text: 'Price and sentiment are roughly in line right now — nothing notable to flag.',
  },
  insufficient: {
    label: '—', color: '#586a86',
    text: 'Not enough aligned history yet to read a divergence.',
  },
};

export default function DivergenceSignal({ history }) {
  const [spx, setSpx] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const start = new Date(); start.setDate(start.getDate() - 120);
    loadMarketData('SPX', start.toISOString().slice(0, 10))
      .then((rows) => { if (!cancelled) setSpx(rows); })
      .catch(() => { if (!cancelled) setSpx([]); });
    return () => { cancelled = true; };
  }, []);

  const result = useMemo(() => {
    if (!spx) return null;
    const scoreMap = {};
    for (const h of history || []) {
      const s = h.eod_score ?? h.live_score;
      if (h.date && s != null) scoreMap[h.date] = Number(s);
    }
    const rows = [];
    for (const r of spx) {
      const s = scoreMap[r.date];
      if (s != null) rows.push({ date: r.date, price: Number(r.close), score: s });
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    return detect(rows.slice(-40));
  }, [spx, history]);

  if (!result) return null;
  const st = STATE[result.type] || STATE.inline;

  return (
    <section className="surface p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="eyebrow">Sentiment × price divergence</div>
        <span className="pill font-semibold" style={{ color: st.color, borderColor: st.color + '55', background: st.color + '14' }}>
          {st.label}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-dashboard-text">{st.text}</p>
      <p className="mt-1.5 font-mono text-[10px] tracking-wide text-dashboard-faint">
        Compares SPX swing highs/lows against the sentiment composite over the last ~2 weeks.
      </p>
    </section>
  );
}
