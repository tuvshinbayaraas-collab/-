import {Check, ChevronLeft, ChevronRight, Eye, KeyRound, Pencil, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import QuestionCard from '../../components/QuestionCard';
import {useBackdrop} from '../../lib/backdrop';
import {choiceAt, saveKey} from '../../lib/keys';
import {navigate} from '../../lib/router';
import {TESTS, testInfo} from '../../tests';
import {CODES, LETTERS, type Test} from '../../tests/types';
import type {AdminData} from './data';
import {useTest} from './useTest';

// Latin letters that look like the Cyrillic ones, in case the keyboard was on English.
const LOOKALIKES: Record<string, string> = {A: 'А', B: 'В'};

/** Letters typed or pasted by the teacher ("АБВГДБ…" or "1.В 2.В …") as a stored key; '-' or '?' skips a question. */
export function parseKey(text: string, count: number) {
  const out: string[] = [];
  for (const raw of text.toUpperCase().replace(/\d+\s*[.)]/g, ' ')) {
    const ch = LOOKALIKES[raw] ?? raw;
    const k = LETTERS.indexOf(ch as (typeof LETTERS)[number]);
    if (k >= 0) out.push(CODES[k]);
    else if (ch === '-' || ch === '?' || ch === '_') out.push('-');
  }
  return {key: out.slice(0, count).join('').padEnd(count, '-'), found: out.length};
}

const filledOf = (key: string) => key.replace(/-/g, '').length;

/** The answer key as a bubble sheet, like the one in the teacher's book: one row per question, tap the right letter. */
export default function Keys({data, initial}: {data: AdminData; initial?: string}) {
  const info = testInfo(initial ?? '') ?? TESTS[0];
  const test = useTest(info.id);
  const saved = (data.keys[info.id] ?? '').padEnd(info.count, '-').slice(0, info.count);
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState<{ok: boolean; text: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const changed = [...draft].filter((c, i) => c !== saved[i]).length;
  const dirty = changed > 0;
  const takers = new Set(data.results.filter((r) => r.test === info.id).map((r) => r.uid)).size;

  // Start from the stored key when switching tests (or when it changes elsewhere and nothing is being edited).
  const [shownFor, setShownFor] = useState({id: info.id, saved});
  if (shownFor.id !== info.id || (shownFor.saved !== saved && !dirty)) {
    setShownFor({id: info.id, saved});
    setDraft(saved);
    setStatus(null);
    setPreview(null);
  }

  // Unsaved changes: ask before the page or a link takes the teacher elsewhere.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const leave = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href]');
      if (a && !confirm('Түлхүүрийн өөрчлөлт хадгалагдаагүй байна. Орхих уу?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', leave, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', leave, true);
    };
  }, [dirty]);

  const pick = (id: string) => {
    if (id === info.id || (dirty && !confirm('Түлхүүрийн өөрчлөлт хадгалагдаагүй байна. Орхих уу?'))) return;
    setDraft(saved); // so the guard above doesn't ask again
    navigate(`/admin?tab=keys&test=${id}`);
  };

  const set = (i: number, ci: number) => {
    setDraft((d) => d.slice(0, i) + (choiceAt(d, i) === ci ? '-' : CODES[ci]) + d.slice(i + 1));
    setStatus(null);
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await saveKey(info.id, draft);
      setShownFor({id: info.id, saved: draft});
      setStatus({ok: true, text: takers ? `Хадгалагдлаа. ${takers} сурагчийн оноо шинэ түлхүүрээр тооцогдлоо.` : 'Хадгалагдлаа.'});
    } catch (e) {
      setStatus({ok: false, text: `Хадгалж чадсангүй: ${(e as Error).message}`});
    } finally {
      setBusy(false);
    }
  };

  const filled = filledOf(draft);

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap gap-2">
        {TESTS.map((t) => {
          const n = filledOf(data.keys[t.id] ?? '');
          const current = t.id === info.id;
          return (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              aria-current={current}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ${current ? 'bg-neutral-100 text-black' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
            >
              {t.title}
              <span className={`text-xs ${current ? 'text-neutral-600' : n === t.count ? 'text-green-400' : 'text-neutral-500'}`}>
                {n === t.count ? <Check size={14} aria-label="бүрэн" /> : `${n}/${t.count}`}
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound size={18} /> {info.title} — зөв хариултууд
          </h2>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${filled === info.count ? 'bg-green-500/15 text-green-300' : 'bg-neutral-800 text-neutral-300'}`}>
            {filled}/{info.count} бөглөсөн
          </span>
        </div>
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-neutral-400">
          <li>Номын дугаараар бодлого бүрийн зөв үсгийг дарна (дахин дарвал арилна).</li>
          <li>
            Бодлого нь ямар байсныг <Eye size={14} className="inline" /> дээр дарж харж болно.
          </li>
          <li>Доор гарах «Хадгалах» товчийг дарна.</li>
        </ol>
        {status && <p className={`mt-3 flex items-center gap-1 text-sm ${status.ok ? 'text-green-400' : 'text-red-400'}`}>{status.ok && <Check size={16} />} {status.text}</p>}

        <div className="mt-4 grid gap-x-8 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-[repeat(15,auto)] lg:grid-cols-3 lg:grid-rows-[repeat(10,auto)]">
          {Array.from({length: info.count}, (_, i) => {
            const chosen = choiceAt(draft, i);
            const edited = draft[i] !== saved[i];
            return (
              <div key={i} className="flex items-center gap-1.5 border-b border-neutral-800/70 py-1.5">
                <span className={`w-8 shrink-0 text-right text-sm font-semibold tabular-nums ${edited ? 'text-amber-300' : chosen === null ? 'text-neutral-500' : ''}`}>
                  {i + 1}.
                </span>
                <div className="flex gap-1" role="radiogroup" aria-label={`${i + 1}-р бодлогын зөв хариулт`}>
                  {LETTERS.map((L, ci) => (
                    <button
                      key={L}
                      role="radio"
                      aria-checked={chosen === ci}
                      onClick={() => set(i, ci)}
                      className={`h-9 w-9 rounded-full border text-sm font-semibold transition-colors ${
                        chosen === ci ? 'border-green-500 bg-green-500 text-black' : 'border-neutral-700 text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800'
                      }`}
                    >
                      {L}
                    </button>
                  ))}
                </div>
                <button onClick={() => setPreview(i)} aria-label={`${i + 1}-р бодлогыг харах`} className="ml-auto rounded-full p-2 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200">
                  <Eye size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <TypeIn
          count={info.count}
          onApply={(k) => {
            setDraft(k);
            setStatus(null);
          }}
        />
      </section>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-800 bg-[#0f0f0f]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-medium text-amber-300">{changed} өөрчлөлт хадгалаагүй.</span>{' '}
              {takers > 0 && <span className="text-neutral-400">Хадгалахад энэ тестийг өгсөн {takers} сурагчийн оноо шинээр тооцогдоно.</span>}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDraft(saved)} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800">
                Болих
              </button>
              <button onClick={save} disabled={busy} className="rounded-full bg-blue-500 px-6 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-60">
                {busy ? 'Хадгалж байна…' : 'Хадгалах'}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview !== null && test && <Preview test={test} index={preview} draft={draft} onPick={set} onMove={setPreview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/** For a key copied from paper: type all the letters at once. */
function TypeIn({count, onApply}: {count: number; onApply: (key: string) => void}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const parsed = parseKey(text, count);

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-400 hover:underline">
        <Pencil size={15} /> Эсвэл бүгдийг нь бичиж оруулах
      </button>
    );
  return (
    <div className="mt-4 rounded-xl border border-neutral-800 p-3">
      <label htmlFor="typed-key" className="text-sm font-medium">
        Хариултуудыг дарааллаар нь бичнэ
      </label>
      <p className="text-xs text-neutral-500">Жишээ: «АБВГДБ…» эсвэл «1.А 2.Б 3.В …». Мэдэхгүй бодлогод «-» гэж бичнэ.</p>
      <textarea
        id="typed-key"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        spellCheck={false}
        className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500"
      />
      <p className={`mt-1 text-xs ${parsed.found > count ? 'text-amber-300' : 'text-neutral-400'}`}>
        {parsed.found} хариулт танигдлаа{parsed.found > count ? ` (эхний ${count}-г авна)` : parsed.found < count && parsed.found ? ` (${count - parsed.found} дутуу)` : ''}.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => {
            onApply(parsed.key);
            setOpen(false);
            setText('');
          }}
          disabled={!parsed.found}
          className="rounded-full bg-neutral-100 px-4 py-1.5 text-sm font-semibold text-black hover:bg-white disabled:opacity-50"
        >
          Хүснэгтэд буулгах
        </button>
        <button onClick={() => setOpen(false)} className="rounded-full px-4 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800">
          Болих
        </button>
      </div>
    </div>
  );
}

/** One question as students see it; choosing a letter here sets the key too. */
function Preview(props: {test: Test; index: number; draft: string; onPick: (i: number, ci: number) => void; onMove: (i: number) => void; onClose: () => void}) {
  const {test, index, draft, onPick, onMove, onClose} = props;
  const last = test.questions.length - 1;
  const backdrop = useBackdrop(onClose);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < last) onMove(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onMove(index - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [index, last, onClose, onMove]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" {...backdrop} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-neutral-950 p-3 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2">
          <button onClick={() => onMove(index - 1)} disabled={index === 0} aria-label="Өмнөх" className="rounded-full p-2 hover:bg-neutral-800 disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-neutral-400">
            {index + 1}/{last + 1}
          </span>
          <button onClick={() => onMove(index + 1)} disabled={index === last} aria-label="Дараах" className="rounded-full p-2 hover:bg-neutral-800 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
          <button onClick={onClose} aria-label="Хаах" className="ml-auto rounded-full p-2 hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>
        <ol>
          <QuestionCard num={index + 1} q={test.questions[index]} chosen={choiceAt(draft, index)} keyMode onChoose={(ci) => onPick(index, ci)} />
        </ol>
        <p className="mt-2 px-1 text-xs text-neutral-500">Зөв хариултыг энд дарж сонгож болно.</p>
      </div>
    </div>
  );
}
