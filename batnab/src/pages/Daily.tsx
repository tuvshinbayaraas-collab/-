import {Flame} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {InactiveNote, LockedNote} from '../components/Notices';
import {ResultCard} from '../components/Perfect';
import {MistakeItem, mistakeExists, useLastSeen} from '../components/Practice';
import {ProblemView} from '../components/TopicParts';
import {useKeys} from '../lib/keys';
import {addMistakes, isDue, useMistakes} from '../lib/mistakes';
import {Link} from '../lib/router';
import {isStudent, useSession} from '../lib/session';
import {dayKey, doneToday, liveStreak, practised, useStats} from '../lib/stats';
import {forClassOf, problemNo, useProgress, useTopics} from '../lib/topics';

const SIZE = 5;
type Saved = {items: string[]; done: string[]};
const storeKey = (uid: string, day: string) => `batnab.daily.${uid}.${day}`;
const load = (k: string): Saved | null => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null');
  } catch {
    return null;
  }
};
const save = (k: string, v: Saved) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // storage blocked: today's set is picked again on the next visit
  }
};
/** The same shuffle all day long, different each day. */
function shuffle<T>(xs: T[], seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * /daily: five problems a day — first those due in the mistakes notebook, then topic problems not yet solved, then
 * solved ones again. Finishing them keeps the 🔥 streak going.
 */
export default function Daily() {
  const session = useSession();
  const uid = isStudent(session) ? session.user!.uid : undefined;
  const mistakes = useMistakes(uid);
  const topics = useTopics();
  const progress = useProgress(uid);
  const stats = useStats(uid);
  const find = useLastSeen(mistakes);
  const day = dayKey();
  const [saved, setSaved] = useState<Saved | null>(null);

  // Today's set, picked once (and kept on this device for the day).
  useEffect(() => {
    if (!uid || !mistakes || !topics || !progress || saved) return;
    const k = storeKey(uid, day);
    const stored = load(k);
    if (stored) return setSaved(stored);
    const mine = topics.filter((t) => forClassOf(t, session.profile?.class));
    const due = mistakes.filter((m) => isDue(m) && mistakeExists(m, topics)).sort((a, b) => a.next - b.next);
    const items = due.slice(0, SIZE).map((m) => `m:${m.id}`);
    const fresh = mine.flatMap((t) => t.problems.filter((p) => p.k && !progress[t.id]?.[p.id]).map((p) => `n:${t.id}/${p.id}`));
    items.push(...fresh.slice(0, SIZE - items.length));
    const again = shuffle(
      mine.flatMap((t) => t.problems.filter((p) => p.k && progress[t.id]?.[p.id]).map((p) => `a:${t.id}/${p.id}`)),
      uid + day,
    );
    items.push(...again.slice(0, SIZE - items.length));
    const v = {items, done: []};
    save(k, v);
    setSaved(v);
  }, [uid, mistakes, topics, progress, saved, day, session.profile?.class]);

  const testIds = useMemo(() => [...new Set((mistakes ?? []).filter((m) => m.s === 't').map((m) => m.t))], [mistakes]);
  const keys = useKeys(testIds);
  const markDone = (item: string) =>
    setSaved((v) => {
      if (!v || v.done.includes(item)) return v;
      const next = {...v, done: [...v.done, item]};
      if (uid) save(storeKey(uid, day), next);
      return next;
    });

  // All done: the streak moves on (once a day).
  const counted = useRef(false);
  const finished = !!saved && saved.items.length > 0 && saved.items.every((i) => saved.done.includes(i));
  useEffect(() => {
    if (!finished || !stats || counted.current || doneToday(stats)) return;
    counted.current = true;
    practised(stats, saved!.items.length).catch(() => {});
  }, [finished, stats, saved]);

  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote text="Өдрийн дасгал хийхийн тулд нэвтэрнэ үү." />;
  if (!uid) return session.admin ? <p className="py-24 text-center text-neutral-400">Өдрийн дасгал сурагчдад зориулагдсан.</p> : <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!saved || !topics || !mistakes || !progress) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  const streak = liveStreak(stats);
  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      <header className="flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${streak ? 'bg-orange-500/20 text-orange-300' : 'bg-neutral-800 text-neutral-400'}`}>
          <Flame size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Өдрийн дасгал</h1>
          <p className="text-sm text-neutral-400">Өдөр бүр {SIZE} бодлого. Дуусгавал 🔥 цуваа үргэлжилнэ.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold tabular-nums text-orange-300">🔥 {streak}</p>
          <p className="text-xs text-neutral-500">хамгийн их: {stats?.best ?? 0}</p>
        </div>
      </header>

      {!saved.items.length ? (
        <div className="mt-6 rounded-2xl bg-neutral-900 p-8 text-center text-neutral-400">
          Одоогоор дасгал алга: багш сэдэв нээгээгүй, алдааны дэвтэр ч хоосон байна.{' '}
          <Link href="/" className="text-blue-400 hover:underline">
            Тест өгөх
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full rounded-full bg-orange-400 transition-[width]" style={{width: `${(saved.done.length / saved.items.length) * 100}%`}} />
            </div>
            <span className="text-sm tabular-nums text-neutral-400">
              {saved.done.length}/{saved.items.length}
            </span>
          </div>
          {finished && (
            <ResultCard perfect="exam" id={`daily-${uid}-${day}`} className="mt-4">
              <p className="text-lg font-bold">🔥 {Math.max(streak, 1)} өдөр дараалан!</p>
              <p className="mt-1 text-sm text-neutral-300">Өнөөдрийн дасгал дууслаа. Маргааш дахиад ирээрэй.</p>
            </ResultCard>
          )}
          <div className="mt-5 space-y-5">
            {saved.items.map((item, i) => {
              const [kind, rest] = [item[0], item.slice(2)];
              if (kind === 'm') {
                const m = find(rest);
                if (!m) return saved.done.includes(item) ? null : <Skip key={item} onSkip={() => markDone(item)} />;
                return <MistakeItem key={item} m={m} topics={topics} testKey={m.s === 't' ? keys[m.t] : undefined} stats={stats} onDone={() => markDone(item)} />;
              }
              const [tid, pid] = rest.split('/');
              const t = topics.find((x) => x.id === tid);
              const p = t?.problems.find((x) => x.id === pid);
              if (!t || !p) return saved.done.includes(item) ? null : <Skip key={item} onSkip={() => markDone(item)} />;
              const label = `${t.title} · ${problemNo(p, t.problems.indexOf(p))}-р бодлого`;
              return kind === 'n' ? (
                <ol key={item}>
                  <ProblemView
                    tid={tid}
                    p={p}
                    num={i + 1}
                    heading={label}
                    first={progress[tid]?.[pid]}
                    ask={label}
                    onOutcome={(o) => {
                      markDone(item);
                      if (o.key !== null && o.a !== o.key) addMistakes([{s: 'p', t: tid, q: pid}], mistakes).catch(() => {});
                    }}
                  />
                </ol>
              ) : (
                <ol key={item}>
                  <ProblemView tid={tid} p={p} num={i + 1} heading={label} ask={label} review={() => markDone(item)} />
                </ol>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const Skip = ({onSkip}: {onSkip: () => void}) => {
  useEffect(onSkip, [onSkip]);
  return null;
};
