import {useEffect, useRef, useState} from 'react';
import MathText from '../components/MathText';
import {climb, ladder} from './adapt';
import {itemAt, LETTERS, levelOfItem, type Item} from './ees';
import type {Play} from './Shell';

/**
 * «ЭЕШ сорил»: a problem with five answers А–Д (or the keys 1–5). The right one scores the problem's level; another
 * takes 4 seconds off and shows the right one with the way to it. The level climbs and falls with the answers.
 */
export default function Ees({play}: {play: Play}) {
  const daily = !!play.rngAt;
  const [n, setN] = useState(0);
  const [lad, setLad] = useState(() => ladder(play.start));
  const [it, setIt] = useState<Item>(() => itemAt(daily ? levelOfItem(0) : play.start, undefined, play.rngAt?.(0)));
  const [picked, setPicked] = useState<number | null>(null);
  const busy = useRef(false);

  const choose = (i: number) => {
    if (busy.current) return;
    busy.current = true;
    setPicked(i);
    const good = i === it.right;
    if (good) play.add(it.level);
    else {
      play.penalty(4);
      play.miss({q: it.q, your: `${LETTERS[i]}. ${it.choices[i]}`, right: `${LETTERS[it.right]}. ${it.choices[it.right]}`, why: it.why});
    }
    const next = climb(lad, good);
    play.reached(next.top);
    const k = n + 1;
    setTimeout(
      () => {
        setN(k);
        setLad(next);
        setIt((x) => itemAt(daily ? levelOfItem(k) : next.level, x.q, play.rngAt?.(k)));
        setPicked(null);
        busy.current = false;
      },
      good ? 400 : 1600,
    );
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const i = '12345'.indexOf(e.key);
      if (i < 0 || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      chooseRef.current(i);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-neutral-900 p-5" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{it.level}-р түвшин</p>
        <div className="mt-2 text-lg leading-relaxed" data-ees-q>
          <MathText text={it.q} />
        </div>
      </div>
      <div className="grid gap-2" role="group" aria-label="Хариултууд">
        {it.choices.map((c, i) => {
          const right = picked !== null && i === it.right;
          const wrong = picked === i && i !== it.right;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-left text-lg transition ${
                right ? 'bg-green-500/25 ring-2 ring-green-400' : wrong ? 'bg-red-500/25 ring-2 ring-red-400' : 'bg-neutral-800 hover:bg-neutral-700'
              }`}
              data-ees-choice
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-bold">{LETTERS[i]}</span>
              <MathText text={c} />
            </button>
          );
        })}
      </div>
      {picked !== null && picked !== it.right && (
        <p className="rounded-xl bg-neutral-800/60 px-3 py-2 text-sm text-neutral-300">
          <MathText text={it.why} />
        </p>
      )}
    </div>
  );
}
