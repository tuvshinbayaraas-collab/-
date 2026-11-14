import {CheckCircle2, Maximize2, XCircle} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import ZoomView from './ZoomView';
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
  /** Whose the chosen answer is, said with `reveal` ("Таны": one's own; "Сурагчийн": the teacher looking at a student's). */
  whose?: string;
  keyMode?: boolean;
  onChoose?: (ci: number) => void;
  id?: string;
  /** Shown at the bottom of the card (e.g. "Багшаас асуух"). */
  footer?: ReactNode;
  /**
   * The choices in this attempt's own order (`perm[i]`: the book's choice shown i-th, lettered А, Б… by place).
   * `chosen` and `correct` stay the book's.
   */
  perm?: number[];
}) {
  const {num, q, chosen, checked, correct = null, reveal, whose = 'Таны', keyMode, onChoose, id, footer, perm} = props;
  const order = perm && perm.length === q.c.length ? perm : q.c.map((_, i) => i);
  /** The letter a book's choice has on this card. */
  const letterOf = (ci: number) => LETTERS[order.indexOf(ci)];
  const graded = checked && correct !== null;
  const right = graded && chosen === correct;
  const figures = q.c.some((c) => typeof c !== 'string');
  const render = (c: string | ReactNode) => (typeof c === 'string' ? <MathText text={c} display /> : c);
  // A figure (or the choices drawn as graphs) on the whole screen, to read its numbers.
  const [zoom, setZoom] = useState<'fig' | 'choices' | null>(null);

  return (
    <li id={id} className={`scroll-mt-36 rounded-2xl bg-neutral-900 p-4 sm:p-5 ${graded && !right ? 'ring-1 ring-red-500/40' : ''}`}>
      <div className="flex gap-2 leading-relaxed">
        <span className="shrink-0 font-bold">{num}.</span>
        <MathText text={q.q} className="min-w-0 [overflow-wrap:anywhere]" />
      </div>
      {q.fig && (
        // Not a <button>: the card's buttons are its choices (А first).
        <div
          role="button"
          tabIndex={0}
          onClick={() => setZoom('fig')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setZoom('fig'))}
          title="Томруулж харах"
          aria-label="Зургийг томруулж харах"
          className="group relative mx-auto mt-3 flex w-fit max-w-full cursor-zoom-in justify-center rounded-xl p-1 text-neutral-200 outline-none hover:bg-neutral-800/50 focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {q.fig}
          <span aria-hidden className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800/90 text-neutral-300 opacity-70 group-hover:opacity-100">
            <Maximize2 size={14} />
          </span>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {order.map((ci, at) => {
          const c = q.c[ci];
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
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>{LETTERS[at]}</span>
              <span className="whitespace-nowrap">{render(c)}</span>
            </button>
          );
        })}
      </div>
      {figures && (
        <button
          type="button"
          onClick={() => setZoom('choices')}
          className="mt-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <Maximize2 size={13} /> Сонголтуудыг томоор харах
        </button>
      )}
      {zoom && (
        <ZoomView label={zoom === 'fig' ? 'Зураг' : 'Сонголтууд'} onClose={() => setZoom(null)}>
          {zoom === 'fig' ? (
            q.fig
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {order.map((ci, at) => (
                <div key={ci} className="rounded-xl border border-neutral-700 p-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold">{LETTERS[at]}</span>
                  <div className="mt-1 flex justify-center">{render(q.c[ci])}</div>
                </div>
              ))}
            </div>
          )}
        </ZoomView>
      )}
      {graded && !right && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {chosen === null ? (
            <span className="text-neutral-400">Хариулаагүй.</span>
          ) : reveal ? (
            <>
              <XCircle size={16} className="text-red-400" /> {whose} хариулт: {letterOf(chosen)}.
            </>
          ) : (
            <>
              <XCircle size={16} className="text-red-400" /> <span className="text-red-300">Энэ бодлого дээр алдсан.</span>
            </>
          )}
          {reveal && <span className="text-green-400">Зөв хариулт: {letterOf(correct!)}</span>}
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
