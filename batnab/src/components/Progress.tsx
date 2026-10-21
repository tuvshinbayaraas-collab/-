import {TrendingUp} from 'lucide-react';
import {useState} from 'react';
import {useHistory} from '../lib/history';
import {grade, percent, type Grade} from '../lib/keys';
import type {Result} from '../lib/results';
import {weekStart} from '../lib/week';
import {testInfo} from '../tests';

const DAY = 86_400_000;
const BAR = '#3987e5'; // categorical slot 1 (dark), validated on the #171717 surface
const short = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

export interface WeekPoint {
  week: number;
  /** Mean of each test's best percentage that week; null when nothing was graded. */
  pct: number | null;
  tests: {title: string; score?: number; total: number}[];
  current: boolean;
}

/** A student's weeks: the saved history, plus this week from the live results. */
export function useWeeks(uid: string | undefined, results: Result[] | null, keys: Record<string, string | null | undefined>) {
  const history = useHistory(uid);
  if (!history || !results) return null;
  const points: WeekPoint[] = Object.entries(history)
    .map(([w, tests]) => {
      const list = Object.entries(tests).map(([t, v]) => ({title: testInfo(t)?.title ?? t, score: v.score, total: v.total}));
      const graded = list.filter((x) => typeof x.score === 'number');
      return {week: Number(w), pct: graded.length ? graded.reduce((a, x) => a + (x.score! / x.total) * 100, 0) / graded.length : null, tests: list, current: false};
    })
    .sort((a, b) => a.week - b.week);
  const best = new Map<string, Grade | null>();
  for (const r of results) {
    const g = grade(r.answers, keys[r.test], testInfo(r.test)?.count ?? 30);
    const b = best.get(r.test);
    if (!best.has(r.test) || (g && (!b || percent(g) > percent(b)))) best.set(r.test, g);
  }
  if (best.size) {
    const tests = [...best].map(([t, g]) => ({title: testInfo(t)?.title ?? t, score: g?.score, total: g?.total ?? testInfo(t)?.count ?? 30}));
    const graded = [...best.values()].filter((g): g is Grade => !!g);
    points.push({week: weekStart(), pct: graded.length ? graded.reduce((a, g) => a + percent(g), 0) / graded.length : null, tests, current: true});
  }
  return points.slice(-10);
}

/** Week by week, the average of the best score in each test: a column per week, newest on the right. */
export function ProgressChart({points}: {points: WeekPoint[]}) {
  const [hover, setHover] = useState<number | null>(null);
  const graded = points.filter((p) => p.pct !== null);
  const top = graded.reduce<WeekPoint | null>((b, p) => (!b || p.pct! > b.pct! ? p : b), null);
  const last = [...points].reverse().find((p) => p.pct !== null);
  const change = graded.length >= 2 ? Math.round(graded.at(-1)!.pct! - graded.at(-2)!.pct!) : null;

  return (
    <section className="rounded-2xl bg-neutral-900 p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 font-semibold">
          <TrendingUp size={18} className="text-blue-300" /> Ахиц
        </h2>
        <p className="text-sm text-neutral-400">Долоо хоног бүрийн тестүүдийн шилдэг оноо (дундаж)</p>
        {change !== null && <p className={`ml-auto text-sm font-semibold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{change >= 0 ? `▲ ${change}%` : `▼ ${-change}%`} өмнөх долоо хоногоос</p>}
      </div>
      {!points.length ? (
        <p className="mt-3 text-sm text-neutral-400">Тест өгөхөд долоо хоног бүрийн дүн энд хадгалагдаж, ахиц тань харагдана.</p>
      ) : (
        <>
          <div className="relative mt-4 h-40 pl-9">
            {[100, 50, 0].map((v) => (
              <div key={v} className="absolute left-9 right-0 border-t border-neutral-800" style={{bottom: `${v}%`}}>
                <span className="absolute -left-9 -translate-y-1/2 text-[10px] tabular-nums text-neutral-500">{v}%</span>
              </div>
            ))}
            <div className="relative flex h-full items-end gap-[2px]">
              {points.map((p, i) => {
                const label = p.pct === null ? null : `${Math.round(p.pct)}%`;
                const show = p === last || p === top;
                return (
                  <div
                    key={p.week}
                    className="relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                    tabIndex={0}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${short(p.week)}–${short(p.week + 6 * DAY)}: ${label ?? 'дүнгүй'}`}
                  >
                    {p.pct !== null ? (
                      <div className="relative w-full max-w-10 rounded-t-[4px]" style={{height: `${Math.max(p.pct, 2)}%`, background: BAR, opacity: hover === null || hover === i ? 1 : 0.55}}>
                        {show && <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums text-neutral-100">{label}</span>}
                      </div>
                    ) : (
                      <span className="mb-1 text-xs text-neutral-600">—</span>
                    )}
                    {hover === i && (
                      <div className={`absolute bottom-full z-10 mb-2 w-44 rounded-lg bg-neutral-800 p-2 text-xs shadow-xl ring-1 ring-white/10 ${i > points.length / 2 ? 'right-0' : 'left-0'}`}>
                        <p className="font-semibold text-neutral-100">
                          {short(p.week)}–{short(p.week + 6 * DAY)}
                          {p.current && ' (энэ долоо хоног)'}
                        </p>
                        <p className="mt-0.5 text-neutral-300">Дундаж: {label ?? '—'}</p>
                        {p.tests.map((t) => (
                          <p key={t.title} className="text-neutral-400">
                            {t.title}: {typeof t.score === 'number' ? `${t.score}/${t.total}` : 'түлхүүргүй'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex gap-[2px] pl-9">
            {points.map((p) => (
              <span key={p.week} className={`flex-1 text-center text-[10px] tabular-nums ${p.current ? 'font-semibold text-neutral-300' : 'text-neutral-500'}`}>
                {p.current ? 'Энэ 7 хоног' : short(p.week)}
              </span>
            ))}
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">Хүснэгтээр харах</summary>
            <table className="mt-2 w-full text-left">
              <thead className="text-xs text-neutral-500">
                <tr>
                  <th className="py-1 font-medium">Долоо хоног</th>
                  <th className="py-1 font-medium">Тестүүд</th>
                  <th className="py-1 text-right font-medium">Дундаж</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.week} className="border-t border-neutral-800">
                    <td className="py-1.5 tabular-nums">{p.current ? 'Энэ долоо хоног' : `${short(p.week)}–${short(p.week + 6 * DAY)}`}</td>
                    <td className="py-1.5 text-neutral-400">{p.tests.map((t) => `${t.title} ${typeof t.score === 'number' ? `${t.score}/${t.total}` : '—'}`).join(', ')}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{p.pct === null ? '—' : `${Math.round(p.pct)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
