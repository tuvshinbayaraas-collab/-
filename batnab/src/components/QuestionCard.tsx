import {CheckCircle2, XCircle} from 'lucide-react';
import type {ReactNode} from 'react';
import {LETTERS, type Question} from '../tests/types';
import MathText from './MathText';

/**
 * One question with its five choices.
 * - taking a test: `onChoose` set, `checked` false;
 * - checking: `checked` true, `correct` is the key's choice (null when the teacher hasn't set it). Students only see
 *   whether their own choice was right; the right choice itself is shown only with `reveal` (the teacher);
 * - entering the key: `keyMode`, `chosen` is the key's choice.
 */
export default function QuestionCard(props: {
  num: number;
  q: Question;
  chosen: number | null;
  checked?: boolean;
  correct?: number | null;
  reveal?: boolean;
  keyMode?: boolean;
  onChoose?: (ci: number) => void;
  id?: string;
  /** Shown at the bottom of the card (e.g. "Багшаас асуух"). */
  footer?: ReactNode;
}) {
  const {num, q, chosen, checked, correct = null, reveal, keyMode, onChoose, id, footer} = props;
  const graded = checked && correct !== null;
  const right = graded && chosen === correct;
  const figures = q.c.some((c) => typeof c !== 'string');
  const render = (c: string | ReactNode) => (typeof c === 'string' ? <MathText text={c} display /> : c);

  return (
    <li id={id} className={`scroll-mt-36 rounded-2xl bg-neutral-900 p-4 sm:p-5 ${graded && !right ? 'ring-1 ring-red-500/40' : ''}`}>
      <div className="flex gap-2 leading-relaxed">
        <span className="shrink-0 font-bold">{num}.</span>
        <MathText text={q.q} className="min-w-0 [overflow-wrap:anywhere]" />
      </div>
      {q.fig && <div className="mt-3 flex justify-center text-neutral-200">{q.fig}</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {q.c.map((c, ci) => {
          const picked = chosen === ci;
          let style = picked ? 'border-blue-500 bg-blue-500/15' : 'border-neutral-700 hover:border-neutral-500';
          let badge = picked ? 'bg-blue-500 text-black' : 'bg-neutral-800';
          if (keyMode && picked) {
            style = 'border-green-500 bg-green-500/15';
            badge = 'bg-green-500 text-black';
          } else if (graded && reveal) {
            if (ci === correct) style = 'border-green-500 bg-green-500/15';
            else if (picked) style = 'border-red-500 bg-red-500/15';
            else style = 'border-neutral-800 opacity-70';
          } else if (graded && picked) {
            style = right ? 'border-green-500 bg-green-500/15' : 'border-red-500 bg-red-500/15';
            badge = right ? 'bg-green-500 text-black' : 'bg-red-500 text-black';
          } else if (checked && !picked) style = 'border-neutral-800 opacity-70';
          return (
            <button
              key={ci}
              onClick={() => onChoose?.(ci)}
              disabled={!onChoose}
              aria-pressed={picked}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${figures ? 'flex-[1_1_9rem] flex-col' : 'min-w-[5.5rem] flex-[1_1_auto]'} ${style}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>{LETTERS[ci]}</span>
              <span className="whitespace-nowrap">{render(c)}</span>
            </button>
          );
        })}
      </div>
      {graded && !right && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {chosen === null ? (
            <span className="text-neutral-400">Хариулаагүй.</span>
          ) : reveal ? (
            <>
              <XCircle size={16} className="text-red-400" /> Таны хариулт: {LETTERS[chosen]}.
            </>
          ) : (
            <>
              <XCircle size={16} className="text-red-400" /> <span className="text-red-300">Энэ бодлого дээр алдсан.</span>
            </>
          )}
          {reveal && <span className="text-green-400">Зөв хариулт: {LETTERS[correct!]}</span>}
        </p>
      )}
      {right && (
        <p className="mt-3 flex items-center gap-2 text-sm text-green-400">
          <CheckCircle2 size={16} /> Зөв
        </p>
      )}
      {checked && correct === null && <p className="mt-3 text-sm text-neutral-500">Энэ бодлогын зөв хариултыг багш оруулаагүй байна.</p>}
      {footer && <div className="mt-3 flex justify-end border-t border-neutral-800 pt-2">{footer}</div>}
    </li>
  );
}
