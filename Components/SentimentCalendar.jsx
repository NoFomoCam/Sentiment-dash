'use client';

import { useMemo } from 'react';

// Fear -> greed ramp (matches the instrument palette). Extremes vivid, neutral recedes.
const STOPS = [
  [20, [35, 209, 139]], [35, [95, 214, 105]], [45, [150, 224, 79]],
  [50, [247, 183, 55]], [58, [251, 150, 66]], [70, [249, 118, 72]], [82, [246, 79, 104]],
];
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function rampRGB(s) {
  if (s <= STOPS[0][0]) return STOPS[0][1];
  if (s >= STOPS[STOPS.length - 1][0]) return STOPS[STOPS.length - 1][1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (s >= a[0] && s <= b[0]) {
      const t = (s - a[0]) / (b[0] - a[0]);
      return [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)];
    }
  }
  return [247, 183, 55];
}
function heatColor(s) {
  const c = rampRGB(s);
  const inten = Math.min(1, Math.abs(s - 50) / 26);
  return `rgba(${c[0]},${c[1]},${c[2]},${(0.32 + 0.68 * inten).toFixed(3)})`;
}
const solid = (s) => { const c = rampRGB(s); return `rgb(${c[0]},${c[1]},${c[2]})`; };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PITCH = 15; // cell (12px) + gap (3px)

export default function SentimentCalendar({ history }) {
  const { map, weeks, monthMarks, months } = useMemo(() => {
    const map = {};
    for (const h of history || []) {
      const s = h.eod_score ?? h.live_score;
      if (h.date && s != null) map[h.date] = Number(s);
    }
    const dates = Object.keys(map).sort();
    if (!dates.length) return { map, weeks: [], monthMarks: [], months: [] };

    const maxD = new Date(dates[dates.length - 1] + 'T00:00:00');
    const firstD = new Date(dates[0] + 'T00:00:00');
    const wanted = new Date(maxD); wanted.setDate(wanted.getDate() - 364);
    const start = new Date(wanted > firstD ? wanted : firstD);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday

    const weeks = [], monthMarks = [];
    let col = 0, lastMonth = -1;
    const cur = new Date(start);
    while (cur <= maxD) {
      const wk = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(cur); d.setDate(cur.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        wk.push({ key, score: map[key] });
      }
      if (cur.getMonth() !== lastMonth) { monthMarks.push({ col, label: MON[cur.getMonth()] }); lastMonth = cur.getMonth(); }
      weeks.push(wk); col++; cur.setDate(cur.getDate() + 7);
    }

    const months = [];
    for (let back = 1; back >= 0; back--) {
      const d = new Date(maxD.getFullYear(), maxD.getMonth() - back, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return { map, weeks, monthMarks, months };
  }, [history]);

  if (!weeks.length) return null;

  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Sentiment calendar · past year</div>
          <div className="mt-1 text-[11px] text-dashboard-faint">Every trading day, tinted by its contrarian score — extremes glow, neutral recedes.</div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-dashboard-faint">
          <span style={{ color: solid(20) }}>FEAR</span>
          <span className="h-1.5 w-24 rounded-full" style={{ background: 'linear-gradient(90deg,#23d18b,#8fe04f,#f7b737,#fb8a3c,#f64f68)' }} />
          <span style={{ color: solid(80) }}>GREED</span>
        </div>
      </div>

      {/* Year heatmap */}
      <div className="overflow-x-auto pb-1">
        <div className="relative mb-1 h-3" style={{ minWidth: weeks.length * PITCH + 'px' }}>
          {monthMarks.map((m, i) => (
            <span key={i} className="absolute font-mono text-[9px] text-dashboard-faint" style={{ left: m.col * PITCH + 'px' }}>{m.label}</span>
          ))}
        </div>
        <div className="inline-grid gap-[3px]" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(5, 1fr)' }}>
          {weeks.flatMap((wk, ci) => wk.map((cell, ri) => (
            <div
              key={ci + '-' + ri}
              title={cell.score != null ? `${cell.key} · ${cell.score}` : cell.key}
              className="h-[12px] w-[12px] rounded-[3px]"
              style={{ background: cell.score != null ? heatColor(cell.score) : '#0e1420', border: '1px solid rgba(255,255,255,0.03)' }}
            />
          )))}
        </div>
      </div>

      {/* Recent month detail */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {months.map((m, mi) => <MonthCard key={mi} year={m.year} month={m.month} map={map} />)}
      </div>
    </section>
  );
}

function MonthCard({ year, month, map }) {
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ d, key, score: map[key] });
  }
  return (
    <div className="rounded-lg border border-dashboard-hairline bg-dashboard-bg/40 p-3">
      <div className="mb-2 font-mono text-[11px] tracking-wide text-dashboard-muted">{MON[month]} {year}</div>
      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d, i) => <div key={'h' + i} className="text-center font-mono text-[8px] text-dashboard-faint">{d}</div>)}
        {cells.map((c, i) => c == null ? <div key={i} /> : (
          <div
            key={i}
            title={c.score != null ? `${c.key} · ${c.score}` : c.key}
            className="flex aspect-square items-center justify-center rounded font-mono text-[11px] font-semibold"
            style={c.score != null ? { background: heatColor(c.score), color: 'rgba(255,255,255,0.92)' } : { background: '#0e1420', color: '#586a86' }}
          >
            {c.score != null ? c.score : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
