import {FileText} from 'lucide-react';
import {useRef, useState} from 'react';
import Sheet from '../../components/Sheet';
import MathText from '../../components/MathText';
import {Rich} from '../../components/TopicParts';
import {parseProblems, problemWarnings, type TextProblem} from '../../lib/problemText';
import {LETTER_CODES, LETTER_LABELS, problemNo, type Problem} from '../../lib/topics';
import {field} from './MathField';

export interface TextImport {
  problems: TextProblem[];
  /** Fill the topic's problems with the same number (their right answers stay) rather than add them. */
  replace: boolean;
  /** Those problems' pictures go (the text now says what they showed). */
  dropPictures: boolean;
}

const EXAMPLE = `1. $x^2-7x+10=0$ тэгшитгэлийн шийдүүдийг ол.
a) $2;\\ 5$  b) $-2;\\ -5$  c) $2;\\ -5$  d) $-2;\\ 5$  e) $1;\\ 10$

2. Хоёр тооны нийлбэр 10, үржвэр 24 бол эдгээр тоог ол.
а) 3 ба 7
б) 4 ба 6`;

/**
 * "Текстээр оруулах": many problems typed or pasted at once, as a book prints them (lib/problemText), shown as the
 * students will see them before they go in. A problem whose number the topic already has can take its place (its id
 * and right answer stay; its picture can go); the others are added.
 */
export default function TextProblems({problems, onApply, onClose}: {problems: Problem[]; onApply: (x: TextImport) => void; onClose: () => void}) {
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(true);
  const [dropPictures, setDropPictures] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = parseProblems(text);
  const have = new Set(problems.map((p, i) => problemNo(p, i)));
  const filling = replace ? parsed.filter((p) => have.has(p.no)).length : 0;
  const warned = parsed.map((p) => ({p, w: problemWarnings(p)})).filter((x) => x.w.length);
  return (
    <Sheet title="Бодлогуудыг текстээр оруулах" sub="Номын бодлогуудыг дугаар, өгүүлбэр, a)–e) сонголттойгоор бичиж эсвэл хуулж буулгана. Томьёог $…$ дотор." onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} autoFocus aria-label="Бодлогууд" placeholder={EXAMPLE} className={`${field} resize-y font-mono text-sm`} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
              <FileText size={15} /> Файлаас (.txt)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) setText(await f.text());
              }}
            />
          </div>
          <p className="text-xs text-neutral-500">
            Бодлого бүр «1.» гэх мэт дугаараар эхэлнэ. Сонголтууд «a)» … «e)» (эсвэл «а)» … «д)»), мөр бүрт нэг эсвэл нэг мөрөнд хэд хэд. «#»-ээр эхэлсэн мөр тэмдэглэл (орохгүй).
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="mt-1" />
            <span>Ижил дугаартай бодлогын оронд оруулах (зөв хариулт нь хэвээр)</span>
          </label>
          {replace && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={dropPictures} onChange={(e) => setDropPictures(e.target.checked)} className="mt-1" />
              <span>Тэдгээрийн зургийг хасах</span>
            </label>
          )}
          {warned.length > 0 && (
            <ul className="space-y-0.5 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">
              {warned.map(({p, w}) => (
                <li key={p.no} className="[overflow-wrap:anywhere]">
                  {p.no}-р бодлого: {w.join('; ')}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm text-neutral-400">
            {parsed.length ? `${parsed.length} бодлого${filling ? `: ${filling} нь одоогийн бодлогын оронд, ${parsed.length - filling} шинээр` : ' шинээр нэмэгдэнэ'}` : 'Сурагчдад ингэж харагдана'}
          </p>
          <ol className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
            {parsed.map((p, i) => (
              <li key={i} className="rounded-xl bg-neutral-800/60 p-3 text-sm">
                <p className="text-xs font-semibold text-neutral-400">
                  {p.no}-р бодлого{replace && have.has(p.no) ? ' · солино' : ' · шинэ'}
                </p>
                <Rich text={p.text} className="mt-1" />
                {p.choices && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {LETTER_CODES.filter((l) => p.choices?.[l]).map((l) => (
                      <span key={l} className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2 py-1">
                        <b className="text-xs text-neutral-400">{LETTER_LABELS[l]}</b>
                        <MathText text={p.choices![l]!} display />
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700">
          Болих
        </button>
        <button
          onClick={() => {
            onApply({problems: parsed, replace, dropPictures});
            onClose();
          }}
          disabled={!parsed.length}
          className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
        >
          {parsed.length ? `${parsed.length} бодлого оруулах` : 'Оруулах'}
        </button>
      </div>
    </Sheet>
  );
}

/** The topic's problems with `x` put in (see TextProblems); new ones get ids from `newId`. */
export function applyText(problems: Problem[], x: TextImport, newId: () => string): Problem[] {
  const out = problems.map((p) => ({...p}));
  const at = new Map(out.map((p, i) => [problemNo(p, i), i]));
  for (const q of x.problems) {
    const i = x.replace ? at.get(q.no) : undefined;
    if (i === undefined) {
      out.push({id: newId(), text: q.text, kind: q.choices ? 'choice' : 'answer', ...(q.choices ? {choices: q.choices} : {}), no: q.no});
      continue;
    }
    const p = out[i];
    // A problem the students write the answer to keeps that (its right answer is a value, not a letter): the choices
    // printed in the book then go under the question, one a line.
    const choicesLine = q.choices
      ? LETTER_CODES.filter((l) => q.choices?.[l])
          .map((l) => `${LETTER_LABELS[l]}) ${q.choices![l]}`)
          .join('\n')
      : '';
    out[i] = {
      ...p,
      text: p.kind === 'answer' && choicesLine ? `${q.text}\n${choicesLine}` : q.text,
      ...(p.kind === 'choice' && q.choices ? {choices: q.choices} : {}),
      ...(x.dropPictures ? {img: undefined} : {}),
      no: p.no ?? q.no,
    };
  }
  return out;
}
