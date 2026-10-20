import {ArrowLeft, BookOpen, ListChecks, Pencil} from 'lucide-react';
import {useState} from 'react';
import {CenterNote, InactiveNote, LockedNote} from '../components/Notices';
import {isPerfect, PerfectTitle, ResultCard} from '../components/Perfect';
import {ProblemView, Rich, TopicPicture, type Outcome} from '../components/TopicParts';
import {addMistakes, useMistakes} from '../lib/mistakes';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {forClassOf, problemNo, useMarks, useProgress, useTopics, verdict} from '../lib/topics';

/** /topics/{id}: the lesson, then the problems one under another. */
export default function TopicView({id}: {id: string}) {
  const session = useSession();
  const topics = useTopics();
  const progress = useProgress(session.user && !session.admin ? session.user.uid : undefined);
  const marks = useMarks(session.user && !session.admin ? session.user.uid : undefined);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const mistakes = useMistakes(session.user && !session.admin ? session.user.uid : undefined);
  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote text="Сэдвийг үзэхийн тулд нэвтэрнэ үү." />;
  if (!session.admin && (!session.profile || session.profile.disabled)) return <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!topics || !progress || !marks) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  const t = topics.find((x) => x.id === id);
  if (!t || (!session.admin && !forClassOf(t, session.profile?.class)))
    return (
      <CenterNote title="Сэдэв олдсонгүй">
        <Link href="/topics" className="text-blue-400 hover:underline">
          Бүх сэдэв
        </Link>
      </CenterNote>
    );

  const mine = progress[t.id] ?? {};
  const marked = marks[t.id] ?? {};
  // Every problem counts: one without a right answer is checked by the teacher (until then it waits).
  const counted = t.problems;
  const answered = counted.filter((p) => mine[p.id]).length;
  const judged = (pid: string) => (outcomes[pid] ? verdict(outcomes[pid].a, outcomes[pid].key, marked[pid]) : null);
  const right = counted.filter((p) => judged(p.id) === true).length;
  const waiting = counted.filter((p) => mine[p.id] && outcomes[p.id] && judged(p.id) === null).length;
  const all = !session.admin && counted.length > 0 && answered === counted.length && counted.every((p) => judged(p.id) !== null);
  const grade = {score: right, total: counted.length, count: counted.length};

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      <Link href="/topics" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={16} /> Сэдвүүд
      </Link>
      <header className="mt-3">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          {t.title}
          {!t.published && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">Ноорог</span>}
        </h1>
        {t.intro && <p className="mt-1 text-neutral-400">{t.intro}</p>}
        {session.admin && (
          <Link href={`/admin/topic/${t.id}`} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium hover:bg-neutral-700">
            <Pencil size={15} /> Засах
          </Link>
        )}
      </header>

      {t.lesson.length > 0 && (
        <section className="mt-6 rounded-2xl bg-neutral-900 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-300">
            <BookOpen size={16} /> Хичээл
          </h2>
          <div className="mt-3 space-y-4">
            {t.lesson.map((b, i) => (b.t === 'text' ? <Rich key={i} text={b.text} className="text-[15px] text-neutral-100" /> : <TopicPicture key={i} tid={t.id} iid={b.img} className="w-full" />))}
          </div>
        </section>
      )}

      {t.problems.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ListChecks size={18} /> Бодлого
            </h2>
            {!session.admin && counted.length > 0 && (
              <span className="text-sm text-neutral-400">
                {answered}/{counted.length} бодсон{answered > 0 && ` · ${right} зөв`}
                {waiting > 0 && ` · ${waiting} нь багш шалгаж байна`}
              </span>
            )}
          </div>
          {all && (
            <ResultCard perfect={isPerfect(grade) ? 'test' : null} id={`topic-${t.id}`} className="mb-4">
              {isPerfect(grade) && <PerfectTitle kind="test" />}
              <p className="text-lg font-semibold">Бүх бодлогыг бодлоо!</p>
              <p className="text-sm text-neutral-400">
                Эхний оролдлогоор {right}/{counted.length} зөв. Алдсан бодлогоо «Дахин бодох»-оор дахин бодож болно.
              </p>
            </ResultCard>
          )}
          <ol className="space-y-4">
            {t.problems.map((p, i) => (
              <ProblemView
                key={p.id}
                tid={t.id}
                p={p}
                num={problemNo(p, i)}
                first={mine[p.id]}
                mark={marked[p.id]}
                teacher={session.admin}
                ask={`${t.title} · ${problemNo(p, i)}-р бодлого`}
                onOutcome={(o) => {
                  setOutcomes((x) => (x[p.id]?.a === o.a && x[p.id]?.key === o.key ? x : {...x, [p.id]: o}));
                  // A wrong first answer goes into the mistakes notebook (once).
                  if (!session.admin && mistakes && o.key !== null && o.a !== o.key) addMistakes([{s: 'p', t: t.id, q: p.id}], mistakes).catch(() => {});
                }}
              />
            ))}
          </ol>
        </section>
      )}
      {!t.lesson.length && !t.problems.length && <p className="mt-8 rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">Энэ сэдэвт одоогоор агуулга алга.</p>}
    </div>
  );
}
