import {ChevronDown} from 'lucide-react';
import type {ReactNode} from 'react';

/**
 * A poll result's top on the teacher's page: the question, what it is, how many answered; the whole of it a button that
 * folds the result away (on this device), the question then on one line.
 */
export default function PollHead({folded, onFold, q, meta, answered, total}: {folded: boolean; onFold: () => void; q: string; meta: ReactNode; answered: ReactNode; total: number}) {
  return (
    <button type="button" onClick={onFold} aria-expanded={!folded} className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 text-left">
      <span className="block min-w-[12rem] flex-1">
        <span className={`block whitespace-pre-wrap font-medium break-words ${folded ? 'line-clamp-1' : ''}`}>{q}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{meta}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-start gap-1.5">
        <span className="w-20 text-right">
          <span className="block text-sm font-semibold tabular-nums">
            {answered}/{total}
          </span>
          <span className="block text-[11px] text-neutral-500">хариулсан</span>
        </span>
        <ChevronDown size={18} aria-hidden className={`mt-0.5 shrink-0 text-neutral-500 transition-transform ${folded ? '' : 'rotate-180'}`} />
      </span>
    </button>
  );
}
