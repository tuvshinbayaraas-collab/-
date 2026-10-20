import {Check, X} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import {choiceAt} from '../lib/keys';
import {LAST_BOX, reviewed, type Mistake} from '../lib/mistakes';
import {learnedOne, type Stats} from '../lib/stats';
import {problemNo, type Topic} from '../lib/topics';
import {loadTest, testInfo} from '../tests';
import type {Test} from '../tests/types';
import AskButton from './Ask';
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
 * Looks a notebook problem up by id, falling back to how it was when last seen: one learned (and so deleted) while on
 * screen stays there with its outcome.
 */
export function useLastSeen(mistakes: Mistake[] | null) {
  const [seen, setSeen] = useState<Record<string, Mistake>>({});
  useEffect(() => {
    if (mistakes?.length) setSeen((s) => ({...s, ...Object.fromEntries(mistakes.map((m) => [m.id, m]))}));
  }, [mistakes]);
  return (id: string) => mistakes?.find((m) => m.id === id) ?? seen[id];
}

/** Where a notebook problem came from, for its heading. */
export function mistakeLabel(m: Mistake, topics: Topic[] | null) {
  if (m.s === 't') return `${testInfo(m.t)?.title ?? m.t} · ${Number(m.q) + 1}-р бодлого`;
  const t = topics?.find((x) => x.id === m.t);
  const i = t?.problems.findIndex((p) => p.id === m.q) ?? -1;
  return t && i >= 0 ? `${t.title} · ${problemNo(t.problems[i], i)}-р бодлого` : 'Сэдвийн бодлого';
}

/** Whether the problem a notebook entry points at still exists (a topic or problem may have been deleted). */
export const mistakeExists = (m: Mistake, topics: Topic[]) => m.s === 't' ? !!testInfo(m.t) && Number(m.q) < testInfo(m.t)!.count : !!topics.find((t) => t.id === m.t)?.problems.some((p) => p.id === m.q);

/**
 * One notebook problem solved again: a topic problem shows its answer and solution afterwards; a test question only
 * says right or wrong (tests never show their answers). Either way the notebook moves it on (`onDone`).
 */
export function MistakeItem({m, topics, testKey, stats, onDone}: {m: Mistake; topics: Topic[]; testKey?: string | null; stats: Stats | null; onDone?: (right: boolean, learned: boolean) => void}) {
  const finish = async (right: boolean) => {
    const learned = await reviewed(m, right).catch(() => false);
    if (learned) await learnedOne(stats).catch(() => {});
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
  if (m.s === 'p') {
    const t = topics.find((x) => x.id === m.t);
    const p = t?.problems.find((x) => x.id === m.q);
    if (!t || !p) return null;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-end px-1">{boxes}</div>
        <ol>
          <ProblemView tid={t.id} p={p} num={0} heading={label} review={finish} ask={label} />
        </ol>
      </div>
    );
  }
  return <TestQuestion m={m} label={label} testKey={testKey} boxes={boxes} onAnswered={finish} />;
}

function TestQuestion({m, label, testKey, boxes, onAnswered}: {m: Mistake; label: string; testKey?: string | null; boxes: ReactNode; onAnswered: (right: boolean) => void}) {
  const test = useTest(m.t);
  const [pick, setPick] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const qi = Number(m.q);
  if (test === undefined || testKey === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-neutral-900" />;
  const q = test?.questions[qi];
  if (!q) return null;
  const right = testKey ? choiceAt(testKey, qi) : null;
  const ok = checked && pick === right;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 px-1 text-sm">
        <span className="font-semibold">{label}</span>
        {boxes}
      </div>
      <ol>
        <QuestionCard num={qi + 1} q={q} chosen={pick} checked={checked} correct={right} onChoose={checked ? undefined : (ci) => setPick(pick === ci ? null : ci)} />
      </ol>
      <div className="flex flex-wrap items-center gap-3 px-1 pt-1">
        {!checked ? (
          <button
            disabled={pick === null || right === null}
            onClick={() => {
              setChecked(true);
              onAnswered(pick === right);
            }}
            className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
          >
            Шалгах
          </button>
        ) : (
          <p className={`flex items-center gap-2 font-semibold ${ok ? 'text-green-400' : 'text-red-300'}`}>
            {ok ? <Check size={18} /> : <X size={18} />} {ok ? 'Зөв! Дараа дахин давтана.' : 'Буруу. Маргааш дахин оролдоорой.'}
          </p>
        )}
        {right === null && <span className="text-sm text-neutral-500">Энэ тестийн хариултыг одоо шалгах боломжгүй.</span>}
        <span className="ml-auto">
          <AskButton ctx={{s: 't', t: m.t, q: m.q, label}} />
        </span>
      </div>
    </div>
  );
}
