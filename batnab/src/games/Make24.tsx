import {RotateCcw, SkipForward, Undo2} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {climb, ladder} from './adapt';
import {apply, grade, isQ, levelOfSet, newPuzzle, OPS, q, show, solve, type Op, type Q} from './make24';
import type {Play} from './Shell';

interface Card {
  id: number;
  v: Q;
}

const GRADE = ['', 'Хөнгөн', 'Дунд', 'Хүнд'];
/** A way to 24 for the review: «8 ÷ 2 = 4, 4 × 6 = 24». */
const wayFor = (xs: number[]) => (solve(xs.map((n) => q(n))) ?? []).join(', ');

/**
 * «24 тоглоом»: four cards. Tap one, an operation, then another: the two become one card with the result. One card left
 * at 24 solves it (its grade in points: 1 easy, 2 middling, 3 hard, and the next four); not 24, they shake and come
 * back. «Буцаах» takes the last step back, «Дахин» starts the four again, «Алгасах» gives new ones for 10 seconds and
 * puts the four, with a way, into the review. The grade climbs and falls with the sets solved and skipped.
 */
export default function Make24({play}: {play: Play}) {
  const daily = !!play.rngAt;
  const nextId = useRef(0);
  const deal = (xs: number[]): Card[] => xs.map((n) => ({id: nextId.current++, v: q(n)}));
  const [k, setK] = useState(0);
  const [lad, setLad] = useState(() => ladder(play.start, 3));
  const [nums, setNums] = useState(() => newPuzzle(daily ? levelOfSet(0) : Math.min(3, play.start), undefined, play.rngAt?.(0)));
  const [cards, setCards] = useState<Card[]>(() => deal(nums));
  const [history, setHistory] = useState<Card[][]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [state, setState] = useState<'' | 'won' | 'wrong'>('');
  const [solved, setSolved] = useState(0);
  const g = grade(nums);
  // The four on the table when the time runs out go into the review with a way.
  const open = useRef(nums);
  open.current = state === 'won' ? [] : nums;
  useEffect(() => {
    play.onEnd(() => {
      if (open.current.length) play.miss({q: `Сүүлийн тоонууд: ${open.current.join(', ')}`, right: wayFor(open.current)});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fresh = (xs: number[]) => {
    setNums(xs);
    setCards(deal(xs));
    setHistory([]);
    setSel(null);
    setOp(null);
    setState('');
  };
  /** The next four, at the ladder's grade (or the day's), after one solved (`good`) or skipped. */
  const following = (good: boolean) => {
    const next = climb(lad, good);
    play.reached(next.top);
    setLad(next);
    const i = k + 1;
    setK(i);
    return newPuzzle(daily ? levelOfSet(i) : next.level, nums, play.rngAt?.(i));
  };
  const tap = (c: Card) => {
    if (state) return;
    // The card picked again: put down (and its operation with it).
    if (c.id === sel) {
      setSel(null);
      setOp(null);
      return;
    }
    if (sel === null || op === null) return setSel(c.id);
    const a = cards.find((x) => x.id === sel)!;
    const r = apply(a.v, op, c.v);
    if (!r) return setOp(null);
    const next = cards.filter((x) => x.id !== sel).map((x) => (x.id === c.id ? {id: nextId.current++, v: r} : x));
    setHistory((h) => [...h, cards]);
    setCards(next);
    setOp(null);
    if (next.length > 1) return setSel(next.find((x) => x.v === r)!.id);
    setSel(null);
    if (isQ(r, 24)) {
      setState('won');
      play.add(g);
      setSolved((n) => n + 1);
      const xs = following(true);
      setTimeout(() => fresh(xs), 900);
    } else {
      setState('wrong');
      setTimeout(() => {
        setCards(deal(nums));
        setHistory([]);
        setState('');
      }, 900);
    }
  };
  const undo = () => {
    if (state || !history.length) return;
    setCards(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setSel(null);
    setOp(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-neutral-400">
        {state === 'won' ? '24 боллоо!' : state === 'wrong' ? '24 болсонгүй. Дахиад оролдоорой.' : sel === null ? 'Тоогоо сонго' : op === null ? 'Үйлдлээ сонго' : 'Нөгөө тоогоо сонго'}
        <span className="ml-2 text-neutral-500">
          · {GRADE[g]}, +{g} · бодсон: {solved}
        </span>
      </p>
      <div className={`grid grid-cols-2 gap-3 ${state === 'wrong' ? 'animate-[shake_.4s_ease-in-out]' : ''}`} role="group" aria-label="Тоонууд">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => tap(c)}
            aria-pressed={sel === c.id}
            className={`flex h-24 items-center justify-center rounded-2xl text-4xl font-extrabold tabular-nums transition ${
              state === 'won' ? 'bg-green-500/25 text-green-200' : sel === c.id ? 'bg-blue-500 text-black ring-4 ring-blue-300/40' : 'bg-neutral-900 hover:bg-neutral-800'
            }`}
            data-card
          >
            {show(c.v)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Үйлдэл">
        {OPS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => sel !== null && !state && setOp(op === o ? null : o)}
            disabled={sel === null || !!state}
            aria-pressed={op === o}
            aria-label={{'+': 'Нэмэх', '−': 'Хасах', '×': 'Үржих', '÷': 'Хуваах'}[o]}
            className={`h-14 rounded-xl text-3xl font-bold disabled:opacity-40 ${op === o ? 'bg-amber-400 text-black' : 'bg-neutral-800 hover:bg-neutral-700'}`}
          >
            {o}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm font-medium">
        <button type="button" onClick={undo} disabled={!history.length || !!state} className="flex items-center justify-center gap-1.5 rounded-full bg-neutral-800 py-2.5 hover:bg-neutral-700 disabled:opacity-40">
          <Undo2 size={16} /> Буцаах
        </button>
        <button type="button" onClick={() => !state && fresh(nums)} className="flex items-center justify-center gap-1.5 rounded-full bg-neutral-800 py-2.5 hover:bg-neutral-700">
          <RotateCcw size={16} /> Дахин
        </button>
        <button
          type="button"
          onClick={() => {
            if (state) return;
            play.penalty(10);
            play.miss({q: `Алгассан тоонууд: ${nums.join(', ')}`, right: wayFor(nums)});
            fresh(following(false));
          }}
          className="flex items-center justify-center gap-1.5 rounded-full bg-neutral-800 py-2.5 hover:bg-neutral-700"
        >
          <SkipForward size={16} /> Алгасах
        </button>
      </div>
    </div>
  );
}
