import {useState} from 'react';
import Sheet from '../../components/Sheet';
import {LETTER_CODES, LETTER_LABELS, normalize, type Letter, type Problem} from '../../lib/topics';
import {field} from './MathField';

const LETTERS = 'АБВГД';
const LATIN = 'ABCDE';
const letterOf = (ch: string): Letter | null => {
  const k = LETTERS.indexOf(ch.toUpperCase());
  if (k >= 0) return LETTER_CODES[k];
  const j = LATIN.indexOf(ch.toUpperCase());
  return j >= 0 ? LETTER_CODES[j] : null;
};
const ONE_LETTER = /^[АБВГДабвгдA-Ea-e]$/;

/**
 * The answers typed at once, as in a book's answer key: in order ("ВДВГД…", "В Д - Г", "-" or "?" skips one) or
 * numbered ("1В 2Д 3-А", "18. В 19) Д"; `first` is the number of the topic's first problem). Each problem's answer:
 * a letter for an А–Д problem, the written answer for one to write.
 */
export function parseAnswers(text: string, problems: Problem[], first: number) {
  const found: Record<string, string> = {};
  const wrong: string[] = [];
  const put = (k: number, v: string, label: string) => {
    const p = problems[k];
    if (!p) return wrong.push(`${label}: ийм бодлого алга`);
    const letter = ONE_LETTER.test(v) ? letterOf(v) : null;
    if (p.kind === 'choice') {
      if (letter) found[p.id] = letter;
      else wrong.push(`${label}: А–Д үсэг байх ёстой («${v}»)`);
    } else if (letter && !/^[a-e]$/i.test(v)) wrong.push(`${label}: хариулт бичих бодлого («${v}»)`);
    else found[p.id] = normalize(v);
  };
  const numbered = [...text.matchAll(/(\d{1,3})\s*(?:[.):–-]\s*([^\s,;]+)|([АБВГДабвгдA-Ea-e])(?!\p{L}))/gu)];
  if (numbered.length) {
    for (const m of numbered) put(Number(m[1]) - first, m[2] ?? m[3], `${m[1]}`);
    return {found, wrong};
  }
  let k = 0;
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    // Letters run together ("ВДВГД-АБ"): one problem each, "-" skipping one.
    if (/^[АБВГДабвгд\-_?]+$/.test(token) || /^[A-Ea-e\-_?]+$/.test(token))
      for (const ch of token) {
        if (!/[-_?]/.test(ch)) put(k, ch, `${first + k}`);
        k++;
      }
    else put(k, token, `${first + k++}`);
  }
  return {found, wrong};
}

/** "Хариултуудыг нэг дор": many problems' right answers typed at once. */
export default function BulkAnswers({problems, answers, onApply, onClose}: {problems: Problem[]; answers: Record<string, string>; onApply: (found: Record<string, string>) => void; onClose: () => void}) {
  const [text, setText] = useState('');
  const [first, setFirst] = useState(1);
  const {found, wrong} = parseAnswers(text, problems, first);
  const count = Object.keys(found).length;
  const shown = (p: Problem) => {
    const a = found[p.id] ?? answers[p.id];
    return a ? (p.kind === 'choice' ? LETTER_LABELS[a as Letter] ?? a : a) : '—';
  };
  return (
    <Sheet title="Хариултуудыг нэг дор" sub="Номын хариултын түлхүүрийг хуулж эсвэл бичээд бүх бодлогод нэг дор оноох." onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            autoFocus
            aria-label="Хариултууд"
            placeholder={'Дарааллаар: ВДВГДАБ…\nЭсвэл дугаартай: 1В 2Д 3А, 4. Г, 5) 12'}
            className={`${field} resize-y font-mono text-sm`}
          />
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            Эхний бодлогын дугаар
            <input type="number" min={1} max={999} value={first} onChange={(e) => setFirst(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} className={`${field} w-24 py-1.5`} />
          </label>
          <p className="text-xs text-neutral-500">
            Номын 18-аас эхэлсэн хуудсыг нэмсэн бол 18 гэж бичнэ: «18В» нь 1-р бодлого болно. «-» эсвэл «?» нэг бодлогыг алгасна. А–Д бодлогод үсэг, бичих бодлогод хариултыг бичнэ.
          </p>
          {wrong.length > 0 && (
            <ul className="space-y-0.5 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">
              {wrong.slice(0, 8).map((w) => (
                <li key={w}>{w}</li>
              ))}
              {wrong.length > 8 && <li>… бас {wrong.length - 8}</li>}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm text-neutral-400">Ингэж онооно:</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
            {problems.map((p, i) => (
              <div key={p.id} className={`rounded-lg px-2 py-1.5 text-center text-sm ${found[p.id] ? 'bg-green-500/15 text-green-200 ring-1 ring-green-500/40' : 'bg-neutral-800/60 text-neutral-400'}`}>
                <span className="block text-[10px] text-neutral-500">
                  {i + 1}
                  {first !== 1 && ` (${i + first})`}
                </span>
                <span className="font-semibold">{shown(p)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700">
          Болих
        </button>
        <button
          onClick={() => {
            onApply(found);
            onClose();
          }}
          disabled={!count}
          className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
        >
          {count} хариулт оноох
        </button>
      </div>
    </Sheet>
  );
}
