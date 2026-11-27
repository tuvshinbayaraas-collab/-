import type {CSSProperties} from 'react';
import {accentOf, moodOf, titleOf} from '../lib/looks';

/** A name in the colour its owner picked, with their sign after it (lib/looks). */
export function LooksName({name, accent, mood}: {name: string; accent?: string | null; mood?: string | null}) {
  const a = accentOf(accent);
  const sign = moodOf(mood);
  return (
    <>
      <span className={a ? 'accent-name' : undefined} style={a ? ({'--accent': a.color, '--accent-light': a.light} as CSSProperties) : undefined}>
        {name}
      </span>
      {sign && (
        <span className="ml-1.5" aria-hidden>
          {sign}
        </span>
      )}
    </>
  );
}

/** The title under a name: a badge the student earned, as a small chip. */
export function TitleChip({id, className = ''}: {id?: string | null; className?: string}) {
  const t = titleOf(id);
  if (!t) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-200 ${className}`}>
      <span aria-hidden>{t.icon}</span> {t.name}
    </span>
  );
}
