import {Delete} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import type {Play} from './Shell';
import {levelAfter, nextSum, type Sum} from './sprint';

/**
 * «Хурдан тооцоо»: a sum, typed on the keypad (or the keyboard) and sent with OK. Right: its level in points and the next
 * one, harder as more are right; wrong: 3 seconds off and the right answer shown a moment.
 */
export default function Sprint({play}: {play: Play}) {
  const [right, setRight] = useState(0);
  const [sum, setSum] = useState<Sum>(() => nextSum(1));
  const [typed, setTyped] = useState('');
  const [shown, setShown] = useState<{answer: number; good: boolean} | null>(null);
  const busy = useRef(false);

  const send = () => {
    if (busy.current || typed === '' || typed === '-') return;
    const good = Number(typed) === sum.answer;
    busy.current = true;
    setShown({answer: sum.answer, good});
    if (good) play.add(sum.level);
    else play.penalty(3);
    const n = good ? right + 1 : right;
    setTimeout(
      () => {
        setRight(n);
        setSum((s) => nextSum(levelAfter(n), s.text));
        setTyped('');
        setShown(null);
        busy.current = false;
      },
      good ? 250 : 900,
    );
  };
  const key = (k: string) => {
    if (busy.current) return;
    if (k === '⌫') return setTyped((t) => t.slice(0, -1));
    if (k === '−') return setTyped((t) => (t.startsWith('-') ? t.slice(1) : `-${t}`));
    setTyped((t) => (t.replace('-', '').length >= 6 ? t : t + k));
  };
  // The keyboard too, on a computer.
  const sendRef = useRef(send);
  sendRef.current = send;
  const keyRef = useRef(key);
  keyRef.current = key;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) keyRef.current(e.key);
      else if (e.key === '-' || e.key === '−') keyRef.current('−');
      else if (e.key === 'Backspace') keyRef.current('⌫');
      else if (e.key === 'Enter') sendRef.current();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl p-5 text-center transition-colors ${shown ? (shown.good ? 'bg-green-500/15' : 'bg-red-500/15') : 'bg-neutral-900'}`}
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{sum.level}-р түвшин</p>
        <p className="mt-1 break-words text-3xl font-bold sm:text-4xl" data-sum>
          {sum.text}
        </p>
        <p className={`mt-3 min-h-12 text-4xl font-extrabold tabular-nums ${shown && !shown.good ? 'text-red-300' : ''}`} data-typed>
          {shown && !shown.good ? (
            <>
              <span className="line-through opacity-60">{typed.replace('-', '−')}</span> <span className="text-green-300">{String(shown.answer).replace('-', '−')}</span>
            </>
          ) : (
            typed.replace('-', '−') || <span className="text-neutral-600">?</span>
          )}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Тоо бичих">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3', '−', '0', '⌫'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => key(k)}
            aria-label={k === '⌫' ? 'Арилгах' : k === '−' ? 'Хасах тэмдэг' : k}
            className="flex h-14 items-center justify-center rounded-xl bg-neutral-800 text-2xl font-semibold hover:bg-neutral-700 active:scale-95"
          >
            {k === '⌫' ? <Delete size={22} /> : k}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={send}
        disabled={typed === '' || typed === '-'}
        className="h-14 w-full rounded-xl bg-blue-500 text-lg font-bold text-black hover:bg-blue-400 disabled:opacity-50"
      >
        OK
      </button>
    </div>
  );
}
