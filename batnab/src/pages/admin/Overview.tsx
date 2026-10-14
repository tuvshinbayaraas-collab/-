import {AlertTriangle, ArrowLeft, CalendarClock, Check, ChevronDown, ChevronRight, KeyRound, UserX} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import Avatar from '../../components/Avatar';
import MathText from '../../components/MathText';
import {formatDuration} from '../../lib/attempt';
import {percent} from '../../lib/keys';
import {Link} from '../../lib/router';
import {shownName} from '../../lib/session';
import {clock} from '../../lib/time';
import {TESTS, testInfo, type TestInfo} from '../../tests';
import {LETTERS, type Question} from '../../tests/types';
import {gradeOf, mean, reports, testReport, timeAgo, type AdminData, type QuestionStat, type Student, type TestReport} from './data';
import {useTest} from './useTest';
import WeekBanner from './WeekBanner';

// Chart colours on the dark surface (#171717). One measure → one hue (blue); the class table uses the same hue as a
// sequential ramp; "hard question" uses the warning status colour, always with an icon and a label.
const SERIES = '#3987e5';
const TRACK = '#0d366b';
const MUTED = '#525252';
const WARNING = '#fab219';
const RAMP = [
  {min: 85, bg: '#86b6ef', fg: '#0b0b0b'},
  {min: 70, bg: '#5598e7', fg: '#0b0b0b'},
  {min: 55, bg: '#2a78d6', fg: '#ffffff'},
  {min: 40, bg: '#1c5cab', fg: '#ffffff'},
  {min: 0, bg: '#104281', fg: '#ffffff'},
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

      <ClassTable data={data} />

      <section>
        <h2 className="mb-2 font-semibold">Сүүлийн оролдлогууд</h2>
        {!data.results.length ? (
          <p className="text-sm text-neutral-400">Энэ долоо хоногт хэн ч тест өгөөгүй байна.</p>
        ) : (
          <ul className="grid gap-x-8 rounded-2xl bg-neutral-900 px-4 lg:grid-cols-2">
            {data.results.slice(0, 10).map((r) => {
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
        )}
      </section>
    </div>
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
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
        {[...RAMP].reverse().map((r, i, list) => (
          <span key={r.min} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{background: r.bg}} />
            {r.min}–{i + 1 < list.length ? list[i + 1].min - 1 : 100}%
          </span>
        ))}
        <span>— өгөөгүй</span>
      </div>
    </section>
  );
}

function TestDetail({report}: {report: TestReport}) {
  const {info, rows, missing, firstPercents, key} = report;
  const [sort, setSort] = useState<'num' | 'hard'>('num');
  const test = useTest(info.id);
  const scores = rows.flatMap((r) => (r.first ? [r.first] : []));
  const rate = (q: QuestionStat) => (q.key === null || !rows.length ? null : (q.correct / rows.length) * 100);
  const hardest = report.questions
    .filter((q) => rate(q) !== null)
    .sort((a, b) => rate(a)! - rate(b)!)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin?tab=overview" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft size={16} /> Бүх тест
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-xl font-bold">{info.title}</h2>
          <div className="flex gap-1">
            {TESTS.map((t) => (
              <Link
                key={t.id}
                href={`/admin?tab=overview&test=${t.id}`}
                className={`rounded-full px-3 py-1 text-sm font-medium ${t.id === info.id ? 'bg-neutral-100 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
              >
                {short(t)}
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
        <Stat label="Дундаж хугацаа" value={report.avgSeconds === null ? '—' : formatDuration(report.avgSeconds)} />
      </div>

      {missing.length > 0 && (
        <div className="flex gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm">
          <UserX size={18} className="mt-0.5 shrink-0 text-neutral-400" />
          <p>
            <span className="font-medium">Өгөөгүй {missing.length} сурагч: </span>
            <span className="text-neutral-400">{missing.map((s) => s.profile.name).join(', ')}</span>
          </p>
        </div>
      )}

      {rows.length > 0 && key && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
            <h3 className="font-semibold">Онооны тархалт</h3>
            <p className="text-sm text-neutral-400">Эхний оролдлогын оноогоор хэдэн сурагч байна</p>
            <Distribution report={report} />
          </section>
          <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
            <h3 className="font-semibold">Хамгийн хүнд 5 бодлого</h3>
            <p className="text-sm text-neutral-400">Зөв бодсон сурагчдын хувь</p>
            <ul className="mt-3 space-y-3">
              {hardest.map((q) => (
                <li key={q.i} className="grid grid-cols-[2.25rem_minmax(0,1fr)_3rem] items-center gap-x-3 text-sm">
                  <span className="font-semibold tabular-nums">{q.i + 1}.</span>
                  <span>
                    <Meter value={rate(q)} />
                    <span className="mt-1 block text-xs text-neutral-500">
                      Зөв нь {LETTERS[q.key!]}
                      {q.topWrong !== null && `, олонх нь ${LETTERS[q.topWrong]}-г сонгосон (${q.picks[q.topWrong]})`}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">{pct(rate(q))}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {rows.length > 0 && (
        <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Бодлого бүрээр</h3>
              <p className="text-sm text-neutral-400">Зөв бодсон хувь. Бодлого дээр дарж аль хариултыг хэд сонгосныг харна.</p>
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
          <ul className="mt-3 divide-y divide-neutral-800">
            {(sort === 'num' ? report.questions : [...report.questions].sort((a, b) => (rate(a) ?? 101) - (rate(b) ?? 101))).map((q) => (
              <QuestionRow key={q.i} q={q} rate={rate(q)} takers={rows.length} question={test?.questions[q.i]} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 font-semibold">Сурагчид</h3>
        {!rows.length ? (
          <p className="text-sm text-neutral-400">Энэ долоо хоногт энэ тестийг хэн ч өгөөгүй байна.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {[...rows]
              .sort((a, b) => (b.first ? percent(b.first) : -1) - (a.first ? percent(a.first) : -1))
              .map((r) => (
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
        )}
      </section>
    </div>
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
  const blank = takers - q.answered;
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
      )}
    </li>
  );
}
