import {BookOpen, ChevronRight, FlaskConical, GraduationCap, Lock, LogIn, School, Timer} from 'lucide-react';
import {InactiveNote, loginHref} from '../components/Notices';
import Today from '../components/Today';
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
import {weekStart} from '../lib/week';
import {TESTS, testInfo} from '../tests';

export default function Home() {
  const session = useSession();
  const settings = useSettings();
  const results = useMyResults();
  const student = isStudent(session);
  const classes = useClasses();
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

  const best = (id: string) =>
    (results ?? [])
      .filter((r) => r.test === id)
      .map((r) => grade(r.answers, keys[id], testInfo(id)!.count))
      .reduce<Grade | null>((b, g) => (g && (!b || percent(g) > percent(b)) ? g : b), null);

  return (
    <div className="mx-auto max-w-3xl py-6">
      {student ? (
        <>
          <h1 className="text-2xl font-bold sm:text-3xl">Сайн уу, {shownName(session.profile)}!</h1>
          {myClass && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-400">
              <School size={15} /> {myClass}
            </p>
          )}
          <Today uid={session.user!.uid} classId={session.profile?.class} />
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold sm:text-3xl">Математикийн тест</h1>
          <p className="mt-2 text-neutral-400">Тест бүр 30 бодлоготой. Тест өгөх бүрт бодлогуудын байр холилдоно. Дуусгахад оноо болон аль бодлого дээр алдсан нь харагдана.</p>
        </>
      )}

      {session.ready && !session.user && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/login" className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 font-semibold text-black hover:bg-blue-400">
            <LogIn size={18} /> Нэвтрэх
          </Link>
          {trial && (
            <Link href={`/test/${trial.id}`} className="flex items-center gap-2 rounded-full border border-neutral-700 px-5 py-2 font-medium text-blue-400 hover:bg-blue-500/10">
              <FlaskConical size={18} /> Туршилтаар өгөх
            </Link>
          )}
        </div>
      )}
      {session.admin && (
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

      <div className="mt-8 space-y-6">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Тест {g}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {TESTS.filter((t) => t.group === g).map((t) => {
                const locked = session.ready && !session.user && trial?.id !== t.id;
                const mine = (results ?? []).filter((r) => r.test === t.id);
                const top = best(t.id);
                const going = inProgress(owner, t.id, t.count);
                const done = !going && mine.length > 0 && student && settings?.retakes === false;
                const exam = exams[t.id];
                const examOn = !!exam && student && examState(exam, now) !== 'ended';
                const action = locked ? 'Нэвтэрч өгнө' : examOn ? 'Шалгалт' : going ? 'Үргэлжлүүлэх' : done ? 'Хариултаа харах' : mine.length ? 'Дахин өгөх' : 'Эхлэх';
                return (
                  <Link
                    key={t.id}
                    href={locked ? loginHref(`/test/${t.id}`) : done && !examOn ? `/review/${t.id}/${mine[0].id}` : `/test/${t.id}`}
                    className={`group flex items-center gap-4 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800 ${locked ? 'opacity-70' : ''}`}
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
                        {top && ` • Шилдэг: ${top.score}/${top.total}`}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-blue-400">
                      {locked && <Lock size={14} />}
                      {action} {!locked && <ChevronRight size={16} />}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {student && <TopicsSection classId={session.profile?.class} uid={session.user!.uid} />}
      </div>
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
            const total = t.problems.filter((p) => p.k || progress?.[t.id]?.[p.id]).length;
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
      <p className="text-sm text-neutral-400">
        Дууссан • {!mine ? 'өгөөгүй' : g ? `таны дүн ${g.score}/${g.total} (${percent(g)}%)` : keys[test] === undefined ? '…' : 'дүн удахгүй гарна'}
      </p>
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
