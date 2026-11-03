import {Lightbulb, ListOrdered, RotateCcw} from 'lucide-react';
import type {ReactNode} from 'react';
import MathText from './MathText';

/** Help after a wrong answer, a step at a time: a hint, then the steps, and a try again. */
export default function HelpLadder({hint, steps, help, setHelp, onRetry, last}: {hint?: string; steps?: string[]; help: number; setHelp: (n: number) => void; onRetry: () => void; last?: ReactNode}) {
  return (
    <div className="space-y-2 rounded-xl bg-neutral-800/50 p-3" aria-label="Тусламж">
      {help >= 1 && hint && (
        <p className="flex gap-2 text-sm text-amber-100">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <MathText text={hint} className="min-w-0 [overflow-wrap:anywhere]" />
        </p>
      )}
      {help >= 2 && steps && (
        <ol className="list-decimal space-y-1 pl-9 text-sm text-neutral-200 marker:text-neutral-500">
          {steps.map((s, i) => (
            <li key={i}>
              <MathText text={s} />
            </li>
          ))}
        </ol>
      )}
      {help >= 2 && last}
      <div className="flex flex-wrap gap-2">
        {help === 0 && hint && (
          <button type="button" onClick={() => setHelp(1)} className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3.5 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-500/25">
            <Lightbulb size={15} /> Сануулга
          </button>
        )}
        {help < 2 && (steps?.length || last) && (help >= 1 || !hint) && (
          <button type="button" onClick={() => setHelp(2)} className="flex items-center gap-1.5 rounded-full bg-neutral-700/70 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700">
            <ListOrdered size={15} /> Бодолтын алхам
          </button>
        )}
        <button type="button" onClick={onRetry} className="flex items-center gap-1.5 rounded-full bg-neutral-700/70 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700">
          <RotateCcw size={15} /> Дахин оролдох
        </button>
      </div>
      {help === 0 && <p className="text-xs text-neutral-500">Эхлээд сануулгаар өөрөө дахин оролдоорой. Дахин оролдлого тоологдохгүй.</p>}
    </div>
  );
}
