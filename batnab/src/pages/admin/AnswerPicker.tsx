import {Check} from 'lucide-react';
import {LETTER_CODES, LETTER_LABELS, normalize, type Problem} from '../../lib/topics';
import {field} from './MathField';

/** The right answer: the А–Д letters (a second tap clears it) or the written answer; and which of the two it is. */
export default function AnswerPicker({p, answer, onAnswer, onKind}: {p: Problem; answer: string; onAnswer: (a: string) => void; onKind: (k: Problem['kind']) => void}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {p.kind === 'choice' ? (
        <div className="flex gap-1.5" role="group" aria-label="Зөв хариулт">
          {LETTER_CODES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onAnswer(answer === l ? '' : l)}
              aria-pressed={answer === l}
              aria-label={`${LETTER_LABELS[l]} зөв хариулт`}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${answer === l ? 'bg-green-500 text-black' : 'bg-neutral-800 hover:bg-neutral-700'}`}
            >
              {answer === l ? <Check size={17} /> : LETTER_LABELS[l]}
            </button>
          ))}
        </div>
      ) : (
        <input value={answer} maxLength={40} onChange={(e) => onAnswer(normalize(e.target.value))} placeholder="Зөв хариулт: 12, -3.5, 2/3" aria-label="Зөв хариулт" className={`${field} w-48 py-2 text-sm`} />
      )}
      <div className="flex rounded-full bg-neutral-800 p-0.5 text-xs" role="radiogroup" aria-label="Хариултын төрөл">
        {(
          [
            ['choice', 'А–Д сонголт'],
            ['answer', 'Хариулт бичих'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={p.kind === k} onClick={() => onKind(k)} className={`rounded-full px-2.5 py-1 font-medium ${p.kind === k ? 'bg-neutral-600 text-white' : 'text-neutral-400'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
