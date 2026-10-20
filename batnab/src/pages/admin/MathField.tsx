import {Sigma} from 'lucide-react';
import {useRef, useState, type ClipboardEvent} from 'react';
import {Rich} from '../../components/TopicParts';
import {imageFile} from '../../lib/photo';

export const field = 'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500';

/** Formula pieces: `#` marks where to type next (the selected text goes in the first one). */
const PIECES: {label: string; tex: string; title: string}[] = [
  {label: 'a⁄b', tex: '\\frac{#}{#}', title: 'Бутархай'},
  {label: 'xⁿ', tex: '^{#}', title: 'Зэрэг'},
  {label: 'xₙ', tex: '_{#}', title: 'Доод индекс'},
  {label: '√', tex: '\\sqrt{#}', title: 'Квадрат язгуур'},
  {label: 'ⁿ√', tex: '\\sqrt[#]{#}', title: 'n зэргийн язгуур'},
  {label: 'log', tex: '\\log_{#} #', title: 'Логарифм'},
  {label: 'sin', tex: '\\sin #', title: 'Синус'},
  {label: 'cos', tex: '\\cos #', title: 'Косинус'},
  {label: 'tg', tex: '\\operatorname{tg} #', title: 'Тангенс'},
  {label: 'lim', tex: '\\lim_{n \\to \\infty} #', title: 'Хязгаар'},
  {label: '∫', tex: '\\int_{#}^{#} # \\, dx', title: 'Интеграл'},
  {label: '{', tex: '\\begin{cases} # \\\\ # \\end{cases}', title: 'Систем'},
  {label: '|x|', tex: '|#|', title: 'Модуль'},
  {label: 'π', tex: '\\pi', title: 'Пи'},
  {label: '∞', tex: '\\infty', title: 'Төгсгөлгүй'},
  {label: '°', tex: '^\\circ', title: 'Градус'},
  {label: '≤', tex: '\\le', title: 'Бага буюу тэнцүү'},
  {label: '≥', tex: '\\ge', title: 'Их буюу тэнцүү'},
  {label: '≠', tex: '\\ne', title: 'Тэнцүү биш'},
  {label: '±', tex: '\\pm', title: 'Нэмэх хасах'},
  {label: '·', tex: '\\cdot', title: 'Үржих'},
  {label: '∠', tex: '\\angle', title: 'Өнцөг'},
  {label: '△', tex: '\\triangle', title: 'Гурвалжин'},
  {label: 'α', tex: '\\alpha', title: 'Альфа'},
];

const OPEN_KEY = 'batnab:formulaBar';
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
};

/** Whether the caret is inside $…$ (an odd number of unescaped $ before it). */
const inMath = (text: string) => (text.replace(/\\\$/g, '').split('$').length & 1) === 0;

/**
 * A text box for text with $math$: formula buttons put the piece at the caret (inside $…$ when it isn't already),
 * and it shows how it will look. A pasted picture goes to `onImage`.
 */
export function MathArea({value, onChange, rows = 3, max, placeholder, onImage, label}: {value: string; onChange: (v: string) => void; rows?: number; max: number; placeholder: string; onImage?: (f: File) => void; label?: string}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(readOpen);
  const paste = (e: ClipboardEvent) => {
    const f = onImage && imageFile(e.clipboardData?.items, e.clipboardData?.files);
    if (!f) return;
    e.preventDefault();
    onImage!(f);
  };
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? '0' : '1');
    } catch {
      // private window: it just won't be remembered
    }
  };
  const put = (tex: string) => {
    const el = area.current;
    const from = el?.selectionStart ?? value.length;
    const to = el?.selectionEnd ?? value.length;
    const before = value.slice(0, from);
    const picked = value.slice(from, to);
    const wrap = inMath(before) ? '' : '$';
    const [first, ...rest] = tex.split('#');
    const piece = first + (rest.length ? picked + rest.join('') : '');
    // The caret goes to the first place to type: after the picked text, in the next place.
    const slot = rest.length ? first.length + picked.length + (picked && rest.length > 1 ? rest[0].length : 0) : piece.length;
    const next = before + wrap + piece + wrap + value.slice(to);
    if (next.length > max) return;
    onChange(next);
    const caret = before.length + wrap.length + slot;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(caret, caret);
    });
  };
  return (
    <div>
      <textarea ref={area} value={value} maxLength={max} rows={rows} onChange={(e) => onChange(e.target.value)} onPaste={paste} placeholder={placeholder} aria-label={label} className={`${field} resize-y`} />
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <button type="button" onClick={toggle} aria-expanded={open} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${open ? 'bg-blue-500/15 text-blue-200' : 'text-neutral-400 hover:bg-neutral-800'}`}>
          <Sigma size={13} /> Томьёо
        </button>
        {open &&
          PIECES.map((p) => (
            <button
              key={p.label}
              type="button"
              title={p.title}
              aria-label={p.title}
              // Keeps the caret (and the picked text) in the box.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => put(p.tex)}
              className="min-w-8 rounded-lg bg-neutral-800 px-2 py-1 font-serif text-sm text-neutral-100 hover:bg-neutral-700"
            >
              {p.label}
            </button>
          ))}
      </div>
      {value.includes('$') && (
        <div className="mt-2 rounded-xl border border-dashed border-neutral-700 p-3">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-neutral-500">Ингэж харагдана</p>
          <Rich text={value} className="text-sm" />
        </div>
      )}
    </div>
  );
}
