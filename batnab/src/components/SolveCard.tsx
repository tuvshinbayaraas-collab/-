import {CheckCircle2, XCircle} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useBankImage} from '../lib/bank';
import {LETTER_LABELS, lettersOf, verdict, type Letter, type Problem} from '../lib/topics';
import MathText from './MathText';
import {Rich} from './TopicParts';

/**
 * One problem to solve (the problem bank's, a video's): its picture or text, its choices or a box to write in; once
 * answered, right or wrong. `send` keeps the answer and gives the right one; `readKey` gives it once answered.
 */
export default function SolveCard({
  p,
  num,
  uid,
  answer,
  send: keep,
  readKey,
}: {
  p: {id: string; text: string; img?: string; kind: Problem['kind']; choices?: Partial<Record<Letter, string>>};
  num: number;
  /** The student (null: the teacher looking, who doesn't answer). */
  uid: string | null;
  answer?: {a: string};
  send: (a: string) => Promise<string | null>;
  readKey: () => Promise<string | null>;
}) {
  const url = useBankImage(p.img);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The right answer: undefined until known, null when the teacher hasn't given one.
  const [key, setKey] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (answer && key === undefined) void readKey().then(setKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, key, p.id]);
  const letters = lettersOf(p);
  const send = async () => {
    if (!uid || !pick.trim()) return;
    setBusy(true);
    setError('');
    try {
      setKey(await keep(p.kind === 'choice' ? pick : pick.trim()));
    } catch (e) {
      setError(`Илгээж чадсангүй: ${(e as Error).message}`);
    }
    setBusy(false);
  };
  const mine = answer?.a;
  const ok = mine !== undefined && key !== undefined ? verdict(mine, key) : undefined;
  const shownKey = key ? (p.kind === 'choice' ? (LETTER_LABELS[key as Letter] ?? key) : key) : null;
  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 sm:p-5 ${ok === true ? 'ring-1 ring-green-500/40' : ok === false ? 'ring-1 ring-red-500/40' : ''}`} data-bank-card={p.id}>
      <p className="font-bold">{num}-р бодлого</p>
      {p.img &&
        (url ? (
          <img src={url} alt={`${num}-р бодлогын зураг`} className="mt-3 w-full rounded-lg bg-white object-contain" />
        ) : (
          <div className="mt-3 h-32 animate-pulse rounded-lg bg-neutral-800" />
        ))}
      {p.text && <Rich text={p.text} className="mt-2" />}
      <div className="mt-4">
        {p.kind === 'choice' ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Хариулт сонгох">
            {letters.map((l) => {
              const text = p.choices?.[l];
              const picked = (mine ?? pick) === l;
              const right = mine !== undefined && key === l;
              // Wrong only when a right answer is known; without one the pick stays plain blue.
              const wrong = mine !== undefined && !!key && picked && !right;
              const tone =
                mine !== undefined
                  ? right
                    ? 'border-green-500 bg-green-500/15'
                    : wrong
                      ? 'border-red-500 bg-red-500/15'
                      : picked
                        ? 'border-blue-500 bg-blue-500/15'
                        : 'border-neutral-800 opacity-60'
                  : picked
                    ? 'border-blue-500 bg-blue-500/15'
                    : 'border-neutral-700 hover:border-neutral-500';
              return (
                <button
                  key={l}
                  type="button"
                  disabled={mine !== undefined || !uid}
                  aria-pressed={picked}
                  onClick={() => setPick(l)}
                  className={`flex min-w-[4.5rem] flex-[1_1_auto] items-center gap-2 rounded-xl border px-3 py-2 text-left ${tone}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${right ? 'bg-green-500 text-black' : wrong ? 'bg-red-500 text-black' : picked ? 'bg-blue-500 text-black' : 'bg-neutral-800'}`}>{LETTER_LABELS[l]}</span>
                  {text && <MathText text={text} className="min-w-0 [overflow-wrap:anywhere]" />}
                </button>
              );
            })}
          </div>
        ) : mine !== undefined ? (
          <p className="rounded-xl bg-neutral-800/60 px-3 py-2 text-sm">
            Таны хариулт: <span className="font-semibold">{mine}</span>
          </p>
        ) : (
          <input
            value={pick}
            onChange={(e) => setPick(e.target.value.slice(0, 300))}
            onKeyDown={(e) => e.key === 'Enter' && void send()}
            disabled={!uid}
            placeholder="Хариултаа бичнэ үү"
            aria-label={`${num}-р бодлогын хариулт`}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-blue-500"
          />
        )}
      </div>
      {mine === undefined ? (
        uid ? (
          <button type="button" onClick={() => void send()} disabled={busy || !pick.trim()} className="mt-3 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
            {busy ? 'Шалгаж байна…' : 'Шалгах'}
          </button>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">Сурагч энд хариултаа сонгоод «Шалгах» дарна.</p>
        )
      ) : key === undefined ? (
        <p className="mt-3 text-sm text-neutral-400">Шалгаж байна…</p>
      ) : ok === null ? (
        <p className="mt-3 text-sm text-neutral-300" role="status">
          Хариултаа илгээлээ. Багш энэ бодлогын зөв хариултыг оруулаагүй байна.
        </p>
      ) : (
        <p className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${ok ? 'text-green-300' : 'text-red-300'}`} role="status">
          {ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
          {ok ? 'Зөв!' : `Буруу. Зөв хариулт: ${shownKey}`}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </li>
  );
}
