import {BookOpen, Check, ChevronRight, FlaskConical, GraduationCap, Lock, LogIn, School, Timer, Trophy} from 'lucide-react';
import {LogoMark} from '../components/Logo';
import {InactiveNote, loginHref} from '../components/Notices';
import Today, {Shortcuts} from '../components/Today';
import {inProgress} from '../lib/attempt';
import {useClasses} from '../lib/classes';
import {examState, useExamAnswer, useExams, type Exam} from '../lib/exams';
import {grade, percent, useKeys, type Grade} from '../lib/keys';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {isStudent, shownName, useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {clock, dayLabel, span, useNow} from '../lib/time';
import {forClassOf, useProgress, useTopics} from '../lib/topics';
import {skillStats, toReview} from '../lib/skills';
import {weekStart} from '../lib/week';
import {useWide} from '../lib/wide';
import {TESTS, testInfo} from '../tests';

export default function Home() {
  const session = useSession();
  const settings = useSettings();
  const results = useMyResults();
  const student = isStudent(session);
  const classes = useClasses();
  const wide = useWide();
  const myClass = classes?.find((c) => c.id === session.profile?.class)?.name;
  const keys = useKeys(student && results ? results.map((r) => r.test) : []);
  const groups = [...new Set(TESTS.map((t) => t.group))];
  const owner = session.user?.uid ?? 'guest';
  const trial = settings?.trial ? testInfo(settings.trial) : undefined;
  const exams = useExams() ?? {};
  const soon = Object.values(exams).some((e) => e.end > Date.now() - 60_000);
  const now = useNow(soon ? 1000 : 60_000);
  // Exams a student should see: coming up, running, or finished this week.
  const myExams = Object.entries(exams)
    .filter(([test, e]) => testInfo(test) && e.end >= weekStart(now))
    .sort((a, b) => a[1].start - b[1].start);

  if (session.ready && session.user && !session.admin && !student) return <InactiveNote blocked={!!session.profile?.disabled} />;

  /** The best attempt at a test (its grade and answers). */
  const bestOf = (id: string) =>
    (results ?? [])
      .filter((r) => r.test === id)
      .map((r) => ({answers: r.answers, g: grade(r.answers, keys[id], testInfo(id)!.count)}))
      .reduce<{answers: string; g: Grade} | null>((b, x) => (x.g && (!b || percent(x.g) > percent(b.g)) ? {answers: x.answers, g: x.g} : b), null);
  const best = (id: string) => bestOf(id)?.g ?? null;

  const testCards = (t: (typeof TESTS)[number]) => {
    const locked = session.ready && !session.user && trial?.id !== t.id;
    const mine = (results ?? []).filter((r) => r.test === t.id);
    const top = bestOf(t.id);
    // What the best attempt says to go over (the weakest topics with mistakes).
    const review = top ? toReview(skillStats([{test: t.id, answers: top.answers, key: keys[t.id]}])) : [];
    const going = inProgress(owner, t.id, t.count);
    const done = !going && mine.length > 0 && student && settings?.retakes === false;
    const exam = exams[t.id];
    const examOn = !!exam && student && examState(exam, now) !== 'ended';
    const action = locked ? 'Нэвтэрч өгнө' : examOn ? 'Шалгалт' : going ? 'Үргэлжлүүлэх' : done ? 'Хариултаа харах' : mine.length ? 'Дахин өгөх' : 'Эхлэх';
    return (
      <Link
        key={t.id}
        href={locked ? loginHref(`/test/${t.id}`) : done && !examOn ? `/review/${t.id}/${mine[0].id}` : `/test/${t.id}`}
        className={`group flex min-w-0 items-center gap-4 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800 ${locked ? 'opacity-70' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-lg font-semibold">
            {t.title}
            {!session.user && trial?.id === t.id && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">Туршилт</span>}
            {examOn && (
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300">
                Шалгалт {dayLabel(exam.start)} {clock(exam.start)}
              </span>
            )}
          </p>
          <p className="text-sm text-neutral-400">
            {t.count} бодлого
            {mine.length > 0 && ` • ${mine.length} удаа өгсөн`}
            {top && ` • Шилдэг: ${top.g.score}/${top.g.total} (${percent(top.g)}%)`}
          </p>
          {review.length > 0 && <p className="mt-0.5 line-clamp-2 text-xs text-amber-200/90">Давтах: {review.map((r) => r.name).join(', ')}</p>}
        </div>
        <span className="flex items-center gap-1 text-sm font-medium text-blue-400">
          {locked && <Lock size={14} />}
          {action} {!locked && <ChevronRight size={16} />}
        </span>
      </Link>
    );
  };
  // This week's tests and the best of each (the side of a student's page on a computer).
  const week = [...new Set((results ?? []).filter((r) => r.at >= weekStart(now)).map((r) => r.test))].filter((id) => testInfo(id));

  return (
    <div className="mx-auto max-w-3xl py-6 lg:max-w-6xl">
      {student ? (
        <section className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-600/20 via-blue-500/5 to-transparent px-5 py-5 sm:px-7 sm:py-6">
          <MathMarks className="hidden sm:block" />
          <h1 className="relative text-2xl font-bold sm:text-3xl">Сайн уу, {shownName(session.profile)}!</h1>
          <p className="relative mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-400">
            {myClass && (
              <span className="flex items-center gap-1.5">
                <School size={15} /> {myClass}
              </span>
            )}
            {!session.admin && <span>{week.length ? `Энэ долоо хоногт ${week.length} тест өгсөн` : 'Энэ долоо хоногийн эхний тестээ өгөөрэй'}</span>}
          </p>
        </section>
      ) : (
        <Hero trial={trial ? {id: trial.id} : undefined} guest={session.ready && !session.user} admin={session.admin} />
      )}

      <div className={student ? 'lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8' : ''}>
        <div className="min-w-0">
          {student && <Today uid={session.user!.uid} classId={session.profile?.class} />}
          {student && session.admin && (
            <Link href="/admin" className="mt-5 flex items-center gap-3 rounded-2xl bg-blue-500/10 p-4 text-blue-300 hover:bg-blue-500/15">
              <GraduationCap size={22} />
              <span className="flex-1 font-semibold">Багшийн самбар: сурагчид, түлхүүр, анализ</span>
              <ChevronRight size={18} />
            </Link>
          )}

          {student && myExams.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Шалгалт</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {myExams.map(([test, e]) => (
                  <ExamCard key={test} test={test} exam={e} uid={session.user!.uid} now={now} />
                ))}
              </div>
            </section>
          )}

          {/* Without the side column (a guest, the teacher) the three tests stand side by side on a computer. */}
          <div className={`mt-8 space-y-6 ${student ? '' : 'lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0'}`}>
            {groups.map((g) => (
              <section key={g}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Тест {g}</h2>
                <div className={`grid gap-3 sm:grid-cols-2 ${student ? '' : 'lg:grid-cols-1'}`}>{TESTS.filter((t) => t.group === g).map(testCards)}</div>
              </section>
            ))}
          </div>
          {student && (
            <div className="mt-6">
              <TopicsSection classId={session.profile?.class} uid={session.user!.uid} />
            </div>
          )}
        </div>

        {student && wide && (
          <aside className="sticky top-20 mt-5 space-y-3" aria-label="Миний долоо хоног">
            {(!session.admin || week.length > 0) && (
              <section className="rounded-2xl bg-neutral-900 p-4">
                <h2 className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  Энэ долоо хоног
                  <Link href="/results" className="text-xs font-medium normal-case tracking-normal text-blue-400 hover:underline">
                    Миний дүн
                  </Link>
                </h2>
                {week.length ? (
                  <ul className="mt-3 space-y-3">
                    {week.map((id) => {
                      const g = best(id);
                      const p = g ? percent(g) : null;
                      return (
                        <li key={id}>
                          <p className="flex justify-between text-sm">
                            <span className="font-medium">{testInfo(id)!.title}</span>
                            <span className="tabular-nums text-neutral-300">{p === null ? '—' : `${p}%`}</span>
                          </p>
                          <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-neutral-800">
                            <span className="block h-full rounded-full bg-blue-500" style={{width: `${p ?? 0}%`}} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-neutral-400">Тест өгөхөд шилдэг дүн тань энд гарна.</p>
                )}
              </section>
            )}
            <Shortcuts uid={session.user!.uid} stack />
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * The top of the page for a guest (sign in, or try the trial test) and the teacher (their dashboard): the name, what
 * the site is, and on a computer a sample question beside it.
 */
function Hero({trial, guest, admin}: {trial?: {id: string}; guest: boolean; admin: boolean}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-600/25 via-blue-500/10 to-transparent px-5 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-12">
      <MathMarks className="hidden sm:block" />
      <div className="relative max-w-xl">
        <p className="hidden items-center gap-2 text-sm font-semibold text-blue-200 sm:flex">
          <LogoMark size={22} /> Batnab
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:mt-3 sm:text-4xl">Математикийн тест</h1>
        <p className="mt-2 text-neutral-300 sm:mt-3">Тест бүр 30 бодлоготой. Тест өгөх бүрт бодлогуудын байр холилдоно. Дуусгахад оноо болон аль бодлого дээр алдсан нь харагдана.</p>
        <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6 sm:gap-3">
          {guest && (
            <>
              <Link href="/login" className="flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 font-semibold sm:px-5 text-black hover:bg-blue-400">
                <LogIn size={18} /> Нэвтрэх
              </Link>
              {trial && (
                <Link href={`/test/${trial.id}`} className="flex items-center gap-2 rounded-full border border-neutral-700 bg-page/40 px-4 py-2 font-medium sm:px-5 text-blue-400 hover:bg-blue-500/10">
                  <FlaskConical size={18} /> Туршилтаар өгөх
                </Link>
              )}
            </>
          )}
          {admin && (
            <Link href="/admin" className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 font-semibold text-black hover:bg-blue-400">
              <GraduationCap size={18} /> Багшийн самбар: сурагчид, түлхүүр, анализ
            </Link>
          )}
        </div>
      </div>
      <SampleQuestion />
    </section>
  );
}

/** A question card as the tests show one, the right answer picked: a picture of the site, on a computer only. */
function SampleQuestion() {
  const choices: [string, string, boolean][] = [
    ['А', '10', false],
    ['Б', '13', true],
    ['В', '25', false],
    ['Г', '7', false],
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute right-10 top-1/2 hidden w-80 -translate-y-1/2 rotate-[-3deg] select-none lg:block xl:right-16">
      <div className="absolute -right-4 -top-5 z-10 flex items-center gap-1.5 rounded-full bg-[var(--color-gold)] px-3 py-1 text-sm font-bold text-black shadow-lg">
        <Trophy size={15} /> 29/30
      </div>
      <div className="rounded-2xl bg-neutral-900 p-5 shadow-2xl ring-1 ring-neutral-700/60">
        <p className="text-xs font-medium text-neutral-500">12-р бодлого</p>
        <p className="mt-1 text-xl font-semibold">√16 + 3² = ?</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {choices.map(([l, v, on]) => (
            <span key={l} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${on ? 'border-green-500 bg-green-500/15' : 'border-neutral-700'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${on ? 'bg-green-500 text-black' : 'bg-neutral-800'}`}>{on ? <Check size={14} /> : l}</span>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Faint maths signs over a banner's corner: the site's own pattern. */
function MathMarks({className = ''}: {className?: string}) {
  const marks: [string, string][] = [
    ['√', 'right-[6%] top-[8%] text-6xl'],
    ['π', 'right-[22%] bottom-[6%] text-5xl'],
    ['∑', 'right-[38%] top-[10%] text-4xl'],
    ['∫', 'right-[12%] bottom-[14%] text-5xl'],
    ['x²', 'right-[30%] top-[46%] text-3xl'],
  ];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 select-none font-serif text-blue-300/10 ${className}`}>
      {marks.map(([m, at]) => (
        <span key={m} className={`absolute ${at}`}>
          {m}
        </span>
      ))}
    </div>
  );
}

/** The newest topics opened for the student's class, with how far they've got. */
function TopicsSection({classId, uid}: {classId?: string; uid: string}) {
  const topics = useTopics();
  const progress = useProgress(uid);
  const shown = (topics ?? []).filter((t) => forClassOf(t, classId));
  if (!shown.length) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Сэдвүүд</h2>
        {shown.length > 4 && (
          <Link href="/topics" className="text-sm text-blue-400 hover:underline">
            Бүгд ({shown.length})
          </Link>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown
          .slice(-4)
          .reverse()
          .map((t) => {
            const done = t.problems.filter((p) => progress?.[t.id]?.[p.id]).length;
            // Problems without a right answer can't be done (they're worked out on one's own).
            const total = t.problems.length;
            return (
              <Link key={t.id} href={`/topics/${t.id}`} className="flex items-center gap-4 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                  <BookOpen size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{t.title}</p>
                  <p className="text-sm text-neutral-400">
                    {t.problems.length} бодлого{done > 0 && ` • ${done} бодсон`}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm font-medium text-blue-400">
                  {done === 0 ? 'Эхлэх' : done < total ? 'Үргэлжлүүлэх' : 'Харах'} <ChevronRight size={16} />
                </span>
              </Link>
            );
          })}
      </div>
    </section>
  );
}

/** One scheduled exam on the student's home page: when it is, how long until it starts or ends, and their result. */
function ExamCard({test, exam, uid, now}: {test: string; exam: Exam; uid: string; now: number}) {
  const info = testInfo(test)!;
  const state = examState(exam, now);
  const mine = useExamAnswer(test, uid);
  const keys = useKeys(state === 'ended' && mine ? [test] : []);
  const g = state === 'ended' && mine ? grade(mine.answers, keys[test], info.count) : null;

  const body =
    state === 'upcoming' ? (
      <p className="text-sm text-neutral-400">Эхлэхэд {span(exam.start - now)}</p>
    ) : state === 'active' ? (
      <p className="text-sm font-medium text-green-400">{mine?.done ? 'Өгсөн. Дүн дууссаны дараа гарна' : `Явагдаж байна • ${span(exam.end - now)} үлдлээ`}</p>
    ) : (
      <p className="text-sm text-neutral-400">Дууссан • {!mine ? 'өгөөгүй' : g ? `таны дүн ${g.score}/${g.total} (${percent(g)}%)` : keys[test] === undefined ? '…' : 'дүн удахгүй гарна'}</p>
    );

  return (
    <Link
      href={state === 'ended' ? (mine ? `/review/${test}/exam` : `/test/${test}`) : `/test/${test}`}
      className={`flex items-center gap-4 rounded-2xl p-4 ${state === 'active' && !mine?.done ? 'bg-blue-500/15 ring-1 ring-blue-500/50 hover:bg-blue-500/20' : 'bg-neutral-900 hover:bg-neutral-800'}`}
    >
      <Timer size={22} className="shrink-0 text-neutral-400" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{info.title}</p>
        <p className="text-sm text-neutral-300">
          {dayLabel(exam.start)} {clock(exam.start)}–{clock(exam.end)}
        </p>
        {body}
      </div>
      <span className="text-sm font-medium text-blue-400">{state === 'active' && !mine?.done ? 'Эхлэх' : state === 'ended' && mine ? 'Дүн' : ''}</span>
    </Link>
  );
}
