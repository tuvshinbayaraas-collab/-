import {ArrowLeft, BookOpen, ChevronDown, ListChecks, Pencil, RotateCcw} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {CenterNote, InactiveNote, LockedNote} from '../components/Notices';
import {isPerfect, PerfectTitle, ResultCard} from '../components/Perfect';
import {ProblemView, Rich, TopicPicture} from '../components/TopicParts';
import VideoEmbed from '../components/VideoEmbed';
import {addMistakes, useMistakes} from '../lib/mistakes';
import {focusOn} from '../lib/focus';
import {Link, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {topicTimeKey, useTimeOn} from '../lib/timeOn';
import {forClassOf, problemNo, readKey, useMarks, useProgress, useRounds, useTopics, verdict, type Problem} from '../lib/topics';
import Loading from '../components/Loading';

/** How a problem went in one time at the topic. */
type State = 'right' | 'wrong' | 'wait' | 'free' | 'todo';

/**
 * /topics/{id}: the lesson, then the problems one under another, with a map of them beside (on a phone, above): how
 * each went, a tap goes to it. Every problem answered, the score; then the topic can be done again from the start
 * (time 2, 3…, kept apart: the first time is the one that counts), each time's score kept.
 */
export default function TopicView({id}: {id: string}) {
  const session = useSession();
  const uid = session.user && !session.admin ? session.user.uid : undefined;
  const topics = useTopics();
  const progress = useProgress(uid);
  const marks = useMarks(uid);
  const rounds = useRounds(uid, id);
  // The right answers, as each problem's outcome brings them (or read for the times not on screen).
  const [keys, setKeys] = useState<Record<string, string | null>>({});
  // A time begun here with nothing answered yet, and a time picked to look back at.
  const [next, setNext] = useState<number | null>(null);
  const [view, setView] = useState<number | null>(null);
  const mistakes = useMistakes(uid);
  const list = useRef<HTMLOListElement>(null);
  const t0 = topics?.find((x) => x.id === id);
  const last = Math.max(1, ...Object.keys(rounds ?? {}).map(Number).filter((n) => n > 1));
  const current = view ?? Math.max(last, next ?? 1);
  // How long they spend here, and on each problem until it is answered, the first time: for the teacher only (lib/timeOn).
  const student = !!session.user && !session.admin && !!session.profile && !session.profile.disabled;
  const open = !!t0 && forClassOf(t0, session.profile?.class);
  useTimeOn(student && open && current === 1 ? `timeOn/${session.user!.uid}/${topicTimeKey(id)}` : null, () => {
    const kids = list.current ? [...list.current.children] : [];
    return (t0?.problems ?? []).map((p, i) => ({el: kids[i] ?? null, key: p.id, open: !!progress && !progress[id]?.[p.id]}));
  });
  // Opened at one problem (?p=…, e.g. from a question about it): brought into view and lit up, once it is on screen.
  const focus = useLocation().query.get('p');
  const focused = useRef<string | null>(null);
  const loaded = !!topics && !!progress && !!marks && (!uid || !!rounds);
  useEffect(() => {
    if (!loaded || !focus || focused.current === focus || !t0) return;
    const el = list.current?.children[t0.problems.findIndex((p) => p.id === focus)];
    if (!(el instanceof HTMLElement)) return;
    focused.current = focus;
    focusOn(el);
  });
  // Keys of the problems answered the first time (readable since), for the times whose problems aren't on screen.
  const firstDone = Object.keys(progress?.[id] ?? {}).sort().join(',');
  useEffect(() => {
    if (!uid) return;
    let live = true;
    for (const pid of firstDone.split(',').filter(Boolean))
      if (!(pid in keys))
        readKey(id, pid).then(
          (k) => live && setKeys((m) => (m[pid] === k ? m : {...m, [pid]: k})),
          () => {},
        );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, id, firstDone]);

  if (!session.ready) return <Loading />;
  if (!session.user) return <LockedNote text="Сэдвийг үзэхийн тулд нэвтэрнэ үү." />;
  if (!session.admin && (!session.profile || session.profile.disabled)) return <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!topics || !progress || !marks || (uid && !rounds)) return <Loading />;

  const t = t0;
  if (!t || (!session.admin && !forClassOf(t, session.profile?.class)))
    return (
      <CenterNote title="Сэдэв олдсонгүй">
        <Link href="/topics" className="text-blue-400 hover:underline">
          Бүх сэдэв
        </Link>
      </CenterNote>
    );

  const marked = marks[t.id] ?? {};
  // Each time's answers: the first's in topicProgress, the later ones' in topicRounds.
  const answersOf = (n: number) => (n === 1 ? (progress[t.id] ?? {}) : (rounds?.[String(n)] ?? {}));
  // Every problem counts: one without a right answer is checked by the teacher the first time (until then it waits);
  // the later times, it isn't checked.
  const stateOf = (n: number, p: Problem): State => {
    const a = answersOf(n)[p.id];
    if (!a) return 'todo';
    if (!(p.id in keys)) return 'wait';
    const v = verdict(a.a, keys[p.id], n === 1 ? marked[p.id] : null);
    // No right answer: the teacher checks it the first time; later, nobody does.
    return v === true ? 'right' : v === false ? 'wrong' : n === 1 ? 'wait' : 'free';
  };
  const tally = (n: number) => {
    const s = t.problems.map((p) => stateOf(n, p));
    return {done: s.filter((x) => x !== 'todo').length, right: s.filter((x) => x === 'right').length, wait: s.filter((x) => x === 'wait').length};
  };
  const total = t.problems.length;
  const now = tally(current);
  const complete = total > 0 && now.done === total;
  // The scores of the times done (and the one under way).
  const times = Array.from({length: Math.max(last, next ?? 1)}, (_, i) => ({n: i + 1, ...tally(i + 1)}));
  const firstTime = times[0];
  // The best of the times done again (all their problems answered); none: empty.
  const again = times.filter((x) => x.n > 1 && x.done === total);
  const best = again.length ? again.reduce((a, x) => (x.right > a.right ? x : a)) : null;
  const grade = {score: now.right, total, count: total};
  const mine = answersOf(current);
  const label = (n: number) => (n === 1 ? 'Эхний удаа' : `${n} дахь удаа`);
  const restart = () => {
    setNext(last + 1);
    setView(null);
    setTimeout(() => list.current?.scrollIntoView({behavior: 'smooth', block: 'start'}), 50);
  };
  const jump = (i: number) => (list.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  const map = !session.admin && total > 0;

  return (
    <div className={`mx-auto max-w-3xl py-4 sm:py-6 ${map ? 'lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-x-8' : ''}`}>
      <div className="min-w-0 lg:col-start-1">
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
              {t.lesson.map((b, i) =>
                b.t === 'text' ? <Rich key={i} text={b.text} className="text-[15px] text-neutral-100" /> : b.t === 'img' ? <TopicPicture key={i} tid={t.id} iid={b.img} className="w-full" /> : <VideoEmbed key={i} link={b.url} title="Видео хичээл" />,
              )}
            </div>
          </section>
        )}
      </div>

      {map && (
        <aside className="mt-6 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
          <TopicMap
            problems={t.problems}
            stateOf={(p) => stateOf(current, p)}
            title={label(current)}
            done={now.done}
            right={now.right}
            wait={now.wait}
            complete={complete}
            first={firstTime}
            best={best}
            times={times}
            current={current}
            onPick={(n) => setView(n === Math.max(last, next ?? 1) ? null : n)}
            onJump={jump}
            onRestart={complete && current === Math.max(last, next ?? 1) ? restart : undefined}
          />
        </aside>
      )}

      <div className="min-w-0 lg:col-start-1">
        {t.problems.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ListChecks size={18} /> Бодлого
                {current > 1 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-200">{label(current)}</span>}
              </h2>
              {/* (How far, and the score: in the map.) Answers the teacher has yet to check, said here. */}
              {!session.admin && now.wait > 0 && current === 1 && <span className="text-sm text-violet-300">{now.wait} нь багш шалгаж байна</span>}
            </div>
            {complete && !session.admin && (current > 1 || now.wait === 0) && (
              <ResultCard perfect={isPerfect(grade) ? 'test' : null} id={`topic-${t.id}-${current}`} className="mb-4">
                {isPerfect(grade) && <PerfectTitle kind="test" />}
                <p className="text-lg font-semibold">{current === 1 ? 'Бүх бодлогыг бодлоо!' : `${current} дахь удаагаа бүгдийг бодлоо!`}</p>
                <p className="text-sm text-neutral-400">
                  {current === 1
                    ? `Эхний оролдлогоор ${now.right}/${total} зөв. Алдсан бодлогоо «Дахин бодох»-оор дахин бодож болно.`
                    : `Энэ удаа ${now.right}/${total} зөв (эхний удаа ${firstTime.right}/${total}). Тоологдох нь эхний удаагийнх.`}
                </p>
                {current === Math.max(last, next ?? 1) && (
                  <button type="button" onClick={restart} className="mt-3 flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400">
                    <RotateCcw size={15} /> Дахин эхнээс нь бодох
                  </button>
                )}
              </ResultCard>
            )}
            <ol ref={list} className="space-y-4 [&>li]:scroll-mt-20">
              {t.problems.map((p, i) => (
                <ProblemView
                  key={`${current}/${p.id}`}
                  tid={t.id}
                  p={p}
                  num={problemNo(p, i)}
                  first={mine[p.id]}
                  mark={current === 1 ? marked[p.id] : undefined}
                  round={current > 1 ? current : undefined}
                  teacher={session.admin}
                  ask={`${t.title} · ${problemNo(p, i)}-р бодлого`}
                  onOutcome={(o) => {
                    setKeys((m) => (m[p.id] === o.key ? m : {...m, [p.id]: o.key}));
                    // A wrong first answer goes into the mistakes notebook (once): wrong by the teacher's mark, else the key.
                    if (current === 1 && !session.admin && mistakes && o.key !== null && verdict(o.a, o.key, marked[p.id]) === false) addMistakes([{s: 'p', t: t.id, q: p.id}], mistakes).catch(() => {});
                  }}
                />
              ))}
            </ol>
          </section>
        )}
        {!t.lesson.length && !t.problems.length && <p className="mt-8 rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">Энэ сэдэвт одоогоор агуулга алга.</p>}
      </div>
    </div>
  );
}

const STATE: Record<State, string> = {
  right: 'bg-green-500/20 text-green-200 ring-1 ring-green-500/40',
  wrong: 'bg-red-500/20 text-red-200 ring-1 ring-red-500/40',
  wait: 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40',
  free: 'bg-neutral-700 text-neutral-200 ring-1 ring-neutral-500',
  todo: 'bg-neutral-800 text-neutral-400',
};

/** The map beside the problems: each problem by its number, how it went this time; the score; the times done. */
function TopicMap(props: {
  problems: Problem[];
  stateOf: (p: Problem) => State;
  title: string;
  done: number;
  right: number;
  wait: number;
  complete: boolean;
  first: {done: number; right: number};
  best: {n: number; right: number} | null;
  times: {n: number; done: number; right: number}[];
  current: number;
  onPick: (n: number) => void;
  onJump: (i: number) => void;
  onRestart?: () => void;
}) {
  const {problems, stateOf, title, done, right, wait, complete, first, best, times, current, onPick, onJump, onRestart} = props;
  const [shut, setShut] = useState(false);
  const total = problems.length;
  const pct = total ? Math.round((right / total) * 100) : 0;
  return (
    <div className="rounded-2xl bg-neutral-900 p-4">
      <button type="button" onClick={() => setShut(!shut)} aria-expanded={!shut} className="flex w-full items-center gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-400">Задаргаа · {title}</span>
          <span className="mt-0.5 block font-semibold">
            {complete ? (
              <>
                Дүн: {right}/{total} зөв <span className="text-sm font-normal text-neutral-400">({pct}%)</span>
              </>
            ) : (
              `${done}/${total} бодсон${done ? ` · ${right} зөв` : ''}`
            )}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-neutral-500 transition-transform ${shut ? '' : 'rotate-180'}`} />
      </button>
      {!shut && (
        <>
          {/* The first time (the one that counts) and the best time done again (none yet: empty). */}
          <dl className="mt-3 divide-y divide-neutral-700/60 rounded-xl bg-neutral-800/60 text-sm">
            <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <dt className="text-neutral-400">Эхний удаа</dt>
              <dd className={`tabular-nums ${first.done === total ? 'font-semibold' : 'text-neutral-500'}`}>{first.done === total ? `${first.right}/${total}` : 'бодож байна'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <dt className="text-neutral-400">Дахин бодсон шилдэг</dt>
              <dd className={`tabular-nums ${best ? 'font-semibold' : 'text-neutral-500'}`} title={best ? `${best.n} дахь удаа` : 'Дахин бодоогүй'}>
                {best ? `${best.right}/${total}` : '—'}
              </dd>
            </div>
          </dl>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5" role="list" aria-label="Бодлогууд">
            {problems.map((p, i) => {
              const s = stateOf(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="listitem"
                  onClick={() => onJump(i)}
                  title={`${problemNo(p, i)}-р бодлого: ${s === 'right' ? 'зөв' : s === 'wrong' ? 'буруу' : s === 'wait' ? 'шалгагдаж байна' : s === 'free' ? 'бодсон (шалгахгүй)' : 'бодоогүй'}`}
                  className={`h-9 rounded-lg text-sm font-semibold tabular-nums hover:brightness-125 ${STATE[s]}`}
                >
                  {problemNo(p, i)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
            <span className="text-green-300">■ зөв</span>
            <span className="text-red-300">■ буруу</span>
            {wait > 0 && <span className="text-violet-300">■ шалгагдаж байна</span>}
            <span>■ бодоогүй</span>
          </p>
          {times.length > 1 && (
            <div className="mt-3 border-t border-neutral-800 pt-3">
              <p className="text-xs font-semibold text-neutral-400">Бодсон удаа</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {times.map((x) => (
                  <button
                    key={x.n}
                    type="button"
                    onClick={() => onPick(x.n)}
                    aria-pressed={x.n === current}
                    className={`rounded-full px-2.5 py-1 text-xs tabular-nums ${x.n === current ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                  >
                    {x.n === 1 ? '1-р' : `${x.n}-р`}: {x.done < total ? `${x.done}/${total} бодож байна` : `${x.right}/${total}`}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-500">Багшид эхний удаагийн дүн тоологдоно.</p>
            </div>
          )}
          {onRestart && (
            <button type="button" onClick={onRestart} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700">
              <RotateCcw size={15} /> Дахин эхнээс нь бодох
            </button>
          )}
        </>
      )}
    </div>
  );
}
