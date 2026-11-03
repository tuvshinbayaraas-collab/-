import {Check, NotebookPen, Shuffle, X} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import {auth} from '../lib/firebase';
import {choiceAt, useKeys} from '../lib/keys';
import {addMistakes, LAST_BOX, mistakeId, NOTE_MAX, reviewed, setNote, setWhy, useMistakes, WHYS, type Mistake} from '../lib/mistakes';
import {useMyResults} from '../lib/results';
import {learnedOne, type Stats} from '../lib/stats';
import {problemNo, useProgress, type Problem, type Topic} from '../lib/topics';
import {loadTest, testInfo} from '../tests';
import {hintOf} from '../tests/hints';
import {SKILLS, skillOf} from '../tests/skills';
import type {Test} from '../tests/types';
import AskButton from './Ask';
import HelpLadder from './HelpLadder';
import QuestionCard from './QuestionCard';
import {ProblemView} from './TopicParts';

const tests = new Map<string, Promise<Test | undefined>>();
const useTest = (id: string | undefined) => {
  const [t, setT] = useState<Test | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let live = true;
    if (!tests.has(id)) tests.set(id, loadTest(id) ?? Promise.resolve(undefined));
    tests.get(id)!.then(
      (x) => live && setT(x ?? null),
      () => live && setT(null),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return t;
};

/**
 * Looks a notebook problem up by id, falling back to how it was when last seen: one learned (and so out of the
 * notebook) while on screen stays there with its outcome.
 */
export function useLastSeen(mistakes: Mistake[] | null) {
  const [seen, setSeen] = useState<Record<string, Mistake>>({});
  useEffect(() => {
    if (mistakes?.length) setSeen((s) => ({...s, ...Object.fromEntries(mistakes.map((m) => [m.id, m]))}));
  }, [mistakes]);
  return (id: string) => mistakes?.find((m) => m.id === id) ?? seen[id];
}

/** Where a notebook problem came from, for its heading. */
export function mistakeLabel(m: {s: 'p' | 't'; t: string; q: string}, topics: Topic[] | null) {
  if (m.s === 't') return `${testInfo(m.t)?.title ?? m.t} · ${Number(m.q) + 1}-р бодлого`;
  const t = topics?.find((x) => x.id === m.t);
  const i = t?.problems.findIndex((p) => p.id === m.q) ?? -1;
  return t && i >= 0 ? `${t.title} · ${problemNo(t.problems[i], i)}-р бодлого` : 'Сэдвийн бодлого';
}

/** What a notebook problem is on, to group and filter by: a test question's topic, or the teacher's topic. */
export function mistakeTopic(m: Mistake, topics: Topic[] | null): {key: string; name: string} {
  if (m.s === 't') {
    const s = skillOf(m.t, Number(m.q));
    return s ? {key: `s:${s}`, name: SKILLS[s]} : {key: 's:?', name: 'Бусад'};
  }
  return {key: `p:${m.t}`, name: topics?.find((t) => t.id === m.t)?.title ?? 'Сэдэв'};
}

/** Whether a notebook problem can still be solved again: it's there, and (a topic's) still has a right answer to check against. */
export const mistakeExists = (m: Mistake, topics: Topic[]) =>
  m.s === 't' ? !!testInfo(m.t) && Number(m.q) < testInfo(m.t)!.count : !!topics.find((t) => t.id === m.t)?.problems.some((p) => p.id === m.q && p.k);

/** A number from an id, the same every time (to pick the same similar problem on every visit). */
const pickFrom = <T,>(id: string, list: T[]) => {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

/**
 * A problem solved the same way, for the notebook's last step (so a remembered answer doesn't count as learned): a
 * test question's twin in the other variant (Тест 1.А №7 ↔ 1.Б №7) when its key can be read, else a question on the
 * same topic from a test the student has taken (not one still in the notebook); a topic problem: another of the
 * topic's problems the student has answered. Undefined while looking; null: none to be had.
 */
function useSimilar(m: Mistake, on: boolean, topics: Topic[]) {
  const uid = auth.currentUser?.uid;
  const results = useMyResults();
  const mistakes = useMistakes(on ? uid : undefined);
  const progress = useProgress(on && m.s === 'p' ? uid : undefined);
  const twin = m.s === 't' ? m.t.charAt(0) + (m.t.charAt(1) === 'A' ? 'B' : 'A') : '';
  const pool = m.s === 't' ? [...new Set([m.t, twin, ...(results ?? []).map((r) => r.test), ...(mistakes ?? []).filter((x) => x.s === 't').map((x) => x.t)])].filter((t) => testInfo(t)) : [];
  const keys = useKeys(on ? pool : []);
  if (!on) return null;
  const busy = new Set((mistakes ?? []).filter((x) => !x.done).map((x) => x.id));
  if (m.s === 't') {
    if (!results || !mistakes || pool.some((t) => keys[t] === undefined)) return undefined;
    const q = Number(m.q);
    if (keys[twin] && choiceAt(keys[twin], q) !== null && !busy.has(mistakeId('t', twin, String(q)))) return {s: 't' as const, t: twin, q: String(q), twin: true};
    const skill = skillOf(m.t, q);
    const same: {s: 't'; t: string; q: string; twin: boolean}[] = [];
    for (const t of pool) {
      const key = keys[t];
      if (!key || !skill) continue;
      for (let i = 0; i < testInfo(t)!.count; i++)
        if (skillOf(t, i) === skill && !(t === m.t && i === q) && choiceAt(key, i) !== null && !busy.has(mistakeId('t', t, String(i)))) same.push({s: 't', t, q: String(i), twin: false});
    }
    return same.length ? pickFrom(m.id, same) : null;
  }
  if (!progress || !mistakes) return undefined;
  const t = topics.find((x) => x.id === m.t);
  const others = (t?.problems ?? []).filter((p) => p.id !== m.q && p.k && progress[m.t]?.[p.id] && !busy.has(mistakeId('p', m.t, p.id)));
  const p = others.length ? pickFrom(m.id, others) : null;
  return p ? {s: 'p' as const, t: m.t, q: p.id, twin: false} : null;
}

/**
 * One notebook problem solved again. Wrong, it says so, then helps on request: a hint, the steps (a test question's
 * written for it, never its answer; a topic problem's from the teacher's solution, then the answer), and a try again
 * that isn't counted. At the last step before learned it asks a similar problem instead. `practice`: a learned one
 * looked at again (nothing recorded). Either way the notebook moves it on (`onDone`).
 */
export function MistakeItem({
  m,
  topics,
  testKey,
  stats,
  practice,
  onDone,
}: {
  m: Mistake;
  topics: Topic[];
  testKey?: string | null;
  stats: Stats | null;
  practice?: boolean;
  onDone?: (right: boolean, learned: boolean) => void;
}) {
  const mistakes = useMistakes(practice ? undefined : auth.currentUser?.uid);
  const last = !practice && m.box >= LAST_BOX;
  const similar = useSimilar(m, last, topics);
  // The similar problem's test key (its own test's, when it is another test).
  const simKeys = useKeys(similar && similar.s === 't' && similar.t !== m.t ? [similar.t] : []);
  const finish = async (right: boolean) => {
    if (practice) return onDone?.(right, false);
    const learned = await reviewed(m, right).catch(() => false);
    if (learned) await learnedOne(stats).catch(() => {});
    // Wrong on the similar one: it goes in the notebook too.
    if (!right && last && similar) await addMistakes([{s: similar.s, t: similar.t, q: similar.q}], mistakes).catch(() => {});
    onDone?.(right, learned);
  };
  const label = mistakeLabel(m, topics);
  const boxes = (
    <span className="flex gap-0.5" title={`${m.box}/${LAST_BOX + 1} шат`} aria-label={`${m.box} шат давсан`}>
      {Array.from({length: LAST_BOX + 1}, (_, i) => (
        <span key={i} className={`h-1.5 w-4 rounded-full ${i < m.box ? 'bg-violet-400' : 'bg-neutral-700'}`} />
      ))}
    </span>
  );
  if (last && similar === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-neutral-900" />;
  // The last step: a similar problem in this one's place (or, with none to be had, this one again).
  const it = last && similar ? similar : {s: m.s, t: m.t, q: m.q, twin: false};
  const banner = last && (
    <p className="flex items-start gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
      <Shuffle size={16} className="mt-0.5 shrink-0 text-violet-300" />
      <span>
        {similar ? `Сүүлийн шат: «${label}»-тэй ${similar.twin ? 'яг ижил аргаар' : 'ижил сэдвээр'} бодогдох өөр бодлого. Зөв бодвол сурсанд тооцно.` : 'Сүүлийн шат: зөв бодвол сурсанд тооцно.'}
      </span>
    </p>
  );
  const heading = last && similar ? `Төстэй бодлого · ${mistakeLabel(similar, topics)}` : label;
  return (
    <div className="space-y-2">
      {banner}
      {it.s === 'p' ? (
        <TopicProblem tid={it.t} pid={it.q} topics={topics} heading={heading} boxes={boxes} onAnswered={finish} practice={practice} />
      ) : (
        <TestQuestion test={it.t} q={Number(it.q)} label={heading} testKey={it.t === m.t ? testKey : simKeys[it.t]} boxes={boxes} onAnswered={finish} practice={practice} />
      )}
      {!practice && <NotebookTools m={m} />}
    </div>
  );
}

function TopicProblem({
  tid,
  pid,
  topics,
  heading,
  boxes,
  onAnswered,
  practice,
}: {
  tid: string;
  pid: string;
  topics: Topic[];
  heading: string;
  boxes: ReactNode;
  onAnswered: (right: boolean) => void;
  practice?: boolean;
}) {
  const t = topics.find((x) => x.id === tid);
  const p: Problem | undefined = t?.problems.find((x) => x.id === pid);
  if (!t || !p) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end px-1">{boxes}</div>
      <ol>
        <ProblemView tid={t.id} p={p} num={0} heading={heading} review={onAnswered} ask={heading} stepped={!practice} />
      </ol>
    </div>
  );
}

/**
 * A test question in the notebook: pick, check (the first check counts); wrong, a hint, then the steps, and a try
 * again (practice). Tests never show their right answers, so neither does this.
 */
function TestQuestion({
  test: tid,
  q: qi,
  label,
  testKey,
  boxes,
  onAnswered,
  practice,
}: {
  test: string;
  q: number;
  label: string;
  testKey?: string | null;
  boxes: ReactNode;
  onAnswered: (right: boolean) => void;
  practice?: boolean;
}) {
  const test = useTest(tid);
  const [pick, setPick] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  // The first check is what counts; later tries are practice.
  const [counted, setCounted] = useState(false);
  const [help, setHelp] = useState(0);
  if (test === undefined || testKey === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-neutral-900" />;
  const q = test?.questions[qi];
  if (!q) return null;
  const right = testKey ? choiceAt(testKey, qi) : null;
  const ok = checked && pick === right;
  const hint = hintOf(tid, qi);
  const check = () => {
    setChecked(true);
    if (!counted) {
      setCounted(true);
      onAnswered(pick === right);
    }
  };
  const retry = () => {
    setChecked(false);
    setPick(null);
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 px-1 text-sm">
        <span className="font-semibold">{label}</span>
        {boxes}
      </div>
      <ol>
        <QuestionCard
          num={qi + 1}
          q={q}
          chosen={pick}
          checked={checked}
          correct={right}
          onChoose={checked ? undefined : (ci) => setPick(pick === ci ? null : ci)}
          // In the card, as a topic problem's: checking, how it went, help, and asking the teacher.
          footer={
            <div className="w-full space-y-3">
              <div className="flex w-full flex-wrap items-center gap-3">
                {!checked ? (
                  <>
                    <button
                      disabled={pick === null || right === null}
                      onClick={check}
                      className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:bg-neutral-800 disabled:text-neutral-500"
                    >
                      Шалгах
                    </button>
                    {counted && <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">дасгал</span>}
                    {right === null ? (
                      <span className="text-sm text-neutral-500">Энэ тестийн хариултыг одоо шалгах боломжгүй.</span>
                    ) : (
                      pick === null && <span className="text-sm text-neutral-500">Хариултаа сонгоно уу.</span>
                    )}
                  </>
                ) : (
                  <p className={`flex items-center gap-2 font-semibold ${ok ? 'text-green-400' : 'text-red-300'}`}>
                    {ok ? <Check size={18} /> : <X size={18} />}
                    {practice
                      ? ok
                        ? 'Зөв!'
                        : 'Буруу.'
                      : ok
                        ? counted && help
                          ? 'Зөв! Сануулгатай бодсон ч гэсэн дараа дахин давтана.'
                          : 'Дараа дахин давтана.'
                        : 'Маргааш дахин гарна. Доорх тусламжийг үзээрэй.'}
                  </p>
                )}
                <span className="ml-auto">
                  <AskButton ctx={{s: 't', t: tid, q: String(qi), label}} />
                </span>
              </div>
              {checked && !ok && <HelpLadder hint={hint?.hint} steps={hint?.steps} help={help} setHelp={setHelp} onRetry={retry} />}
            </div>
          }
        />
      </ol>
    </div>
  );
}

/** Under a notebook problem: why it went wrong (the student's own word), and their own note on it. */
export function NotebookTools({m}: {m: Mistake}) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [text, setText] = useState(m.note ?? '');
  const [error, setError] = useState('');
  const save = () =>
    setNote(m, text).then(
      () => setEditing(false),
      (e) => setError((e as Error).message),
    );
  return (
    <div className="space-y-2 px-1">
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Яагаад алдсан бэ?">
        {picking ? (
          <>
            <span className="mr-1 text-neutral-500">Яагаад алдсан бэ?</span>
            {WHYS.map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={m.why === id}
                onClick={() => {
                  setPicking(false);
                  void setWhy(m, id).catch((e) => setError((e as Error).message));
                }}
                className={`rounded-full px-2.5 py-1 font-medium ${m.why === id ? 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/60' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
              >
                {name}
              </button>
            ))}
          </>
        ) : m.why ? (
          <button type="button" onClick={() => setPicking(true)} title="Шалтгаанаа өөрчлөх" className="rounded-full bg-rose-500/15 px-2.5 py-1 font-medium text-rose-200 hover:bg-rose-500/25">
            Шалтгаан: {WHYS.find((w) => w[0] === m.why)?.[1]}
          </button>
        ) : (
          <button type="button" onClick={() => setPicking(true)} className="rounded-full px-2.5 py-1 font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
            Яагаад алдсан бэ?
          </button>
        )}
        {!editing && !m.note && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <NotebookPen size={13} /> Тэмдэглэл нэмэх
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
            rows={2}
            autoFocus
            aria-label="Миний тэмдэглэл"
            placeholder="Жишээ нь: язгуурын доорх илэрхийлэл ≥ 0 байх ёстой"
            className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={save} className="rounded-full bg-blue-500 px-4 py-1.5 font-semibold text-black hover:bg-blue-400">
              Хадгалах
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setText(m.note ?? '');
              }}
              className="rounded-full px-3 py-1.5 text-neutral-400 hover:bg-neutral-800"
            >
              Болих
            </button>
            <span className="ml-auto text-xs tabular-nums text-neutral-500">
              {text.length}/{NOTE_MAX}
            </span>
          </div>
        </div>
      ) : m.note ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-50 hover:bg-amber-500/15"
          title="Тэмдэглэлээ засах"
        >
          <NotebookPen size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{m.note}</span>
        </button>
      ) : null}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
