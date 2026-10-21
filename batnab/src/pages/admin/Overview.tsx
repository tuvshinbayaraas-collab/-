import {AlertTriangle, ArrowLeft, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, KeyRound, UserX} from 'lucide-react';
import {useRef, useState, type ReactNode} from 'react';
import Avatar from '../../components/Avatar';
import MathText from '../../components/MathText';
import {formatDuration} from '../../lib/attempt';
import {percent} from '../../lib/keys';
import {Link, useLocation} from '../../lib/router';
import {shownName} from '../../lib/session';
import {clock} from '../../lib/time';
import {TESTS, testInfo, type TestInfo} from '../../tests';
import {LETTERS, type Question, type Test} from '../../tests/types';
import {gradeOf, mean, reports, testReport, timeAgo, type AdminData, type QuestionStat, type Student, type TestReport} from './data';
import {useTest} from './useTest';
import WeekBanner from './WeekBanner';
import WeakTopics from './WeakTopics';

// Chart colours on the dark surface (#171717). One measure → one hue (blue); the class table uses the same hue as a
// sequential ramp; "hard question" uses the warning status colour, always with an icon and a label.
const SERIES = '#3987e5';
const TRACK = '#0d366b';
const MUTED = '#525252';
const WARNING = '#fab219';
// Re-stepped so the darkest step still stands out from the surface (ramp validator: monotone, even steps, 2.8:1).
const RAMP = [
  {min: 85, bg: '#a3c9f3', fg: '#0b0b0b'},
  {min: 70, bg: '#74ade9', fg: '#0b0b0b'},
  {min: 55, bg: '#4d92e4', fg: '#0b0b0b'},
  {min: 40, bg: '#2a78d6', fg: '#ffffff'},
  {min: 0, bg: '#1d5fb0', fg: '#ffffff'},
];
const rampOf = (p: number) => RAMP.find((r) => p >= r.min)!;
const short = (t: TestInfo) => t.title.replace('Тест ', '');
/** "Батын Болд" → "Б.Болд", the usual short form (initial of the father's name + given name). */
const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}.${parts.slice(1).join(' ')}` : name;
};

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

export function Meter({value, label}: {value: number | null; label?: string}) {
  return (
    <span className="block h-2 overflow-hidden rounded-full" style={{background: TRACK}} role="img" aria-label={label}>
      {value !== null && <span className="block h-full rounded-full" style={{width: `${Math.max(0, Math.min(100, value))}%`, background: SERIES}} />}
    </span>
  );
}

export const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x)}%`);

export default function Overview({data, test}: {data: AdminData; test?: string}) {
  const info = test ? testInfo(test) : undefined;
  if (info) return <TestDetail report={testReport(info, data)} />;

  const all = reports(data);
  const active = data.students.filter((s) => !s.profile.disabled);
  const takers = new Set(data.results.map((r) => r.uid));
  const graded = all.flatMap((r) => r.firstPercents);
  const keyless = all.filter((r) => r.rows.length && !r.key);

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

  const running = Object.entries(data.exams).filter(([, e]) => Date.now() >= e.start && Date.now() <= e.end);

  return (
    <div className="space-y-6">
      {running.map(([t, e]) => {
        const answers = Object.values(data.examAnswers[t] ?? {});
        return (
          <Link key={t} href={`/admin?tab=exams&test=${t}`} className="flex items-center gap-3 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-200 hover:bg-green-500/15">
            <CalendarClock size={18} className="shrink-0" />
            <span className="flex-1">
              Шалгалт явагдаж байна: <span className="font-semibold">{testInfo(t)!.title}</span> ({clock(e.start)}–{clock(e.end)}) • {answers.filter((a) => a.done).length}/{active.length}{' '}
              дуусгасан, {answers.filter((a) => a.leaves > 0).length} нь хуудаснаас гарсан
            </span>
            <ChevronRight size={16} />
          </Link>
        );
      })}
      <WeekBanner data={data} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Сурагч" value={active.length} sub={data.students.length > active.length ? `${data.students.length - active.length} хаалттай` : 'идэвхтэй'} />
        <Stat label="Тест өгсөн" value={`${takers.size}/${active.length}`} sub="энэ долоо хоногт" />
        <Stat label="Оролдлого" value={data.results.length} sub="энэ долоо хоногт" />
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {all.map((r) => {
            const filled = r.key ? r.key.replace(/-/g, '').length : 0;
            const total = r.rows.length + r.missing.length;
            return (
              <Link key={r.info.id} href={`/admin?tab=overview&test=${r.info.id}`} className="group rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800/70">
                <div className="flex flex-wrap items-center justify-between gap-x-2">
                  <span className="font-semibold">{r.info.title}</span>
                  <span className="text-xs">
                    {filled === r.info.count ? (
                      <span className="flex items-center gap-1 text-neutral-400">
                        <Check size={13} className="text-green-400" /> Түлхүүртэй
                      </span>
                    ) : filled ? (
                      <span className="text-amber-300">
                        Түлхүүр {filled}/{r.info.count}
                      </span>
                    ) : (
                      <span className="text-neutral-500">Түлхүүргүй</span>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-3xl font-semibold">{pct(mean(r.firstPercents))}</p>
                <p className="text-xs text-neutral-500">дундаж оноо</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
                  <span className="min-w-16 flex-1">
                    <Meter value={total ? (r.rows.length / total) * 100 : 0} label={`${r.rows.length}/${total} өгсөн`} />
                  </span>
                  <span className="tabular-nums">
                    {r.rows.length}/{total} өгсөн
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <WeakTopics data={data} />

      {/* On a wide screen the class table and the latest attempts sit side by side. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ClassTable data={data} />
        <Recent data={data} />
      </div>
    </div>
  );
}

const RECENT = 5;

/** The latest attempts: a few, more on request. */
function Recent({data}: {data: AdminData}) {
  const [more, setMore] = useState(false);
  const byUid = new Map(data.students.map((s) => [s.uid, s]));
  return (
    <section>
      <h2 className="mb-2 font-semibold">Сүүлийн оролдлогууд</h2>
      {!data.results.length ? (
        <p className="text-sm text-neutral-400">Энэ долоо хоногт хэн ч тест өгөөгүй байна.</p>
      ) : (
        <>
          <ul className="rounded-2xl bg-neutral-900 px-4">
            {data.results.slice(0, more ? 30 : RECENT).map((r) => {
              const g = gradeOf(r, data.keys);
              return (
                <li key={r.id} className="border-b border-neutral-800">
                  <Link href={`/review/${r.test}/${r.id}?u=${r.uid}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className="min-w-0 flex-1">
                      <StudentName student={byUid.get(r.uid)!} sub={`${testInfo(r.test)!.title} • ${timeAgo(r.at)}`} />
                    </span>
                    <span className="shrink-0 text-right tabular-nums">{g ? `${g.score}/${g.total}` : <span className="text-sm text-neutral-500">түлхүүргүй</span>}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {data.results.length > RECENT && (
            <button onClick={() => setMore((m) => !m)} className="mt-2 w-full rounded-full bg-neutral-900 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800">
              {more ? 'Хураах' : `Илүү ихийг харах (${Math.min(30, data.results.length)})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Every student against every test (first attempt, %), coloured on one blue ramp; the numbers are always printed. */
function ClassTable({data}: {data: AdminData}) {
  const [sort, setSort] = useState<'name' | 'avg'>('name');
  const all = reports(data);
  const rows = data.students
    .filter((s) => !s.profile.disabled)
    .map((s) => {
      const cells = all.map((r) => r.rows.find((x) => x.student.uid === s.uid));
      const ps = cells.flatMap((c) => (c?.first ? [percent(c.first)] : []));
      return {s, cells, avg: mean(ps)};
    });
  if (sort === 'avg') rows.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">Ангийн дүн</h2>
          <p className="text-sm text-neutral-400">Тест бүрийн эхний оролдлого, хувиар. Нүдэн дээр дарж хариултыг нь харна.</p>
        </div>
        <div className="flex rounded-full bg-neutral-800 p-0.5 text-xs">
          {(
            [
              ['name', 'Нэрээр'],
              ['avg', 'Дүнгээр'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setSort(id)} className={`rounded-full px-3 py-1 font-medium ${sort === id ? 'bg-neutral-100 text-black' : 'text-neutral-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-neutral-900 p-1.5">
        <table className="w-full border-separate border-spacing-0.5 text-sm">
          <thead>
            <tr className="text-xs text-neutral-400">
              <th className="sticky left-0 z-10 bg-neutral-900 px-2 py-2 text-left font-medium">Сурагч</th>
              {all.map((r) => (
                <th key={r.info.id} className="min-w-10 px-1 py-2 font-medium">
                  <Link href={`/admin?tab=overview&test=${r.info.id}`} className="hover:text-neutral-100">
                    {short(r.info)}
                  </Link>
                </th>
              ))}
              <th className="min-w-10 px-1 py-2 font-medium">
                <span className="sm:hidden">Дунд.</span>
                <span className="hidden sm:inline">Дундаж</span>
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(({s, cells, avg}) => (
              <tr key={s.uid}>
                <th className="sticky left-0 z-10 max-w-28 bg-neutral-900 px-2 py-1 text-left font-normal sm:max-w-64">
                  <Link href={`/admin/student/${s.uid}`} className="block truncate hover:underline" title={s.profile.name}>
                    <span className="sm:hidden">{shortName(s.profile.name)}</span>
                    <span className="hidden sm:inline">{s.profile.name}</span>
                  </Link>
                </th>
                {cells.map((c, i) => {
                  const p = c?.first ? percent(c.first) : null;
                  const color = p === null ? null : rampOf(p);
                  return (
                    <td key={i} className="p-0 text-center">
                      {c ? (
                        <Link
                          href={`/review/${all[i].info.id}/${c.attempts[0].id}?u=${s.uid}`}
                          title={`${s.profile.name}, ${all[i].info.title}: ${c.first ? `${c.first.score}/${c.first.total}` : 'түлхүүргүй'}${c.attempts.length > 1 && c.best ? `, шилдэг ${c.best.score}` : ''}`}
                          className="block rounded-md py-1.5 text-xs font-medium hover:outline hover:outline-2 hover:outline-neutral-300"
                          style={color ? {background: color.bg, color: color.fg} : {background: '#262626', color: '#a3a3a3'}}
                        >
                          {p === null ? '?' : p}
                        </Link>
                      ) : (
                        <span className="block py-1.5 text-xs text-neutral-600">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-1 text-center text-xs font-semibold">{avg === null ? '—' : Math.round(avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RampLegend extra={<span>— өгөөгүй</span>} />
    </section>
  );
}

type View = 'summary' | 'questions' | 'students';
const VIEWS: [View, string][] = [
  ['summary', 'Тойм'],
  ['questions', 'Бодлого'],
  ['students', 'Сурагчид'],
];

/**
 * One test across the class, in three views instead of one long page: Тойм (numbers, spread, hardest questions and
 * the question grid), Бодлого (the grid with one question's detail beside it), Сурагчид (sortable list). The test
 * and view switches stay on screen.
 */
function TestDetail({report}: {report: TestReport}) {
  const {info, rows, missing, key} = report;
  const {query} = useLocation();
  const view = VIEWS.find(([v]) => v === query.get('view'))?.[0] ?? 'summary';
  const test = useTest(info.id);
  const rate = (q: QuestionStat) => (q.key === null || !rows.length ? null : (q.correct / rows.length) * 100);
  const href = (t: string, v: View = view, extra = '') => `/admin?tab=overview&test=${t}${v === 'summary' ? '' : `&view=${v}`}${extra}`;

  return (
    <div className="space-y-5">
      <div className="sticky top-14 z-20 -mx-4 space-y-2 border-b border-neutral-800 bg-[#0f0f0f]/95 px-4 pb-2.5 pt-1.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-1.5">
          <Link href="/admin?tab=overview" aria-label="Бүх тест" title="Бүх тест" className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {TESTS.map((t) => (
              <Link
                key={t.id}
                href={href(t.id)}
                aria-current={t.id === info.id ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${t.id === info.id ? 'bg-neutral-100 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
              >
                {t.title}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 rounded-full bg-neutral-900 p-1 text-sm font-medium" role="tablist">
          {VIEWS.map(([v, label]) => (
            <Link
              key={v}
              href={href(info.id, v)}
              role="tab"
              aria-selected={view === v}
              className={`rounded-full py-1.5 text-center ${view === v ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              {label}
              {v === 'students' && <span className="ml-1 text-xs text-neutral-400">{rows.length}</span>}
            </Link>
          ))}
        </div>
      </div>

      {!key && (
        <Link href={`/admin?tab=keys&test=${info.id}`} className="flex items-center gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 hover:bg-amber-500/15">
          <KeyRound size={18} className="shrink-0" />
          <span className="flex-1">
            Түлхүүр оруулаагүй тул оноо тооцох боломжгүй. Сурагчдын хариулт хадгалагдсан байгаа: түлхүүр оруулмагц бүх дүн, анализ шууд гарна.
          </span>
          <ChevronRight size={16} />
        </Link>
      )}

      {view === 'summary' && <Summary report={report} rate={rate} href={href} />}
      {view === 'questions' && <Questions report={report} rate={rate} test={test} initial={Number(query.get('q')) - 1} />}
      {view === 'students' && <Students report={report} initial={query.get('show') === 'missing' ? 'missing' : 'taken'} />}
      {!rows.length && view !== 'students' && <p className="text-sm text-neutral-400">Энэ долоо хоногт энэ тестийг хэн ч өгөөгүй байна.</p>}
    </div>
  );
}

function Summary({report, rate, href}: {report: TestReport; rate: (q: QuestionStat) => number | null; href: (t: string, v?: View, extra?: string) => string}) {
  const {info, rows, missing, firstPercents, key} = report;
  const scores = rows.flatMap((r) => (r.first ? [r.first] : []));
  const hardest = report.questions
    .filter((q) => rate(q) !== null)
    .sort((a, b) => rate(a)! - rate(b)!)
    .slice(0, 5);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Өгсөн" value={`${rows.length}/${rows.length + missing.length}`} sub="сурагч" />
          <Stat label="Дундаж оноо" value={pct(mean(firstPercents))} sub="эхний оролдлогоор" />
          <Stat
            label="Хамгийн өндөр"
            value={scores.length ? `${Math.max(...scores.map((g) => g.score))}/${scores[0].total}` : '—'}
            sub={scores.length ? `хамгийн бага ${Math.min(...scores.map((g) => g.score))}` : undefined}
          />
          <Stat label="Дундаж хугацаа" value={report.avgSeconds === null ? '—' : formatDuration(report.avgSeconds)} />
        </div>
        {missing.length > 0 && (
          <Link href={href(info.id, 'students', '&show=missing')} className="flex items-center gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm hover:bg-neutral-800/70">
            <UserX size={18} className="shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">Өгөөгүй {missing.length} сурагч: </span>
              <span className="text-neutral-400">{missing.map((s) => s.profile.name).join(', ')}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-neutral-500" />
          </Link>
        )}
      </div>
      {rows.length > 0 && key && (
        <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
          <h3 className="font-semibold">Онооны тархалт</h3>
          <p className="text-sm text-neutral-400">Эхний оролдлогын оноогоор хэдэн сурагч байна</p>
          <Distribution report={report} />
        </section>
      )}
      {rows.length > 0 && key && (
        <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
          <h3 className="font-semibold">Хамгийн хүнд 5 бодлого</h3>
          <p className="text-sm text-neutral-400">Зөв бодсон сурагчдын хувь. Дээр нь дарж дэлгэрэнгүйг харна.</p>
          <ul className="mt-3 space-y-1">
            {hardest.map((q) => (
              <li key={q.i}>
                <Link href={href(info.id, 'questions', `&q=${q.i + 1}`)} className="-mx-2 grid grid-cols-[2.25rem_minmax(0,1fr)_3rem] items-center gap-x-3 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-800/60">
                  <span className="font-semibold tabular-nums">{q.i + 1}.</span>
                  <span>
                    <Meter value={rate(q)} />
                    <span className="mt-1 block text-xs text-neutral-500">
                      Зөв нь {LETTERS[q.key!]}
                      {q.topWrong !== null && `, олонх нь ${LETTERS[q.topWrong]}-г сонгосон (${q.picks[q.topWrong]})`}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">{pct(rate(q))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length > 0 && key && (
        <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">Бодлого бүрээр</h3>
            <Link href={href(info.id, 'questions')} className="text-sm text-blue-400 hover:underline">
              Дэлгэрэнгүй
            </Link>
          </div>
          <p className="text-sm text-neutral-400">Зөв бодсон хувь</p>
          <QuestionGrid questions={report.questions} rate={rate} link={(i) => href(info.id, 'questions', `&q=${i + 1}`)} />
        </section>
      )}
    </div>
  );
}

/** 30 questions as squares on the blue ramp, the percentage printed in each; hard ones (< 50%) carry a warning mark. */
function QuestionGrid({questions, rate, selected, onSelect, link}: {questions: QuestionStat[]; rate: (q: QuestionStat) => number | null; selected?: number; onSelect?: (i: number) => void; link?: (i: number) => string}) {
  return (
    <>
      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-10">
        {questions.map((q) => {
          const r = rate(q);
          const c = r === null ? null : rampOf(r);
          const label = `${q.i + 1}-р бодлого: ${r === null ? 'түлхүүргүй' : `${Math.round(r)}% зөв`}${r !== null && r < 50 ? ', хүнд' : ''}`;
          const cls = `relative flex aspect-square flex-col items-center justify-center rounded-lg leading-tight outline-none focus-visible:ring-2 focus-visible:ring-white hover:brightness-110 ${selected === q.i ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : ''}`;
          const style = c ? {background: c.bg, color: c.fg} : {background: '#262626', color: '#a3a3a3'};
          const body = (
            <>
              <span className="text-[10px] opacity-80">{q.i + 1}</span>
              <span className="text-sm font-semibold tabular-nums">{r === null ? '—' : Math.round(r)}</span>
              {r !== null && r < 50 && <AlertTriangle size={10} color={WARNING} className="absolute right-1 top-1" aria-hidden />}
            </>
          );
          return link ? (
            <Link key={q.i} href={link(q.i)} title={label} aria-label={label} className={cls} style={style}>
              {body}
            </Link>
          ) : (
            <button key={q.i} onClick={() => onSelect?.(q.i)} title={label} aria-label={label} aria-pressed={selected === q.i} className={cls} style={style}>
              {body}
            </button>
          );
        })}
      </div>
      <RampLegend extra={<span className="flex items-center gap-1"><AlertTriangle size={12} color={WARNING} /> хүнд (&lt;50%)</span>} />
    </>
  );
}

function RampLegend({extra}: {extra?: ReactNode}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
      {[...RAMP].reverse().map((r, i, list) => (
        <span key={r.min} className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{background: r.bg}} />
          {r.min}–{i + 1 < list.length ? list[i + 1].min - 1 : 100}%
        </span>
      ))}
      {extra}
    </div>
  );
}

function Questions({report, rate, test, initial}: {report: TestReport; rate: (q: QuestionStat) => number | null; test: Test | null; initial: number}) {
  const qs = report.questions;
  const hardestFirst = qs.filter((q) => rate(q) !== null).sort((a, b) => rate(a)! - rate(b)!)[0]?.i ?? 0;
  const [sel, setSel] = useState(initial >= 0 && initial < qs.length ? initial : hardestFirst);
  const detail = useRef<HTMLDivElement>(null);
  if (!report.rows.length) return null;
  const pick = (i: number) => {
    setSel(i);
    const url = new URL(location.href);
    url.searchParams.set('q', String(i + 1));
    history.replaceState(null, '', url.pathname + url.search);
    // On a phone the detail is under the grid: bring it into view.
    if (window.innerWidth < 1024) detail.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };
  const q = qs[sel];
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <h3 className="font-semibold">Бодлого бүрээр</h3>
        <p className="text-sm text-neutral-400">Зөв бодсон хувь. Дөрвөлжин дээр дарж бодлогыг харна.</p>
        <QuestionGrid questions={qs} rate={rate} selected={sel} onSelect={pick} />
      </section>
      <div ref={detail} className="scroll-mt-40 rounded-2xl bg-neutral-900 p-4 sm:p-5 lg:sticky lg:top-44">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 font-semibold">
            {q.i + 1}-р бодлого <span className="font-normal text-neutral-400">· {pct(rate(q))} зөв</span>
            {rate(q) !== null && rate(q)! < 50 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-neutral-200">
                <AlertTriangle size={13} color={WARNING} /> Хүнд
              </span>
            )}
          </h3>
          <button onClick={() => pick((sel + qs.length - 1) % qs.length)} aria-label="Өмнөх бодлого" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => pick((sel + 1) % qs.length)} aria-label="Дараагийн бодлого" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <ChevronRight size={18} />
          </button>
        </div>
        <QuestionDetail q={q} takers={report.rows.length} question={test?.questions[q.i]} />
      </div>
    </div>
  );
}

type Order = 'score' | 'name' | 'time';
const ORDERS: [Order, string][] = [
  ['score', 'Оноогоор'],
  ['name', 'Нэрээр'],
  ['time', 'Хугацаагаар'],
];
const SHOWN = 10;

function Students({report, initial}: {report: TestReport; initial: 'taken' | 'missing'}) {
  const {info, rows, missing} = report;
  const [show, setShow] = useState<'taken' | 'missing'>(missing.length ? initial : 'taken');
  const [order, setOrder] = useState<Order>('score');
  const [all, setAll] = useState(false);
  const score = (r: (typeof rows)[number]) => (r.first ? percent(r.first) : -1);
  const sorted = [...rows].sort((a, b) =>
    order === 'name' ? a.student.profile.name.localeCompare(b.student.profile.name) : order === 'time' ? a.attempts[0].seconds - b.attempts[0].seconds : score(b) - score(a),
  );
  const list = all ? sorted : sorted.slice(0, SHOWN);
  const chip = (on: boolean) => `shrink-0 rounded-full px-3 py-1 text-sm font-medium ${on ? 'bg-neutral-100 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setShow('taken')} aria-pressed={show === 'taken'} className={chip(show === 'taken')}>
          Өгсөн {rows.length}
        </button>
        <button onClick={() => setShow('missing')} aria-pressed={show === 'missing'} className={chip(show === 'missing')} disabled={!missing.length}>
          Өгөөгүй {missing.length}
        </button>
        {show === 'taken' && rows.length > 1 && (
          <div className="ml-auto flex rounded-full bg-neutral-900 p-0.5 text-xs">
            {ORDERS.map(([o, label]) => (
              <button key={o} onClick={() => setOrder(o)} aria-pressed={order === o} className={`rounded-full px-2.5 py-1 font-medium ${order === o ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {show === 'missing' ? (
        <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
          {missing.map((s) => (
            <li key={s.uid}>
              <Link href={`/admin/student/${s.uid}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800/50">
                <StudentName student={s} sub={`${info.title}-ийг энэ долоо хоногт өгөөгүй`} />
              </Link>
            </li>
          ))}
        </ul>
      ) : !rows.length ? (
        <p className="text-sm text-neutral-400">Энэ долоо хоногт энэ тестийг хэн ч өгөөгүй байна.</p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {list.map((r) => (
              <li key={r.student.uid} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/admin/student/${r.student.uid}`} className="min-w-0 flex-1 hover:opacity-80">
                  <StudentName
                    student={r.student}
                    sub={[
                      r.attempts.length > 1 && r.best ? `шилдэг ${r.best.score}` : '',
                      `${r.attempts.length} удаа`,
                      formatDuration(r.attempts[0].seconds),
                      r.attempts[0].leaves ? `⚠ хуудаснаас ${r.attempts[0].leaves} удаа гарсан` : '',
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  />
                </Link>
                <Link href={`/review/${info.id}/${r.attempts[0].id}?u=${r.student.uid}`} className="shrink-0 rounded-lg px-2 py-1 text-right hover:bg-neutral-800">
                  <span className="block text-lg font-semibold tabular-nums">{r.first ? `${r.first.score}/${r.first.total}` : '—'}</span>
                  <span className="block text-xs text-neutral-500">{r.first ? `${percent(r.first)}%` : 'түлхүүргүй'}</span>
                </Link>
              </li>
            ))}
          </ul>
          {sorted.length > SHOWN && (
            <button onClick={() => setAll((a) => !a)} className="w-full rounded-full bg-neutral-900 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800">
              {all ? 'Хураах' : `Бүгдийг харах (${sorted.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

const BANDS = ['0–19%', '20–39%', '40–59%', '60–79%', '80–100%'];

/** Students per 20% band of their first-attempt score; tap (or hover) a column to list who is in it. */
export function Distribution({report}: {report: TestReport}) {
  const [sel, setSel] = useState<number | null>(null);
  const bins = BANDS.map((_, b) => report.rows.filter((r) => r.first && Math.min(4, Math.floor(percent(r.first) / 20)) === b));
  const max = Math.max(1, ...bins.map((b) => b.length));
  const H = 120;

  return (
    <div className="mt-4">
      <div className="flex items-end border-b border-neutral-700" style={{height: H + 26}}>
        {bins.map((bin, b) => (
          <button
            key={b}
            onClick={() => setSel(sel === b ? null : b)}
            onMouseEnter={() => setSel(b)}
            aria-pressed={sel === b}
            aria-label={`${BANDS[b]}: ${bin.length} сурагч`}
            className={`flex h-full flex-1 flex-col items-center justify-end rounded-t-md outline-none focus-visible:bg-neutral-800 ${sel === b ? 'bg-neutral-800/70' : ''}`}
          >
            <span className="mb-1 text-sm font-medium tabular-nums text-neutral-200">{bin.length}</span>
            <span className="w-6 rounded-t" style={{height: bin.length ? Math.max(4, (bin.length / max) * H) : 0, background: sel === null || sel === b ? SERIES : TRACK}} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex text-center text-xs tabular-nums text-neutral-400">
        {BANDS.map((l) => (
          <span key={l} className="flex-1">
            {l}
          </span>
        ))}
      </div>
      <p className="mt-3 min-h-10 text-sm">
        {sel === null ? (
          <span className="text-neutral-500">Багана дээр дарж тэр хэсгийн сурагчдыг харна.</span>
        ) : bins[sel].length ? (
          <>
            <span className="font-medium">{BANDS[sel]}: </span>
            <span className="text-neutral-400">{bins[sel].map((r) => r.student.profile.name).join(', ')}</span>
          </>
        ) : (
          <span className="text-neutral-500">{BANDS[sel]}: сурагч алга.</span>
        )}
      </p>
    </div>
  );
}

export function QuestionRow({q, rate, takers, question}: {q: QuestionStat; rate: number | null; takers: number; question?: Question}) {
  const [open, setOpen] = useState(false);
  const hard = rate !== null && rate < 50;
  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_3rem_4rem_1rem] items-center gap-x-2 py-2.5 text-left text-sm sm:grid-cols-[2.25rem_minmax(0,1fr)_9rem_3rem_4.5rem_1rem] sm:gap-x-3"
      >
        <span className="font-semibold tabular-nums">{q.i + 1}.</span>
        <span className="relative hidden min-w-0 truncate text-neutral-400 sm:block">{question ? <MathText text={question.q} /> : null}</span>
        <Meter value={rate} />
        <span className="text-right tabular-nums">{pct(rate)}</span>
        <span className="flex items-center gap-1 text-xs font-medium text-neutral-200">
          {hard && (
            <>
              <AlertTriangle size={13} color={WARNING} /> Хүнд
            </>
          )}
        </span>
        <ChevronDown size={16} className={`text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mb-3 rounded-xl bg-neutral-950/60 p-3 sm:ml-[2.75rem]">
          <QuestionDetail q={q} takers={takers} question={question} />
        </div>
      )}
    </li>
  );
}

/** One question: its text and figure, how many picked each answer, the key. */
export function QuestionDetail({q, takers, question}: {q: QuestionStat; takers: number; question?: Question}) {
  const blank = takers - q.answered;
  return (
    <div className="mt-2">
      {question && (
        <div className="text-sm leading-relaxed text-neutral-300">
          <MathText text={question.q} />
          {question.fig && <div className="mt-2 flex justify-center text-neutral-300 [&_svg]:max-h-40">{question.fig}</div>}
        </div>
      )}
      <ul className="mt-3 space-y-1.5">
        {LETTERS.map((L, c) => {
          const n = q.picks[c];
          const right = q.key === c;
          return (
            <li key={L} className="grid grid-cols-[1.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full font-bold ${right ? 'bg-neutral-100 text-black' : 'bg-neutral-800'}`}>{L}</span>
              <span className="block h-2.5 overflow-hidden rounded-full bg-neutral-800">
                <span className="block h-full rounded-full" style={{width: `${takers ? (n / takers) * 100 : 0}%`, background: right ? SERIES : MUTED}} />
              </span>
              <span className="flex items-center gap-1 tabular-nums text-neutral-300">
                {n} сурагч {right && <Check size={13} className="text-green-400" aria-label="зөв" />}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">
        {q.key === null ? 'Энэ бодлогын түлхүүр оруулаагүй. ' : `Зөв хариулт: ${LETTERS[q.key]}. `}
        {blank > 0 && `Хариулаагүй: ${blank}.`}
      </p>
    </div>
  );
}
