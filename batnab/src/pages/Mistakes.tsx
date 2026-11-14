import {CheckCircle2, ChevronDown, NotebookPen, RotateCcw, Sparkles} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {InactiveNote, LockedNote} from '../components/Notices';
import {MistakeItem, mistakeExists, mistakeLabel, mistakeTopic, NotebookTools, useLastSeen} from '../components/Practice';
import {choiceAt, useKeys} from '../lib/keys';
import {addMistakes, isDue, LAST_BOX, reopen, useMistakes, WHYS, type Mistake} from '../lib/mistakes';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {isStudent, useSession} from '../lib/session';
import {useStats} from '../lib/stats';
import {dayLabel, serverNow} from '../lib/time';
import {forClassOf, readKey, useMarks, useProgress, useTopics, verdict} from '../lib/topics';
import Loading from '../components/Loading';

const DAY = 86_400_000;
const PAGE = 10;
const when = (next: number, now: number) => {
  const d = Math.ceil((next - now) / DAY);
  return next <= now ? 'одоо' : d <= 1 ? 'маргааш' : `${d} өдрийн дараа`;
};

type Tab = 'due' | 'all' | 'learned' | 'notes';

/**
 * /mistakes: the mistakes notebook. Due problems first; each solved right comes back later, until it is learned (the
 * last time on a similar problem). By topic, why they went wrong, the learned ones and one's own notes to look back on.
 */
export default function Mistakes() {
  const session = useSession();
  const uid = isStudent(session) ? session.user!.uid : undefined;
  const mistakes = useMistakes(uid);
  const topics = useTopics();
  const stats = useStats(uid);
  const [tab, setTab] = useState<Tab>('due');
  // A topic picked: just its problems, in every tab.
  const [topic, setTopic] = useState<string | null>(null);
  // A learned problem (or one with a note) opened to look at again.
  const [opened, setOpened] = useState<string | null>(null);
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

  if (!session.ready) return <Loading />;
  if (!session.user) return <LockedNote text="Алдааны дэвтрээ харахын тулд нэвтэрнэ үү." />;
  if (!uid) return session.admin ? <p className="py-24 text-center text-neutral-400">Алдааны дэвтэр сурагчдад зориулагдсан.</p> : <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!mistakes || !topics) return <Loading />;

  const now = serverNow();
  const there = mistakes.filter((m) => mistakeExists(m, topics));
  const inTopic = (m: Mistake) => !topic || mistakeTopic(m, topics).key === topic;
  const list = there.filter((m) => !m.done && inTopic(m)).sort((a, b) => a.next - b.next || a.at - b.at);
  const learned = there.filter((m) => !!m.done && inTopic(m)).sort((a, b) => b.done! - a.done!);
  const notes = there.filter((m) => !!m.note && inTopic(m)).sort((a, b) => b.at - a.at);
  // Oldest mistakes first, in an order that stays put while they are solved (solving one moves its `next`).
  const due = [...new Set([...kept, ...list.filter((m) => isDue(m, now)).map((m) => m.id)])]
    .map(find)
    .filter((m): m is Mistake => !!m && mistakeExists(m, topics) && inTopic(m))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const dueCount = list.filter((m) => isDue(m, now)).length;
  // By topic: the problems still in the notebook, most first.
  const byTopic = new Map<string, {name: string; n: number}>();
  for (const m of there.filter((x) => !x.done)) {
    const t = mistakeTopic(m, topics);
    byTopic.set(t.key, {name: t.name, n: (byTopic.get(t.key)?.n ?? 0) + 1});
  }
  const chips = [...byTopic.entries()].sort((a, b) => b[1].n - a[1].n);
  // Why they went wrong (as the student said), most first, with a word on the commonest.
  const whys = WHYS.map(([id, name, tip]) => ({id, name, tip, n: there.filter((m) => m.why === id).length}))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const learnedCount = Math.max(stats?.learned ?? 0, there.filter((m) => m.done).length);
  const tile = (t: Tab, label: string, value: number, tone = '') => (
    <button
      type="button"
      onClick={() => setTab(t)}
      aria-pressed={tab === t}
      className={`min-w-0 rounded-2xl px-1.5 py-3 text-center sm:p-4 ${tab === t ? 'bg-neutral-800 ring-1 ring-neutral-600' : 'bg-neutral-900 hover:bg-neutral-800/70'}`}
    >
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-neutral-400">{label}</p>
    </button>
  );
  const whyName = (m: Mistake) => WHYS.find((w) => w[0] === m.why)?.[1];

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
          <NotebookPen size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Алдааны дэвтэр</h1>
          <p className="text-sm text-neutral-400">
            Алдсан бодлого энд цуглана. Зөв бодох бүрд дараа нь (маргааш, 3 хоног, 7 хоногийн дараа) дахин гарч, сүүлд нь төстэй өөр бодлогыг зөв бодвол сурсанд тооцно.
          </p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
        {tile('due', 'Өнөөдөр давтах', dueCount, 'text-rose-300')}
        {tile('all', 'Дэвтэрт', there.filter((m) => !m.done).length)}
        {tile('learned', 'Сурсан', learnedCount, 'text-green-400')}
        {tile('notes', 'Тэмдэглэл', notes.length, 'text-amber-300')}
      </div>

      {chips.length > 1 && (
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Сэдвээр шүүх">
          <button
            type="button"
            onClick={() => setTopic(null)}
            aria-pressed={!topic}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${!topic ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-300'}`}
          >
            Бүх сэдэв
          </button>
          {chips.map(([key, c]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTopic(topic === key ? null : key)}
              aria-pressed={topic === key}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${topic === key ? 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/60' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
            >
              {c.name} — <b className="tabular-nums">{c.n}</b> алдаа
            </button>
          ))}
        </div>
      )}

      {whys.length > 0 && (
        <div className="mt-4 rounded-2xl bg-neutral-900 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Миний алдааны шалтгаан</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {whys.map((w) => (
              <span key={w.id}>
                {w.name} <b className="tabular-nums">{w.n}</b>
              </span>
            ))}
          </p>
          <p className="mt-2 text-neutral-300">💡 {whys[0].tip}</p>
        </div>
      )}


      {tab === 'due' &&
        (!due.length ? (
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
          <div className="mt-5 space-y-6">
            {due.slice(0, shown).map((m) => (
              <MistakeItem key={m.id} m={m} topics={topics} testKey={m.s === 't' ? keys[m.t] : undefined} stats={stats} />
            ))}
            {due.length > shown && (
              <button onClick={() => setShown((n) => n + PAGE)} className="w-full rounded-full bg-neutral-800 py-2.5 text-sm font-medium hover:bg-neutral-700">
                Дараагийн {Math.min(PAGE, due.length - shown)} бодлого ({due.length - shown} үлдсэн)
              </button>
            )}
          </div>
        ))}

      {tab === 'all' && (
        <ul className="mt-5 divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
          {list.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{mistakeLabel(m, topics)}</span>
                <span className="block text-xs text-neutral-500">
                  {mistakeTopic(m, topics).name} · Дараагийн давталт: {when(m.next, now)}
                  {m.why && ` · ${whyName(m)}`}
                </span>
                {m.note && <span className="mt-1 block text-xs text-amber-100/90 [overflow-wrap:anywhere]">📝 {m.note}</span>}
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

      {(tab === 'learned' || tab === 'notes') && (
        <div className="mt-5 space-y-3">
          {tab === 'learned' && learnedCount > learned.length && !topic && (
            <p className="text-xs text-neutral-500">Өмнө нь сурсан {learnedCount - learned.length} бодлого энд хадгалагдаагүй (тэр үед сурсан бодлогыг дэвтрээс хасдаг байсан).</p>
          )}
          {(tab === 'learned' ? learned : notes).map((m) => (
            <div key={m.id} className="rounded-2xl bg-neutral-900">
              <button
                type="button"
                onClick={() => setOpened(opened === m.id ? null : m.id)}
                aria-expanded={opened === m.id}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-neutral-800/50"
              >
                {m.done ? <CheckCircle2 size={18} className="shrink-0 text-green-400" /> : <NotebookPen size={18} className="shrink-0 text-rose-300" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{mistakeLabel(m, topics)}</span>
                  <span className="block text-xs text-neutral-500">
                    {mistakeTopic(m, topics).name}
                    {m.done ? ` · сурсан ${dayLabel(m.done)}` : ` · давтах ${when(m.next, now)}`}
                    {m.why && ` · ${whyName(m)}`}
                  </span>
                  {m.note && <span className="mt-1 block whitespace-pre-wrap text-sm text-amber-100 [overflow-wrap:anywhere]">📝 {m.note}</span>}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-neutral-500 transition-transform ${opened === m.id ? 'rotate-180' : ''}`} />
              </button>
              {opened === m.id && (
                <div className="space-y-3 border-t border-neutral-800 p-3">
                  {m.done || !isDue(m, now) ? (
                    <>
                      <MistakeItem m={m} topics={topics} testKey={m.s === 't' ? keys[m.t] : undefined} stats={stats} practice />
                      <NotebookTools m={m} />
                    </>
                  ) : (
                    <MistakeItem m={m} topics={topics} testKey={m.s === 't' ? keys[m.t] : undefined} stats={stats} />
                  )}
                  {m.done && (
                    <button type="button" onClick={() => void reopen(m)} className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700">
                      <RotateCcw size={15} /> Дахин дэвтэрт оруулах
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {!(tab === 'learned' ? learned : notes).length && (
            <p className="rounded-2xl bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-400">
              {tab === 'learned' ? 'Сурсан бодлого энд гарна.' : 'Бодлогын доорх «Тэмдэглэл нэмэх»-ээр өөртөө тайлбар үлдээгээрэй.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mistakes made before the notebook existed (or on another device): this week's wrong test answers and wrong first
 * answers in topics go in once per visit.
 */
function useBackfill(uid: string | undefined, mistakes: Mistake[] | null) {
  const results = useMyResults();
  const topics = useTopics();
  const progress = useProgress(uid);
  const marks = useMarks(uid);
  const session = useSession();
  const keys = useKeys(results ? results.map((r) => r.test) : []);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !uid || !mistakes || !results || !topics || !progress || !marks) return;
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
          if (verdict(mine.a, key, marks[t.id]?.[p.id]) === false) items.push({s: 'p', t: t.id, q: p.id});
        }
      }
      await addMistakes(items, mistakes);
    })().catch(() => {});
  }, [uid, mistakes, results, topics, progress, marks, keys, session.profile?.class]);
}
