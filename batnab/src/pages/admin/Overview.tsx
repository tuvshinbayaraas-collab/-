import {AlertTriangle, ArrowLeft, ChevronRight, KeyRound} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import Avatar from '../../components/Avatar';
import MathText from '../../components/MathText';
import {formatTime} from '../../lib/attempt';
import {percent} from '../../lib/keys';
import {Link} from '../../lib/router';
import {shownName} from '../../lib/session';
import {TESTS, testInfo} from '../../tests';
import {LETTERS} from '../../tests/types';
import {gradeOf, mean, reports, testReport, timeAgo, type AdminData, type QuestionStat, type Student, type TestReport} from './data';
import {useTest} from './useTest';

// Chart colours (dark surface #171717): one series, blue; "hard question" uses the warning status with an icon + label.
const SERIES = '#3987e5';
const TRACK = '#0d366b';
const WARNING = '#fab219';

export function Stat({label, value, sub}: {label: string; value: ReactNode; sub?: ReactNode}) {
  return (
    <div className="rounded-2xl bg-neutral-900 p-4">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

export function StudentName({student, sub}: {student: Student; sub?: ReactNode}) {
  const p = student.profile;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={shownName(p)} photo={p.photo} size={32} />
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {p.name}
          {p.nickname && <span className="font-normal text-neutral-400"> ({p.nickname})</span>}
        </span>
        <span className="block truncate text-xs text-neutral-500">{sub ?? `@${p.username}`}</span>
      </span>
    </span>
  );
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x)}%`);

export default function Overview({data, test}: {data: AdminData; test?: string}) {
  const info = test ? testInfo(test) : undefined;
  if (info) return <TestDetail report={testReport(info, data)} />;

  const all = reports(data);
  const active = data.students.filter((s) => !s.profile.disabled);
  const takers = new Set(data.results.map((r) => r.uid));
  const graded = all.flatMap((r) => r.firstPercents);
  const keyless = all.filter((r) => r.rows.length && !r.key);
  const byUid = new Map(data.students.map((s) => [s.uid, s]));

  if (!data.students.length)
    return (
      <div className="rounded-2xl bg-neutral-900 p-6 text-center">
        <p className="font-semibold">Одоогоор сурагч бүртгэгдээгүй байна.</p>
        <p className="mt-1 text-sm text-neutral-400">Эхлээд сурагчдынхаа бүртгэлийг үүсгээд, тестүүдийн түлхүүрийг оруулна уу.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href="/admin?tab=students" className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400">
            Сурагч нэмэх
          </Link>
          <Link href="/admin?tab=keys" className="rounded-full border border-neutral-700 px-5 py-2 text-sm font-medium hover:bg-neutral-800">
            Түлхүүр оруулах
          </Link>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Сурагч" value={active.length} sub={data.students.length > active.length ? `${data.students.length - active.length} хаалттай` : undefined} />
        <Stat label="Тест өгсөн" value={takers.size} sub="сурагч" />
        <Stat label="Нийт оролдлого" value={data.results.length} />
        <Stat label="Дундаж оноо" value={pct(mean(graded))} sub="эхний оролдлогоор" />
      </div>

      {keyless.map((r) => (
        <Link key={r.info.id} href={`/admin?tab=keys&test=${r.info.id}`} className="flex items-center gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 hover:bg-amber-500/15">
          <KeyRound size={18} className="shrink-0" />
          <span className="flex-1">
            {r.info.title}-ийн түлхүүр оруулаагүй байна: {r.rows.length} сурагчийн дүн гараагүй.
          </span>
          <ChevronRight size={16} />
        </Link>
      ))}

      <section>
        <h2 className="mb-2 font-semibold">Тестүүд</h2>
        <div className="overflow-x-auto rounded-2xl bg-neutral-900">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-left text-neutral-400">
              <tr className="border-b border-neutral-800">
                <th className="px-4 py-2.5 font-medium">Тест</th>
                <th className="px-4 py-2.5 font-medium">Өгсөн</th>
                <th className="px-4 py-2.5 font-medium">Дундаж (эхний)</th>
                <th className="px-4 py-2.5 font-medium">Түлхүүр</th>
                <th />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {all.map((r) => {
                const filled = r.key ? r.key.replace(/-/g, '').length : 0;
                return (
                  <tr key={r.info.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/50">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/admin?tab=overview&test=${r.info.id}`} className="hover:underline">
                        {r.info.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.rows.length}/{r.rows.length + r.missing.length}
                    </td>
                    <td className="px-4 py-2.5">{pct(mean(r.firstPercents))}</td>
                    <td className="px-4 py-2.5">
                      {filled === r.info.count ? <span className="text-green-400">Бүрэн</span> : filled ? <span className="text-amber-300">{filled}/{r.info.count}</span> : <span className="text-neutral-500">Байхгүй</span>}
                    </td>
                    <td className="px-2 text-right">
                      <Link href={`/admin?tab=overview&test=${r.info.id}`} aria-label={`${r.info.title} анализ`} className="inline-flex p-1 text-neutral-500 hover:text-neutral-200">
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Сүүлийн оролдлогууд</h2>
        {!data.results.length ? (
          <p className="text-sm text-neutral-400">Одоогоор хэн ч тест өгөөгүй байна.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {data.results.slice(0, 12).map((r) => {
              const g = gradeOf(r, data.keys);
              return (
                <li key={r.id}>
                  <Link href={`/review/${r.test}/${r.id}?u=${r.uid}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800/50">
                    <span className="min-w-0 flex-1">
                      <StudentName student={byUid.get(r.uid)!} sub={`${testInfo(r.test)!.title} • ${timeAgo(r.at)} • ${formatTime(r.seconds)}`} />
                    </span>
                    <span className="shrink-0 text-right tabular-nums">{g ? `${g.score}/${g.total}` : <span className="text-neutral-500">түлхүүргүй</span>}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function TestDetail({report}: {report: TestReport}) {
  const {info, rows, missing, firstPercents, key} = report;
  const [sort, setSort] = useState<'num' | 'hard'>('num');
  const test = useTest(info.id);
  const scores = rows.flatMap((r) => (r.first ? [r.first] : []));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin?tab=overview" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft size={16} /> Бүх тест
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">{info.title}</h2>
          <div className="flex gap-1">
            {TESTS.map((t) => (
              <Link
                key={t.id}
                href={`/admin?tab=overview&test=${t.id}`}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.id === info.id ? 'bg-neutral-100 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
              >
                {t.title.replace('Тест ', '')}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {!key && (
        <Link href={`/admin?tab=keys&test=${info.id}`} className="flex items-center gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 hover:bg-amber-500/15">
          <KeyRound size={18} /> <span className="flex-1">Түлхүүр оруулаагүй тул оноо тооцох боломжгүй. Түлхүүр оруулах</span> <ChevronRight size={16} />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Өгсөн" value={`${rows.length}/${rows.length + missing.length}`} sub="сурагч" />
        <Stat label="Дундаж оноо" value={pct(mean(firstPercents))} sub="эхний оролдлогоор" />
        <Stat
          label="Хамгийн өндөр"
          value={scores.length ? `${Math.max(...scores.map((g) => g.score))}/${scores[0].total}` : '—'}
          sub={scores.length ? `хамгийн бага ${Math.min(...scores.map((g) => g.score))}` : undefined}
        />
        <Stat label="Дундаж хугацаа" value={report.avgSeconds === null ? '—' : formatTime(report.avgSeconds)} />
      </div>

      {rows.length > 0 && key && (
        <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
          <h3 className="font-semibold">Онооны тархалт</h3>
          <p className="text-sm text-neutral-400">Сурагч бүрийн эхний оролдлого, хувиар</p>
          <Histogram report={report} />
        </section>
      )}

      {rows.length > 0 && (
        <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Бодлого бүрээр</h3>
              <p className="text-sm text-neutral-400">Зөв бодсон сурагчдын хувь (эхний оролдлого), номын дугаараар. “Буруу” нь хамгийн олон сонгосон буруу хариулт.</p>
            </div>
            <div className="flex rounded-full bg-neutral-800 p-0.5 text-xs">
              {(
                [
                  ['num', 'Дугаараар'],
                  ['hard', 'Хүндээс нь'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => setSort(id)} className={`rounded-full px-3 py-1 font-medium ${sort === id ? 'bg-neutral-100 text-black' : 'text-neutral-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <QuestionTable questions={report.questions} takers={rows.length} sort={sort} preview={(i) => test?.questions[i]?.q} />
        </section>
      )}

      <section>
        <h3 className="mb-2 font-semibold">Сурагчид</h3>
        {!rows.length ? (
          <p className="text-sm text-neutral-400">Энэ тестийг одоогоор хэн ч өгөөгүй байна.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-neutral-900">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-neutral-400">
                <tr className="border-b border-neutral-800">
                  <th className="px-4 py-2.5 font-medium">Сурагч</th>
                  <th className="px-3 py-2.5 font-medium">Удаа</th>
                  <th className="px-3 py-2.5 font-medium">Эхний</th>
                  <th className="px-3 py-2.5 font-medium">Шилдэг</th>
                  <th className="px-3 py-2.5 font-medium">Хугацаа</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...rows]
                  .sort((a, b) => (b.first ? percent(b.first) : -1) - (a.first ? percent(a.first) : -1))
                  .map((r) => (
                    <tr key={r.student.uid} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/50">
                      <td className="px-4 py-2">
                        <Link href={`/admin/student/${r.student.uid}`}>
                          <StudentName student={r.student} />
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r.attempts.length}</td>
                      <td className="px-3 py-2">
                        <Link href={`/review/${info.id}/${r.attempts[0].id}?u=${r.student.uid}`} className="hover:underline">
                          {r.first ? `${r.first.score}/${r.first.total}` : '—'}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r.best ? `${r.best.score}/${r.best.total}` : '—'}</td>
                      <td className="px-3 py-2">{formatTime(r.attempts[0].seconds)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {missing.length > 0 && (
          <p className="mt-3 text-sm text-neutral-400">
            <span className="text-neutral-300">Өгөөгүй ({missing.length}):</span> {missing.map((s) => s.profile.name).join(', ')}
          </p>
        )}
      </section>
    </div>
  );
}

/** Students per 10% band of their first-attempt score. */
function Histogram({report}: {report: TestReport}) {
  const [hover, setHover] = useState<number | null>(null);
  const bins = Array.from({length: 10}, (_, b) => report.rows.filter((r) => r.first && Math.min(9, Math.floor(percent(r.first) / 10)) === b));
  const max = Math.max(1, ...bins.map((b) => b.length));
  const H = 140;
  const label = (b: number) => (b === 9 ? '90–100%' : `${b * 10}–${b * 10 + 9}%`);

  return (
    <div className="relative mt-4">
      <div className="flex items-end gap-0.5 border-b border-neutral-700" style={{height: H + 20}}>
        {bins.map((bin, b) => {
          const h = bin.length ? Math.max(4, (bin.length / max) * H) : 0;
          return (
            <div
              key={b}
              tabIndex={0}
              onPointerEnter={() => setHover(b)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(b)}
              onBlur={() => setHover(null)}
              aria-label={`${label(b)}: ${bin.length} сурагч`}
              className="relative flex h-full flex-1 flex-col items-center justify-end outline-none focus-visible:bg-neutral-800/60"
            >
              {bin.length > 0 && <span className="mb-1 text-xs tabular-nums text-neutral-300">{bin.length}</span>}
              <div className="w-full max-w-6 rounded-t" style={{height: h, background: SERIES, opacity: hover === null || hover === b ? 1 : 0.55}} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5 text-[10px] tabular-nums text-neutral-500">
        {bins.map((_, b) => (
          <span key={b} className="flex-1 text-center">
            {b * 10}
          </span>
        ))}
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-48 rounded-lg bg-neutral-800 p-2.5 text-xs shadow-xl"
          style={{left: `clamp(0px, calc(${(hover + 0.5) * 10}% - 6rem), calc(100% - 12rem))`}}
        >
          <p className="text-base font-semibold">{bins[hover].length} сурагч</p>
          <p className="text-neutral-400">{label(hover)}</p>
          {bins[hover].length > 0 && <p className="mt-1 text-neutral-300">{bins[hover].map((r) => r.student.profile.name).join(', ')}</p>}
        </div>
      )}
    </div>
  );
}

function QuestionTable({questions, takers, sort, preview}: {questions: QuestionStat[]; takers: number; sort: 'num' | 'hard'; preview: (i: number) => string | undefined}) {
  const rate = (q: QuestionStat) => (q.key === null ? null : (q.correct / takers) * 100);
  const list = sort === 'num' ? questions : [...questions].sort((a, b) => (rate(a) ?? 101) - (rate(b) ?? 101));
  return (
    <ul className="mt-4 divide-y divide-neutral-800">
      {list.map((q) => {
        const r = rate(q);
        const text = preview(q.i);
        return (
          <li key={q.i} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[2rem_minmax(0,1fr)_10rem_12rem]">
            <span className="font-semibold tabular-nums">{q.i + 1}.</span>
            <span className="relative min-w-0 truncate text-neutral-400">{text ? <MathText text={text} /> : null}</span>
            <span className="col-start-2 flex items-center gap-2 sm:col-start-3">
              <span className="h-2 flex-1 overflow-hidden rounded-full" style={{background: TRACK}}>
                {r !== null && <span className="block h-full rounded-full" style={{width: `${r}%`, background: SERIES}} />}
              </span>
              <span className="w-10 text-right tabular-nums">{r === null ? '—' : `${Math.round(r)}%`}</span>
            </span>
            <span className="col-start-3 row-start-1 flex items-center justify-end gap-2 whitespace-nowrap text-xs text-neutral-400 sm:row-start-auto sm:col-start-4">
              {r !== null && r < 50 && (
                <span className="flex items-center gap-1 font-medium text-neutral-200">
                  <AlertTriangle size={13} color={WARNING} /> Хүнд
                </span>
              )}
              {q.key === null ? 'түлхүүргүй' : q.topWrong !== null ? `Зөв ${LETTERS[q.key]} • буруу ${LETTERS[q.topWrong]}` : `Зөв ${LETTERS[q.key]}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
