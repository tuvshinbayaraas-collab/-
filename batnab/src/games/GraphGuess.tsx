import {useRef, useState} from 'react';
import {Plot} from '../components/figures';
import MathText from '../components/MathText';
import {climb, ladder} from './adapt';
import {levelOfRound, newRound, say, STAGE, tex, valueAt, whyNot, type Curve, type Round} from './graphs';
import type {Play} from './Shell';

const TICKS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
const labels = TICKS.map((v): [number, string] => [v, v % 2 ? '' : String(v)]);

/** The graph of a curve, at a size (the game's, or a small one for the review). */
const Graph = ({c, scale = 22}: {c: Curve; scale?: number}) => <Plot x={[-6, 6]} y={[-6, 6]} scale={scale} curve={(x) => valueAt(c, x)} xLabels={labels} yLabels={labels} />;

/**
 * «График таах»: a graph and four equations; the one it is of scores its stage (1 a line … 5 sin, cos) and the next graph
 * comes, another loses 5 seconds and shows which it was. The stage climbs and falls with the answers.
 */
export default function GraphGuess({play}: {play: Play}) {
  const daily = !!play.rngAt;
  const [n, setN] = useState(0);
  const [lad, setLad] = useState(() => ladder(play.start));
  const [round, setRound] = useState<Round>(() => newRound(daily ? levelOfRound(0) : play.start, play.rngAt?.(0)));
  const [picked, setPicked] = useState<Curve | null>(null);
  const busy = useRef(false);

  const choose = (c: Curve) => {
    if (busy.current) return;
    busy.current = true;
    setPicked(c);
    const good = c === round.curve;
    if (good) play.add(STAGE[round.curve.kind]);
    else {
      play.penalty(5);
      play.miss({q: 'Аль тэгшитгэлийн график вэ?', your: tex(c), right: tex(round.curve), why: whyNot(round.curve, c), fig: <Graph c={round.curve} scale={11} />});
    }
    const next = climb(lad, good);
    play.reached(next.top);
    const k = n + 1;
    setTimeout(
      () => {
        setN(k);
        setLad(next);
        setRound(newRound(daily ? levelOfRound(k) : next.level, play.rngAt?.(k)));
        setPicked(null);
        busy.current = false;
      },
      good ? 450 : 1300,
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-neutral-500">{STAGE[round.curve.kind]}-р түвшин</p>
      <div className="flex justify-center rounded-2xl bg-neutral-900 p-3 text-neutral-200">
        <Graph c={round.curve} />
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
