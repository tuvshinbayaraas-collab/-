import {NotebookPen, Sparkles} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {InactiveNote, LockedNote} from '../components/Notices';
import {MistakeItem, mistakeExists, mistakeLabel, useLastSeen} from '../components/Practice';
import {choiceAt, useKeys} from '../lib/keys';
import {addMistakes, isDue, LAST_BOX, useMistakes, type Mistake} from '../lib/mistakes';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {isStudent, useSession} from '../lib/session';
import {useStats} from '../lib/stats';
import {serverNow} from '../lib/time';
import {forClassOf, readKey, useProgress, useTopics} from '../lib/topics';

const DAY = 86_400_000;
const PAGE = 10;
const when = (next: number, now: number) => {
  const d = Math.ceil((next - now) / DAY);
  return next <= now ? 'одоо' : d <= 1 ? 'маргааш' : `${d} өдрийн дараа`;
};

/** /mistakes: the mistakes notebook. Due problems first; each solved right comes back later, until it is learned. */
export default function Mistakes() {
  const session = useSession();
  const uid = isStudent(session) ? session.user!.uid : undefined;
  const mistakes = useMistakes(uid);
  const topics = useTopics();
  const stats = useStats(uid);
  const [tab, setTab] = useState<'due' | 'all'>('due');
  // Every problem due during this visit stays on screen (with its outcome) once solved, though no longer due.
  const [kept, setKept] = useState<string[]>([]);
  const find = useLastSeen(mistakes);
  useEffect(() => {
    if (!mistakes) return;
    const now = serverNow();
    const ids = mistakes.filter((m) => isDue(m, now)).map((m) => m.id);
    setKept((k) => (ids.every((id) => k.includes(id)) ? k : [...new Set([...k, ...ids])]));
  }, [mistakes]);
  const [shown, setShown] = useState(PAGE);
  useBackfill(uid, mistakes);
  const testIds = [...new Set((mistakes ?? []).filter((m) => m.s === 't').map((m) => m.t))];
  const keys = useKeys(testIds);

  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote text="Алдааны дэвтрээ харахын тулд нэвтэрнэ үү." />;
  if (!uid) return session.admin ? <p className="py-24 text-center text-neutral-400">Алдааны дэвтэр сурагчдад зориулагдсан.</p> : <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!mistakes || !topics) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  const now = serverNow();
  const list = mistakes.filter((m) => mistakeExists(m, topics)).sort((a, b) => a.next - b.next || a.at - b.at);
  // Oldest mistakes first, in an order that stays put while they are solved (solving one moves its `next`).
  const due = [...new Set([...kept, ...list.filter((m) => isDue(m, now)).map((m) => m.id)])]
    .map(find)
    .filter((m): m is Mistake => !!m && mistakeExists(m, topics))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const dueCount = list.filter((m) => isDue(m, now)).length;

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
          <NotebookPen size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Алдааны дэвтэр</h1>
          <p className="text-sm text-neutral-400">Алдсан бодлого энд цуглана. Зөв бодох бүрд дараа нь (маргааш, 3 хоног, 7 хоногийн дараа) дахин гарч, 4 удаа зөв бодвол сурсанд тооцно.</p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Tile label="Өнөөдөр давтах" value={dueCount} tone="text-rose-300" />
        <Tile label="Дэвтэрт" value={list.length} />
        <Tile label="Сурсан" value={stats?.learned ?? 0} tone="text-green-400" />
      </div>

      <div className="mt-5 flex rounded-full bg-neutral-900 p-1 text-sm" role="tablist">
        {(
          [
            ['due', `Давтах (${dueCount})`],
            ['all', `Бүгд (${list.length})`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 rounded-full px-3 py-1.5 font-medium ${tab === id ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'due' ? (
        !due.length ? (
          <div className="mt-6 rounded-2xl bg-neutral-900 p-8 text-center">
            <Sparkles size={28} className="mx-auto text-amber-300" />
            <p className="mt-3 font-semibold">{list.length ? 'Өнөөдөр давтах бодлого алга!' : 'Дэвтэр хоосон байна'}</p>
            <p className="mt-1 text-sm text-neutral-400">
              {list.length ? 'Дараагийн давталт ' + when(list[0].next, now) + '.' : 'Тест, сэдвийн бодлогод алдвал энд нэмэгдэнэ.'}{' '}
              <Link href="/daily" className="text-blue-400 hover:underline">
                Өдрийн дасгал
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {due.slice(0, shown).map((m) => (
              <MistakeItem
                key={m.id}
                m={m}
                topics={topics}
                testKey={m.s === 't' ? keys[m.t] : undefined}
                stats={stats}
              />
            ))}
            {due.length > shown && (
              <button onClick={() => setShown((n) => n + PAGE)} className="w-full rounded-full bg-neutral-800 py-2.5 text-sm font-medium hover:bg-neutral-700">
                Дараагийн {Math.min(PAGE, due.length - shown)} бодлого ({due.length - shown} үлдсэн)
              </button>
            )}
          </div>
        )
      ) : (
        <ul className="mt-5 divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
          {list.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{mistakeLabel(m, topics)}</span>
                <span className="block text-xs text-neutral-500">Дараагийн давталт: {when(m.next, now)}</span>
              </span>
              <span className="flex gap-0.5" aria-label={`${m.box} шат давсан`}>
                {Array.from({length: LAST_BOX + 1}, (_, i) => (
                  <span key={i} className={`h-1.5 w-4 rounded-full ${i < m.box ? 'bg-violet-400' : 'bg-neutral-700'}`} />
                ))}
              </span>
            </li>
          ))}
          {!list.length && <li className="px-4 py-6 text-center text-sm text-neutral-400">Дэвтэр хоосон байна.</li>}
        </ul>
      )}
    </div>
  );
}

const Tile = ({label, value, tone = ''}: {label: string; value: number; tone?: string}) => (
  <div className="rounded-2xl bg-neutral-900 p-3 text-center sm:p-4">
    <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    <p className="text-xs text-neutral-400">{label}</p>
  </div>
);

/**
 * Mistakes made before the notebook existed (or on another device): this week's wrong test answers and wrong first
 * answers in topics go in once per visit.
 */
function useBackfill(uid: string | undefined, mistakes: Mistake[] | null) {
  const results = useMyResults();
  const topics = useTopics();
  const progress = useProgress(uid);
  const session = useSession();
  const keys = useKeys(results ? results.map((r) => r.test) : []);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !uid || !mistakes || !results || !topics || !progress) return;
    if (results.some((r) => keys[r.test] === undefined)) return;
    done.current = true;
    (async () => {
      const items: {s: 'p' | 't'; t: string; q: string}[] = [];
      for (const r of results) {
        const key = keys[r.test];
        if (!key) continue;
        for (let qi = 0; qi < r.answers.length; qi++) {
          const a = choiceAt(r.answers, qi);
          const k = choiceAt(key, qi);
          if (a !== null && k !== null && a !== k) items.push({s: 't', t: r.test, q: String(qi)});
        }
      }
      for (const t of topics.filter((x) => forClassOf(x, session.profile?.class))) {
        for (const p of t.problems) {
          const mine = progress[t.id]?.[p.id];
          if (!mine) continue;
          const key = await readKey(t.id, p.id).catch(() => null);
          if (key !== null && mine.a !== key) items.push({s: 'p', t: t.id, q: p.id});
        }
      }
      await addMistakes(items, mistakes);
    })().catch(() => {});
  }, [uid, mistakes, results, topics, progress, keys, session.profile?.class]);
}
