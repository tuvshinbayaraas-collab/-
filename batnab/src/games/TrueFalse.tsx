import {Check, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import MathText from '../components/MathText';
import {climb, ladder} from './adapt';
import type {Play} from './Shell';
import {bonus, claimAt, levelAt, type Claim} from './truefalse';

/**
 * «Зөв үү, буруу юу?»: a statement, «Зөв» or «Буруу» (or ← and → on a keyboard). A right answer scores the level the
 * statement came from, double from five right in a row; a wrong one ends the run, takes 2 seconds off and shows the
 * statement as it should be. The level climbs and falls with the answers (in the day's challenge it goes by count).
 */
export default function TrueFalse({play}: {play: Play}) {
  const daily = !!play.rngAt;
  const [n, setN] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lad, setLad] = useState(() => ladder(play.start));
  const [cur, setCur] = useState<{claim: Claim; level: number}>(() => {
    const level = daily ? levelAt(0) : play.start;
    return {claim: claimAt(level, undefined, play.rngAt?.(0)), level};
  });
  const [shown, setShown] = useState<{good: boolean} | null>(null);
  const busy = useRef(false);

  const answer = (says: boolean) => {
    if (busy.current) return;
    busy.current = true;
    const {claim} = cur;
    const good = says === claim.truth;
    setShown({good});
    if (good) play.add(cur.level * bonus(streak));
    else {
      play.penalty(2);
      play.miss({q: claim.tex, your: says ? 'Зөв' : 'Буруу', right: claim.truth ? 'Зөв' : `Буруу. Зөв нь ${claim.right}`, why: claim.why});
    }
    const next = climb(lad, good);
    play.reached(next.top);
    const k = n + 1;
    setTimeout(
      () => {
        setStreak(good ? streak + 1 : 0);
        setN(k);
        setLad(next);
        const level = daily ? levelAt(k) : next.level;
        setCur((c) => ({claim: claimAt(level, c.claim.tex, play.rngAt?.(k)), level}));
        setShown(null);
        busy.current = false;
      },
      good ? 300 : 1400,
    );
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answerRef.current(false);
      else if (e.key === 'ArrowRight') answerRef.current(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl p-6 text-center transition-colors ${shown ? (shown.good ? 'bg-green-500/15' : 'bg-red-500/15') : 'bg-neutral-900'}`} aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {cur.level}-р түвшин · Дараалан зөв: {streak}
          {bonus(streak) > 1 && <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-px text-amber-200">×2</span>}
        </p>
        <div className="mt-3 flex min-h-20 items-center justify-center text-3xl" data-claim>
          <MathText text={cur.claim.tex} />
        </div>
        {shown && !shown.good && (
          <p className="mt-2 text-sm text-neutral-300">
            {cur.claim.truth ? 'Энэ зөв байсан.' : 'Зөв нь:'} {!cur.claim.truth && <MathText text={cur.claim.right} />}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => answer(false)} className="flex h-20 items-center justify-center gap-2 rounded-2xl bg-red-500/15 text-xl font-bold text-red-200 hover:bg-red-500/25">
          <X size={26} /> Буруу
        </button>
        <button type="button" onClick={() => answer(true)} className="flex h-20 items-center justify-center gap-2 rounded-2xl bg-green-500/15 text-xl font-bold text-green-200 hover:bg-green-500/25">
          <Check size={26} /> Зөв
        </button>
      </div>
      <p className="hidden text-center text-xs text-neutral-500 sm:block">Гараар: ← Буруу · Зөв →</p>
    </div>
  );
}
