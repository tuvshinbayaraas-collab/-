import {Check, ImageOff, Lightbulb, RotateCcw, X} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {useBackdrop} from '../lib/backdrop';
import {answer, LETTER_CODES, LETTER_LABELS, normalize, readKey, useTopicImage, type Letter, type Problem} from '../lib/topics';
import MathText from './MathText';

/** Text with $math$; each line its own line. */
export function Rich({text, className = ''}: {text: string; className?: string}) {
  return (
    <div className={`space-y-2 leading-relaxed [overflow-wrap:anywhere] ${className}`}>
      {text.split(/\n/).map((line, i) => (line.trim() ? <p key={i}><MathText text={line} /></p> : <div key={i} className="h-1" />))}
    </div>
  );
}

/** A topic picture: a grey box while it loads; a tap opens it full size. */
export function TopicPicture({tid, iid, className = ''}: {tid: string; iid: string; className?: string}) {
  const url = useTopicImage(tid, iid);
  const [big, setBig] = useState(false);
  if (url === undefined) return <div className={`h-40 animate-pulse rounded-xl bg-neutral-800 ${className}`} aria-label="Зураг ачаалж байна" />;
  if (!url)
    return (
      <div className={`flex h-24 items-center justify-center gap-2 rounded-xl bg-neutral-800/60 text-sm text-neutral-500 ${className}`}>
        <ImageOff size={18} /> Зураг олдсонгүй
      </div>
    );
  return (
    <>
      <button type="button" onClick={() => setBig(true)} className={`block overflow-hidden rounded-xl bg-white ${className}`} aria-label="Зургийг томоор харах">
        <img src={url} alt="" className="mx-auto max-h-[28rem] w-auto max-w-full object-contain" />
      </button>
      {big && <Zoom url={url} onClose={() => setBig(false)} />}
    </>
  );
}

function Zoom({url, onClose}: {url: string; onClose: () => void}) {
  const backdrop = useBackdrop(onClose);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3" {...backdrop} role="dialog" aria-modal="true" aria-label="Зураг">
      <img src={url} alt="" className="max-h-full max-w-full rounded-lg bg-white object-contain" />
      <button onClick={onClose} aria-label="Хаах" className="absolute right-3 top-3 rounded-full bg-neutral-900/80 p-2 text-neutral-200">
        <X size={20} />
      </button>
    </div>
  );
}

export interface Outcome {
  a: string;
  key: string | null;
}

/**
 * One problem for a student: pick А–Д (or write the answer), "Шалгах" records the first answer and shows whether it
 * was right, the right answer and the solution. "Дахин бодох" lets them try again just for practice (not recorded).
 * The teacher (`teacher`) checks against the key without anything being recorded.
 */
export function ProblemView({tid, p, num, first, teacher, onOutcome}: {tid: string; p: Problem; num: number; first?: {a: string}; teacher?: boolean; onOutcome?: (o: Outcome) => void}) {
  const [pick, setPick] = useState<string>('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [practice, setPractice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Answered before: show how it went.
  useEffect(() => {
    if (!first) return;
    let live = true;
    readKey(tid, p.id).then(
      (key) => {
        if (!live) return;
        const o = {a: first.a, key};
        setOutcome(o);
        onOutcome?.(o);
      },
      () => {},
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid, p.id, first?.a]);

  const value = p.kind === 'choice' ? pick : normalize(pick);
  const check = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      if (practice || teacher || first) {
        const key = await readKey(tid, p.id);
        setOutcome({a: value, key});
      } else {
        const key = await answer(tid, p.id, value);
        const o = {a: value, key};
        setOutcome(o);
        onOutcome?.(o);
      }
    } catch (err) {
      setError(/permission/i.test((err as Error).message) ? 'Энэ бодлогын хариултыг багш оруулаагүй байна.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const again = () => {
    setPractice(true);
    setOutcome(null);
    setPick('');
  };

  const done = !!outcome;
  const ok = done && outcome.key !== null && outcome.a === outcome.key;
  const shownKey = outcome?.key ? (p.kind === 'choice' ? LETTER_LABELS[outcome.key as Letter] : outcome.key) : null;
  const noKey = p.k === false;

  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 sm:p-5 ${done ? (ok ? 'ring-1 ring-green-500/40' : 'ring-1 ring-red-500/40') : ''}`}>
      <div className="flex items-center gap-2">
        <span className="font-bold">{num}-р бодлого</span>
        {practice && <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">дасгал</span>}
        {first && !practice && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-green-500/15 text-green-300' : done ? 'bg-red-500/15 text-red-300' : 'bg-neutral-800 text-neutral-400'}`}>
            {done ? (ok ? 'Зөв бодсон' : 'Алдсан') : 'Бодсон'}
          </span>
        )}
      </div>
      {p.text && <Rich text={p.text} className="mt-2" />}
      {p.img && <TopicPicture tid={tid} iid={p.img} className="mt-3 w-full" />}

      <form onSubmit={check} className="mt-4">
        {p.kind === 'choice' ? (
          <div className="flex flex-wrap gap-2">
            {LETTER_CODES.map((l) => {
              const text = p.choices?.[l];
              const picked = (done ? outcome.a : pick) === l;
              const right = done && outcome.key === l;
              const style = done
                ? right
                  ? 'border-green-500 bg-green-500/15'
                  : picked
                    ? 'border-red-500 bg-red-500/15'
                    : 'border-neutral-800 opacity-60'
                : picked
                  ? 'border-blue-500 bg-blue-500/15'
                  : 'border-neutral-700 hover:border-neutral-500';
              return (
                <button
                  key={l}
                  type="button"
                  disabled={done}
                  aria-pressed={picked}
                  onClick={() => setPick(l)}
                  className={`flex min-w-[4.5rem] flex-[1_1_auto] items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${style}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${right ? 'bg-green-500 text-black' : picked ? (done ? 'bg-red-500 text-black' : 'bg-blue-500 text-black') : 'bg-neutral-800'}`}>
                    {LETTER_LABELS[l]}
                  </span>
                  {text && <MathText text={text} display />}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            value={done ? outcome.a : pick}
            disabled={done}
            onChange={(e) => setPick(e.target.value)}
            maxLength={40}
            placeholder="Хариултаа бичнэ үү"
            className={`w-full rounded-xl border bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500 sm:w-64 ${done ? (ok ? 'border-green-500' : 'border-red-500') : 'border-neutral-700'}`}
          />
        )}
        {!done && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button disabled={busy || !value || noKey} className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
              {busy ? 'Шалгаж байна…' : 'Шалгах'}
            </button>
            {noKey && <span className="text-sm text-neutral-500">Багш хариултыг удахгүй оруулна.</span>}
            {!noKey && !practice && !first && !teacher && <span className="text-xs text-neutral-500">Эхний хариулт тань багшид харагдана.</span>}
          </div>
        )}
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {done && (
        <div className="mt-4 space-y-3">
          <p className={`flex flex-wrap items-center gap-2 font-semibold ${ok ? 'text-green-400' : 'text-red-300'}`}>
            {ok ? <Check size={18} /> : <X size={18} />}
            {outcome.key === null ? 'Хариултыг багш оруулаагүй байна.' : ok ? 'Зөв! Гайхалтай.' : `Буруу. Зөв хариулт: ${shownKey}`}
          </p>
          {(p.sol || p.solImg) && (
            <details open={!ok} className="rounded-xl bg-neutral-800/50 p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-amber-200">
                <Lightbulb size={16} /> Бодолт
              </summary>
              {p.sol && <Rich text={p.sol} className="mt-2 text-sm text-neutral-200" />}
              {p.solImg && <TopicPicture tid={tid} iid={p.solImg} className="mt-2 w-full" />}
            </details>
          )}
          {outcome.key !== null && (
            <button type="button" onClick={again} className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium hover:bg-neutral-700">
              <RotateCcw size={15} /> Дахин бодох
            </button>
          )}
        </div>
      )}
    </li>
  );
}
