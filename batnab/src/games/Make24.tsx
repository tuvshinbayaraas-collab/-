import {RotateCcw, SkipForward, Undo2} from 'lucide-react';
import {useRef, useState} from 'react';
import {apply, isQ, newPuzzle, OPS, q, show, type Op, type Q} from './make24';
import type {Play} from './Shell';

interface Card {
  id: number;
  v: Q;
}

/**
 * «24 тоглоом»: four cards. Tap one, an operation, then another: the two become one card with the result. One card left
 * at 24 solves it (a point, and the next four); not 24, they shake and come back. «Буцаах» takes the last step back,
 * «Дахин» starts the four again, «Алгасах» gives new ones for 10 seconds.
 */
export default function Make24({play}: {play: Play}) {
  const nextId = useRef(0);
  const deal = (xs: number[]): Card[] => xs.map((n) => ({id: nextId.current++, v: q(n)}));
  const [nums, setNums] = useState(() => newPuzzle());
  const [cards, setCards] = useState<Card[]>(() => deal(nums));
  const [history, setHistory] = useState<Card[][]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [state, setState] = useState<'' | 'won' | 'wrong'>('');
  const [solved, setSolved] = useState(0);

  const fresh = (xs: number[]) => {
    setNums(xs);
    setCards(deal(xs));
    setHistory([]);
    setSel(null);
    setOp(null);
    setState('');
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
      play.add(1);
      setSolved((n) => n + 1);
      setTimeout(() => fresh(newPuzzle(nums)), 900);
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
        {state === 'won' ? '24! Гайхалтай.' : state === 'wrong' ? '24 болсонгүй — дахиад оролдоорой.' : sel === null ? 'Тоо сонгоно уу' : op === null ? 'Үйлдэл сонгоно уу' : 'Дараагийн тоог сонгоно уу'}
        <span className="ml-2 text-neutral-500">· бодсон: {solved}</span>
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
            fresh(newPuzzle(nums));
          }}
          className="flex items-center justify-center gap-1.5 rounded-full bg-neutral-800 py-2.5 hover:bg-neutral-700"
        >
          <SkipForward size={16} /> Алгасах
        </button>
      </div>
    </div>
  );
}
