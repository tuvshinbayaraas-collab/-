import {useRef, useState} from 'react';
import {Plot} from '../components/figures';
import MathText from '../components/MathText';
import {newRound, say, tex, valueAt, type Curve, type Round} from './graphs';
import type {Play} from './Shell';

const TICKS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
const labels = TICKS.map((v): [number, string] => [v, v % 2 ? '' : String(v)]);

/**
 * «График таах»: a graph and four equations; the one it is of scores a point and the next graph comes, another loses
 * 5 seconds and shows which it was. Lines first, then parabolas, then |x| among them.
 */
export default function GraphGuess({play}: {play: Play}) {
  const [n, setN] = useState(0);
  const [round, setRound] = useState<Round>(() => newRound(0));
  const [picked, setPicked] = useState<Curve | null>(null);
  const busy = useRef(false);

  const choose = (c: Curve) => {
    if (busy.current) return;
    busy.current = true;
    setPicked(c);
    const good = c === round.curve;
    if (good) play.add(1);
    else play.penalty(5);
    setTimeout(
      () => {
        setN((x) => x + 1);
        setRound(newRound(n + 1));
        setPicked(null);
        busy.current = false;
      },
      good ? 450 : 1300,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center rounded-2xl bg-neutral-900 p-3 text-neutral-200">
        <Plot x={[-6, 6]} y={[-6, 6]} scale={22} curve={(x) => valueAt(round.curve, x)} xLabels={labels} yLabels={labels} />
      </div>
      <p className="text-center text-sm text-neutral-400">Аль тэгшитгэлийн график вэ?</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Тэгшитгэлүүд">
        {round.choices.map((c, i) => {
          const right = picked && c === round.curve;
          const wrong = picked === c && c !== round.curve;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(c)}
              aria-label={say(c)}
              className={`flex min-h-16 items-center justify-center rounded-xl px-2 py-3 text-lg transition ${
                right ? 'bg-green-500/25 ring-2 ring-green-400' : wrong ? 'bg-red-500/25 ring-2 ring-red-400' : 'bg-neutral-800 hover:bg-neutral-700'
              }`}
              data-choice
            >
              <MathText text={tex(c)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
