import {AlertTriangle, ArrowLeft, CalendarClock, ChevronDown, ChevronRight, Download, EyeOff, KeyRound, Trash2} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {formatDuration} from '../../lib/attempt';
import {asResult, awayTimes, cancelExam, examState, scheduleExam, useExamEvents, type Exam, type ExamAnswer, type ExamState} from '../../lib/exams';
import {WHY_LABEL} from '../../lib/leaves';
import AwayList from '../../components/AwayList';
import {grade, percent} from '../../lib/keys';
import {Link, navigate} from '../../lib/router';
import {clock, dayLabel, span, useNow} from '../../lib/time';
import {TESTS, testInfo} from '../../tests';
import {download, mean, resultsCsv, testReport, type AdminData, type QuestionStat} from './data';
import {Distribution, Meter, pct, QuestionRow, Stat, StudentName} from './Overview';
import {useTest} from './useTest';

// "Hard" uses the warning status colour, always with an icon and a label (see Overview).
const WARNING = '#fab219';

const STATE_LABEL: Record<ExamState, string> = {upcoming: 'Товлогдсон', active: 'Явагдаж байна', ended: 'Дууссан'};
const STATE_STYLE: Record<ExamState, string> = {
  upcoming: 'bg-neutral-800 text-neutral-200',
  active: 'bg-green-500/15 text-green-300',
  ended: 'bg-neutral-800 text-neutral-400',
};

const pad = (n: number) => String(n).padStart(2, '0');
const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function Exams({data, test}: {data: AdminData; test?: string}) {
  const now = useNow(1000);
  const info = test ? testInfo(test) : undefined;
  if (info && data.exams[info.id]) return <ExamDetail data={data} test={info.id} exam={data.exams[info.id]} now={now} />;

  const list = Object.entries(data.exams).sort((a, b) => b[1].start - a[1].start);
  return (
    <div className="space-y-6">
      <ScheduleForm data={data} now={now} />
      <section>
        <h2 className="mb-2 font-semibold">Товлосон шалгалтууд</h2>
        {!list.length ? (
          <p className="text-sm text-neutral-400">Одоогоор шалгалт товлоогүй байна.</p>
        ) : (
          <ul className="space-y-2">
            {list.map(([t, e]) => {
              const state = examState(e, now);
              const answers = Object.values(data.examAnswers[t] ?? {});
              const done = answers.filter((a) => a.done).length;
              return (
                <li key={t}>
                  <Link href={`/admin?tab=exams&test=${t}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800/70">
                    <CalendarClock size={20} className="shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {testInfo(t)!.title}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLE[state]}`}>{STATE_LABEL[state]}</span>
                      </span>
                      <span className="block text-sm text-neutral-400">
                        {dayLabel(e.start)} {clock(e.start)}–{clock(e.end)}
                        {state === 'upcoming' && ` • эхлэхэд ${span(e.start - now)}`}
                        {state === 'active' && ` • ${span(e.end - now)} үлдлээ`}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-neutral-300">
                      {done}/{data.students.filter((s) => !s.profile.disabled).length} дуусгасан
                    </span>
                    <ChevronRight size={16} className="text-neutral-500" />
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

function ScheduleForm({data, now}: {data: AdminData; now: number}) {
  const start0 = new Date(Math.ceil((now + 5 * 60_000) / (5 * 60_000)) * 5 * 60_000);
  const [test, setTest] = useState(TESTS[0].id);
  const [date, setDate] = useState(dateInput(start0));
  const [from, setFrom] = useState(timeInput(start0));
  const [to, setTo] = useState(timeInput(new Date(start0.getTime() + 40 * 60_000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = new Date(`${date}T${from}`).getTime();
  const end = new Date(`${date}T${to}`).getTime();
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const keyed = (data.keys[test] ?? '').replace(/-/g, '').length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!valid) return setError('Дуусах цаг эхлэх цагаас хойно байх ёстой.');
    if (end <= now) return setError('Дуусах цаг аль хэдийн өнгөрсөн байна.');
    const old = data.exams[test];
    if (old && !confirm(`${testInfo(test)!.title}-д өмнө товлосон шалгалт байна. Солих уу? Өмнөх шалгалтын хариултууд устна.`)) return;
    setBusy(true);
    try {
      await scheduleExam(test, start, end);
      navigate(`/admin?tab=exams&test=${test}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-blue-500 [color-scheme:dark]';
  return (
    <form onSubmit={submit} className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <CalendarClock size={18} /> Шалгалт товлох
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        Эхлэх цагаас өмнө сурагчид тестийг нээж чадахгүй, шалгалтын үеэр нэг л удаа өгнө. Дуусах цагт хариулт нь автоматаар илгээгдэнэ. Дүн, алдсан бодлого нь шалгалт дууссаны дараа
        харагдана.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label className="block text-sm text-neutral-300">
          Тест
          <select value={test} onChange={(e) => setTest(e.target.value)} className={field}>
            {TESTS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-neutral-300">
          Өдөр
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} required />
        </label>
        <label className="block text-sm text-neutral-300">
          Эхлэх цаг
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={field} required />
        </label>
        <label className="block text-sm text-neutral-300">
          Дуусах цаг
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={field} required />
        </label>
      </div>
      <p className="mt-2 text-sm text-neutral-400">{valid ? `Үргэлжлэх хугацаа: ${span(end - start)}` : 'Дуусах цаг эхлэх цагаас хойно байх ёстой.'}</p>
      {keyed < testInfo(test)!.count && (
        <p className="mt-2 flex items-center gap-2 text-sm text-amber-300">
          <KeyRound size={15} /> {testInfo(test)!.title}-ийн түлхүүр {keyed ? `дутуу (${keyed}/${testInfo(test)!.count})` : 'оруулаагүй'} байна. Шалгалт дуусахаас өмнө оруулбал дүн гарна.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <button disabled={busy || !valid} className="mt-4 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
        {busy ? 'Товлож байна…' : 'Товлох'}
      </button>
    </form>
  );
}

type Row = {uid: string; answer: ExamAnswer | undefined};

function ExamDetail({data, test, exam, now}: {data: AdminData; test: string; exam: Exam; now: number}) {
  const info = testInfo(test)!;
  const state = examState(exam, now);
  const [sort, setSort] = useState<'num' | 'hard'>('num');
  const questions = useTest(test);
  const byTest = data.examAnswers[test] ?? {};
  const active = data.students.filter((s) => !s.profile.disabled);
  const rows: Row[] = active.map((s) => ({uid: s.uid, answer: byTest[s.uid]}));
  const started = rows.filter((r) => r.answer);
  const done = started.filter((r) => r.answer!.done);
  // Leaving and coming back as it happens: who is away now, when and for how long each one was.
  const events = useExamEvents(test);
  const away = new Map(
    rows.map((r) => {
      const times = awayTimes(events?.[r.uid] ?? []);
      const last = times[times.length - 1];
      const open = !!last && last.ms === undefined;
      const out = state === 'active' && !!r.answer && !r.answer.done && open;
      // Away when the exam ended (or when handed in): never came back.
      const until = out ? undefined : r.answer?.done ? r.answer.at : Math.min(now, exam.end);
      const ms = times.reduce((a, t) => a + (t.ms ?? 0), 0) + (open ? (until ?? now) - last.at : 0);
      return [r.uid, {times, out, until, leaves: Math.max(r.answer?.leaves ?? 0, times.length), ms: Math.max(r.answer?.away ?? 0, ms)}];
    }),
  );
  const left = started.filter((r) => away.get(r.uid)!.leaves > 0);
  const outNow = rows.filter((r) => away.get(r.uid)!.out);
  const [open, setOpen] = useState<string | null>(null);
  const key = data.keys[test];
  const g = (a: ExamAnswer) => grade(a.answers, key, info.count);
  const scores = started.flatMap((r) => (g(r.answer!) ? [percent(g(r.answer!)!)] : []));
  // The exam answers, shaped as results, so the test analysis can be reused.
  const examData: AdminData = {...data, results: started.map((r) => asResult(test, r.uid, r.answer!))};
  const report = testReport(info, examData);
  const rate = (q: QuestionStat) => (q.key === null || !report.rows.length ? null : (q.correct / report.rows.length) * 100);
  const byUid = new Map(data.students.map((s) => [s.uid, s]));

  const cancel = async () => {
    if (!confirm(state === 'ended' ? 'Энэ шалгалтыг устгах уу? Сурагчдын хариултууд устна.' : 'Шалгалтыг цуцлах уу? Өгсөн хариултууд устна.')) return;
    await cancelExam(test);
    navigate('/admin?tab=exams');
  };

  const status = (a: ExamAnswer | undefined) =>
    !a ? (
      <span className="text-neutral-500">{state === 'upcoming' ? 'Хүлээж байна' : 'Эхлээгүй'}</span>
    ) : a.done ? (
      <span className="text-green-400">Дуусгасан</span>
    ) : state === 'active' ? (
      <span className="text-blue-300">Бөглөж байна</span>
    ) : (
      <span className="text-neutral-400">Хугацаа дууссан</span>
    );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin?tab=exams" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft size={16} /> Бүх шалгалт
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-xl font-bold">Шалгалт: {info.title}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLE[state]}`}>{STATE_LABEL[state]}</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => download(`batnab-shalgalt-${test}.csv`, resultsCsv(examData))}
              disabled={!started.length}
              className="flex items-center gap-2 rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
            >
              <Download size={15} /> CSV
            </button>
            <button onClick={cancel} className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10">
              <Trash2 size={15} /> {state === 'ended' ? 'Устгах' : 'Цуцлах'}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          {dayLabel(exam.start)} {clock(exam.start)}–{clock(exam.end)}
          {state === 'upcoming' && ` • эхлэхэд ${span(exam.start - now)}`}
          {state === 'active' && ` • ${span(exam.end - now)} үлдлээ`}
        </p>
      </div>

      {!key && (
        <Link href={`/admin?tab=keys&test=${test}`} className="flex items-center gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 hover:bg-amber-500/15">
          <KeyRound size={18} /> <span className="flex-1">Түлхүүр оруулаагүй тул оноо гарахгүй. Түлхүүр оруулах</span> <ChevronRight size={16} />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Эхэлсэн" value={`${started.length}/${active.length}`} sub="сурагч" />
        <Stat label="Дуусгасан" value={done.length} />
        <Stat label="Дундаж оноо" value={pct(mean(scores))} />
        <Stat label="Хуудаснаас гарсан" value={left.length} sub={state === 'active' && outNow.length ? `сурагч · ${outNow.length} нь одоо гадуур` : 'сурагч'} />
      </div>

      <section>
        <h3 className="mb-2 font-semibold">Сурагчид {state === 'active' && <span className="text-sm font-normal text-neutral-400">(шууд шинэчлэгдэнэ)</span>}</h3>
        <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
          {[...rows]
            .sort((a, b) => Number(away.get(b.uid)!.out) - Number(away.get(a.uid)!.out) || (b.answer ? 1 : 0) - (a.answer ? 1 : 0) || away.get(b.uid)!.leaves - away.get(a.uid)!.leaves)
            .map(({uid, answer: a}) => {
              const s = byUid.get(uid)!;
              const grd = a ? g(a) : null;
              const answered = a ? [...a.answers].filter((c) => c !== '-').length : 0;
              const w = away.get(uid)!;
              const last = w.times[w.times.length - 1];
              return (
                <li key={uid} className={w.out ? 'bg-red-500/[0.07]' : ''}>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <StudentName
                        student={s}
                        sub={
                          <>
                            {w.out && (
                              <span className="font-semibold text-red-300">
                                <EyeOff size={12} className="-mt-0.5 inline" /> Одоо гадуур ({WHY_LABEL[last.why]}) · {formatDuration((now - last.at) / 1000)} •{' '}
                              </span>
                            )}
                            {status(a)}
                            {a && ` • ${answered}/${info.count} хариулсан`}
                            {a && a.done && ` • ${formatDuration(a.seconds)}`}
                          </>
                        }
                      />
                    </span>
                    {w.leaves > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpen(open === uid ? null : uid)}
                        aria-expanded={open === uid}
                        title={`Нийт ${formatDuration(w.ms / 1000)} гадуур байсан`}
                        className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
                      >
                        <AlertTriangle size={13} color={WARNING} /> {w.leaves} удаа гарсан
                        <span className="hidden text-neutral-400 sm:inline">· {formatDuration(w.ms / 1000)}</span>
                        <ChevronDown size={13} className={`transition-transform ${open === uid ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                    {a ? (
                      <Link href={`/review/${test}/exam?u=${uid}`} className="w-16 shrink-0 rounded-lg px-1 py-1 text-right hover:bg-neutral-800">
                        <span className="block font-semibold tabular-nums">{grd ? `${grd.score}/${grd.total}` : '—'}</span>
                        <span className="block text-xs text-neutral-500">{grd ? `${percent(grd)}%` : 'харах'}</span>
                      </Link>
                    ) : (
                      <span className="w-16 shrink-0" />
                    )}
                  </div>
                  {open === uid && (
                    <div className="px-4 pb-3 pl-14">
                      {w.times.length ? <AwayList times={w.times} now={now} until={w.until} /> : <p className="text-xs text-neutral-500">Хэзээ гарсан нь бүртгэгдээгүй (хуучин хувилбараар өгсөн).</p>}
                      <p className="mt-1 text-xs text-neutral-500">Нийт {formatDuration(w.ms / 1000)} гадуур.</p>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          «Хуудаснаас гарсан»: шалгалтын үеэр өөр таб, апп, цонх эсвэл сайтын өөр хуудас руу шилжсэн, хуудсаа хаасан эсвэл дахин ачаалсан тоо. Дээр нь дарж хэзээ, юу
          хийж, хэр удаан гадуур байсныг харна. Одоо гадуур байгаа сурагч улаанаар хамгийн дээр гарна.
        </p>
      </section>

      {state !== 'ended' && started.length > 0 && <p className="text-sm text-neutral-500">Онооны тархалт, бодлого бүрийн анализ шалгалт дууссаны дараа гарна.</p>}

      {state === 'ended' && report.rows.length > 0 && key && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
            <h3 className="font-semibold">Онооны тархалт</h3>
            <Distribution report={report} />
          </section>
          <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
            <h3 className="font-semibold">Хамгийн хүнд 5 бодлого</h3>
            <ul className="mt-3 space-y-3">
              {report.questions
                .filter((q) => rate(q) !== null)
                .sort((a, b) => rate(a)! - rate(b)!)
                .slice(0, 5)
                .map((q) => (
                  <li key={q.i} className="grid grid-cols-[2.25rem_minmax(0,1fr)_3rem] items-center gap-x-3 text-sm">
                    <span className="font-semibold tabular-nums">{q.i + 1}.</span>
                    <Meter value={rate(q)} />
                    <span className="text-right tabular-nums">{pct(rate(q))}</span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}

      {state === 'ended' && report.rows.length > 0 && key && (
        <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Бодлого бүрээр</h3>
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
              <QuestionRow key={q.i} q={q} rate={rate(q)} takers={report.rows.length} question={questions?.questions[q.i]} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
