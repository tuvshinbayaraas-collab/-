import {Check, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import MathText from '../components/MathText';
import type {Play} from './Shell';
import {multiplier, nextClaim, type Claim} from './truefalse';

/**
 * «Зөв үү, буруу юу?»: a statement, «Зөв» or «Буруу» (or ← and → on a keyboard). Right in a row, each scores more (×1 to
 * ×5); a wrong answer ends the run of them, takes 2 seconds off and shows the statement as it should be.
 */
export default function TrueFalse({play}: {play: Play}) {
  const [n, setN] = useState(0);
  const [streak, setStreak] = useState(0);
  const [claim, setClaim] = useState<Claim>(() => nextClaim(0));
  const [shown, setShown] = useState<{good: boolean} | null>(null);
  const busy = useRef(false);

  const answer = (says: boolean) => {
    if (busy.current) return;
    busy.current = true;
    const good = says === claim.truth;
    setShown({good});
    if (good) play.add(multiplier(streak));
    else play.penalty(2);
    const nextStreak = good ? streak + 1 : 0;
    setTimeout(
      () => {
        setStreak(nextStreak);
        setN((x) => x + 1);
        setClaim((c) => nextClaim(n + 1, c.tex));
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
          Дараалан зөв: {streak} · ×{multiplier(streak)}
        </p>
        <div className="mt-3 flex min-h-20 items-center justify-center text-3xl" data-claim>
          <MathText text={claim.tex} />
        </div>
        {shown && !shown.good && (
          <p className="mt-2 text-sm text-neutral-300">
            {claim.truth ? 'Энэ зөв байсан.' : 'Зөв нь:'} {!claim.truth && <MathText text={claim.right} />}
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
