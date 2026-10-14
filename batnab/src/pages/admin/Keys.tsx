import {Check, KeyRound} from 'lucide-react';
import {useEffect, useState} from 'react';
import QuestionCard from '../../components/QuestionCard';
import {choiceAt, saveKey} from '../../lib/keys';
import {navigate} from '../../lib/router';
import {TESTS, testInfo} from '../../tests';
import {CODES, LETTERS} from '../../tests/types';
import type {AdminData} from './data';
import {useTest} from './useTest';

// Latin letters that look like the Cyrillic ones, in case the keyboard was on English.
const LOOKALIKES: Record<string, string> = {A: 'А', B: 'В'};

/** Letters typed or pasted by the teacher ("ВВВДВБ…" or "1.В 2.В …") as a stored key; '-' or '?' skips a question. */
export function parseKey(text: string, count: number) {
  const out: string[] = [];
  for (const raw of text.toUpperCase().replace(/\d+\s*[.)]/g, ' ')) {
    const ch = LOOKALIKES[raw] ?? raw;
    const k = LETTERS.indexOf(ch as (typeof LETTERS)[number]);
    if (k >= 0) out.push(CODES[k]);
    else if (ch === '-' || ch === '?' || ch === '_') out.push('-');
  }
  return out.slice(0, count).join('').padEnd(count, '-');
}

const show = (key: string) => [...key].map((c) => (c === '-' ? '-' : LETTERS[CODES.indexOf(c)])).join('');

export default function Keys({data, initial}: {data: AdminData; initial?: string}) {
  const info = testInfo(initial ?? '') ?? TESTS[0];
  const test = useTest(info.id);
  const saved = (data.keys[info.id] ?? '').padEnd(info.count, '-').slice(0, info.count);
  const [draft, setDraft] = useState(saved);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = draft !== saved;

  // Start from the stored key when switching tests (or when it changes elsewhere and nothing is being edited).
  const [shownFor, setShownFor] = useState({id: info.id, saved});
  if (shownFor.id !== info.id || (shownFor.saved !== saved && !dirty)) {
    setShownFor({id: info.id, saved});
    setDraft(saved);
    setTyped('');
    setStatus('');
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const pick = (id: string) => {
    if (id === info.id || (dirty && !confirm('Хадгалаагүй өөрчлөлт байна. Орхих уу?'))) return;
    navigate(`/admin?tab=keys&test=${id}`);
  };

  const set = (i: number, ci: number) => {
    const cur = choiceAt(draft, i);
    setDraft(draft.slice(0, i) + (cur === ci ? '-' : CODES[ci]) + draft.slice(i + 1));
    setStatus('');
  };

  const save = async () => {
    setBusy(true);
    setStatus('');
    try {
      await saveKey(info.id, draft);
      setShownFor({id: info.id, saved: draft});
      setStatus('Хадгалагдлаа. Бүх сурагчийн дүн шинэ түлхүүрээр тооцогдоно.');
    } catch (e) {
      setStatus(`Алдаа: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const filled = draft.replace(/-/g, '').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TESTS.map((t) => {
          const k = data.keys[t.id] ?? '';
          const n = k.replace(/-/g, '').length;
          return (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ${t.id === info.id ? 'bg-neutral-100 text-black' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
            >
              {t.title}
              <span className={`text-xs ${t.id === info.id ? 'text-neutral-600' : n === t.count ? 'text-green-400' : 'text-neutral-500'}`}>{n === t.count ? <Check size={14} /> : `${n}/${t.count}`}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl bg-neutral-900 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound size={18} /> {info.title}-ийн түлхүүр
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Номын дарааллаар бичнэ (сурагчдад бодлогууд холилдож харагддаг ч түлхүүр номын дугаараар). Доорх бодлого бүр дээр зөв хариултыг дарж эсвэл энд бүгдийг нь нэг дор бичиж болно.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Жишээ: ВВВДВБ… эсвэл 1.В 2.В 3.В …"
            className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono outline-none focus:border-blue-500"
            spellCheck={false}
          />
          <button
            onClick={() => {
              setDraft(parseKey(typed, info.count));
              setStatus('');
            }}
            disabled={!typed.trim()}
            className="rounded-full bg-neutral-800 px-4 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
          >
            Бөглөх
          </button>
        </div>
        <p className="mt-3 break-all font-mono text-sm tracking-wider text-neutral-300">{show(draft)}</p>
      </section>

      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-neutral-800 bg-[#0f0f0f]/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="text-sm text-neutral-300">
          {filled}/{info.count} бөглөсөн
        </span>
        {status && <span className={`text-sm ${status.startsWith('Алдаа') ? 'text-red-400' : 'text-green-400'}`}>{status}</span>}
        {dirty && !status && <span className="text-sm text-amber-300">Хадгалаагүй өөрчлөлт</span>}
        <div className="ml-auto flex gap-2">
          {dirty && (
            <button onClick={() => setDraft(saved)} className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800">
              Болих
            </button>
          )}
          <button onClick={save} disabled={busy || !dirty} className="rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
            {busy ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </div>

      {!test ? (
        <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>
      ) : (
        <ol className="space-y-4">
          {test.questions.map((q, i) => (
            <QuestionCard key={i} num={i + 1} q={q} chosen={choiceAt(draft, i)} keyMode onChoose={(ci) => set(i, ci)} />
          ))}
        </ol>
      )}
    </div>
  );
}
