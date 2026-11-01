import {Camera, Check, Hourglass, ImageOff, Lightbulb, MessageSquare, RotateCcw, X} from 'lucide-react';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import AskButton from './Ask';
import {auth} from '../lib/firebase';
import {answer, LETTER_CODES, LETTER_LABELS, normalize, readKey, sendWork, useTopicImage, useWork, verdict, type Letter, type Mark, type Problem} from '../lib/topics';
import VideoEmbed from './VideoEmbed';
import MathText from './MathText';
import ZoomView from './ZoomView';

/** Text with $math$; each line its own line. */
export function Rich({text, className = ''}: {text: string; className?: string}) {
  return (
    <div className={`space-y-2 leading-relaxed [overflow-wrap:anywhere] ${className}`}>
      {text.split(/\n/).map((line, i) => (line.trim() ? <p key={i}><MathText text={line} /></p> : <div key={i} className="h-1" />))}
    </div>
  );
}

/** A topic picture: a grey box while it loads; a tap opens it full screen, to zoom in. */
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
      {big && <ZoomView url={url} onClose={() => setBig(false)} />}
    </>
  );
}

export interface Outcome {
  a: string;
  key: string | null;
}

/** A student's photo of their working (`uid`'s, for the teacher): small, a tap shows it full size. */
export function WorkPhoto({uid, tid, pid, className = ''}: {uid: string; tid: string; pid: string; className?: string}) {
  const url = useWork(uid, tid, pid);
  const [big, setBig] = useState(false);
  if (url === undefined) return <div className={`h-24 w-32 animate-pulse rounded-lg bg-neutral-800 ${className}`} aria-label="Зураг ачаалж байна" />;
  if (!url) return null;
  return (
    <>
      <button type="button" onClick={() => setBig(true)} className={`block overflow-hidden rounded-lg bg-white ring-1 ring-neutral-700 ${className}`} aria-label="Бодолтын зургийг томоор харах">
        <img src={url} alt="Бодолтын зураг" className="max-h-40 w-auto max-w-full object-contain" />
      </button>
      {big && <ZoomView url={url} onClose={() => setBig(false)} />}
    </>
  );
}

/** The student's own photo of the working, once sent; while the teacher hasn't checked it, one can be added or put in its place. */
function MyWork({uid, tid, pid, sent, open, onSent}: {uid: string; tid: string; pid: string; sent: boolean; open: boolean; onSent: () => void}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await sendWork(tid, pid, file);
      setFile(null);
      onSent();
    } catch (e) {
      setError(/permission/i.test((e as Error).message) ? 'Зургийг илгээж чадсангүй: багш шалгасан, эсвэл сэдэв хаагдсан байж магадгүй. Хуудсаа дахин ачаална уу.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!sent && !open) return null;
  return (
    <div className="space-y-2">
      {sent && (
        <div>
          <p className="mb-1 text-xs text-neutral-500">Илгээсэн бодолтын зураг</p>
          <WorkPhoto uid={uid} tid={tid} pid={pid} />
        </div>
      )}
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <PickPhoto file={file} onFile={setFile} disabled={busy} label={sent ? 'Өөр зураг' : 'Бодолтын зураг нэмэх'} />
          {file && (
            <button type="button" onClick={send} disabled={busy} className="rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
              {busy ? 'Илгээж байна…' : sent ? 'Энэ зургаар солих' : 'Зургийг илгээх'}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

/** "Бодолтын зураг": a photo of the working picked to send (with a look at it, and a way to take it off). */
function PickPhoto({file, onFile, disabled, label = 'Бодолтын зураг'}: {file: File | null; onFile: (f: File | null) => void; disabled?: boolean; label?: string}) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) return setUrl('');
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url ? (
        <span className="relative">
          <img src={url} alt="Илгээх бодолтын зураг" className="h-20 w-auto rounded-lg bg-white object-contain ring-1 ring-neutral-700" />
          <button type="button" onClick={() => onFile(null)} disabled={disabled} aria-label="Зургийг авах" className="absolute -right-2 -top-2 rounded-full bg-neutral-700 p-1 text-neutral-100 hover:bg-neutral-600">
            <X size={12} />
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={disabled} className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50">
          <Camera size={15} /> {label}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label="Бодолтын зураг сонгох"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f?.type.startsWith('image/')) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * One problem for a student: pick А–Д (or write the answer), "Шалгах" records the first answer and shows whether it
 * was right, the right answer and the solution. "Дахин бодох" lets them try again just for practice (not recorded).
 * A problem the teacher gave no right answer is checked by the teacher: "Багшид илгээх" sends the answer, and the
 * teacher's word (`mark`: right or wrong, a note) shows when it comes; a mark also stands over the key's verdict.
 * The teacher (`teacher`) checks against the key without anything being recorded. With `review` (the mistakes
 * notebook) it starts as a practice try and reports whether it was right. `ask`: the "Багшаас асуух" button's label.
 */
export function ProblemView(props: {
  tid: string;
  p: Problem;
  num: number;
  first?: {a: string; w?: boolean};
  mark?: Mark | null;
  teacher?: boolean;
  onOutcome?: (o: Outcome) => void;
  review?: (right: boolean) => void;
  ask?: string;
  heading?: string;
}) {
  const {tid, p, num, teacher, onOutcome, review, ask, heading, mark} = props;
  const first = review ? undefined : props.first;
  const [pick, setPick] = useState<string>('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [practice, setPractice] = useState(!!review);
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // No right answer given: the teacher checks the answer.
  const byTeacher = !p.k && !practice;
  // A photo of the working, for the teacher to check (sent with the answer, or added after it while it waits).
  const [photo, setPhoto] = useState<File | null>(null);
  const [sentPhoto, setSentPhoto] = useState(false);
  const withPhoto = byTeacher && !teacher;
  // A photo alone is an answer only where one is written (an А–Д problem needs its letter, the key may be picked later).
  const photoAlone = withPhoto && p.kind === 'answer';
  const uid = auth.currentUser?.uid;

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
    // Again when the teacher gives the right answer (or takes it back) while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid, p.id, first?.a, p.k]);

  const value = p.kind === 'choice' ? pick : byTeacher ? pick.trim().slice(0, 300) : normalize(pick);
  const check = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!value && !(photoAlone && photo && !first)) return;
    setBusy(true);
    setError('');
    try {
      if (practice || teacher || first) {
        const key = await readKey(tid, p.id);
        setOutcome({a: value, key});
        if (review && !reported && key !== null) {
          setReported(true);
          review(verdict(value, key, null) === true);
        }
      } else {
        const key = await answer(tid, p.id, value, (withPhoto && photo) || undefined);
        if (withPhoto && photo) setSentPhoto(true);
        setPhoto(null);
        const o = {a: value, key};
        setOutcome(o);
        onOutcome?.(o);
      }
    } catch (err) {
      setError(/permission/i.test((err as Error).message) ? 'Хариултыг илгээж чадсангүй. Сэдэв хаагдсан эсэхийг багшаасаа асууна уу.' : (err as Error).message);
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
  // The first answer's verdict: the teacher's mark, else the key; null while the teacher hasn't checked it.
  const counted = done && !practice && !teacher;
  const v = done ? verdict(outcome.a, outcome.key, counted ? mark : null) : null;
  const waiting = counted && v === null;
  const ok = v === true;
  const shownKey = outcome?.key ? (p.kind === 'choice' ? LETTER_LABELS[outcome.key as Letter] : outcome.key) : null;
  const solution = (p.sol || p.solImg || p.vid) && (
    <>
      {p.sol && <Rich text={p.sol} className="mt-2 text-sm text-neutral-200" />}
      {p.solImg && <TopicPicture tid={tid} iid={p.solImg} className="mt-2 w-full" />}
      {p.vid && <VideoEmbed link={p.vid} className="mt-2" />}
    </>
  );
  const ring = !done || v === null ? '' : ok ? 'ring-1 ring-green-500/40' : 'ring-1 ring-red-500/40';
  const fromTeacher = counted && mark;

  return (
    <li className={`rounded-2xl bg-neutral-900 p-4 sm:p-5 ${ring}`}>
      <div className="flex items-center gap-2">
        <span className="font-bold">{heading ?? `${num}-р бодлого`}</span>
        {practice && <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">дасгал</span>}
        {!p.k && !first && !practice && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-200">багш шалгана</span>}
        {first && !practice && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-green-500/15 text-green-300' : v === false ? 'bg-red-500/15 text-red-300' : waiting ? 'bg-violet-500/15 text-violet-200' : 'bg-neutral-800 text-neutral-400'}`}>
            {ok ? 'Зөв бодсон' : v === false ? 'Алдсан' : waiting ? 'Багш шалгаж байна' : 'Бодсон'}
          </span>
        )}
      </div>
      {p.text && <Rich text={p.text} className="mt-2" />}
      {p.img && <TopicPicture tid={tid} iid={p.img} className="mt-3 w-full" />}

      {teacher && !p.k && !practice ? (
        <p className="mt-4 rounded-xl bg-neutral-800/50 p-3 text-sm text-neutral-300">Сурагчид энэ бодлогын хариултаа танд илгээнэ: сэдвийн «Шалгах» хэсэгт зөв, бурууг нь тэмдэглэнэ.</p>
      ) : (
        <form onSubmit={check} className="mt-4">
          {p.kind === 'choice' ? (
            <div className="flex flex-wrap gap-2">
              {LETTER_CODES.map((l) => {
                const text = p.choices?.[l];
                const picked = (done ? outcome.a : pick) === l;
                const right = done && outcome.key === l;
                const style = done
                  ? right || (picked && ok)
                    ? 'border-green-500 bg-green-500/15'
                    : picked
                      ? v === null
                        ? 'border-violet-400 bg-violet-500/15'
                        : 'border-red-500 bg-red-500/15'
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
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${right || (picked && ok) ? 'bg-green-500 text-black' : picked ? (done ? (v === null ? 'bg-violet-500 text-black' : 'bg-red-500 text-black') : 'bg-blue-500 text-black') : 'bg-neutral-800'}`}
                    >
                      {LETTER_LABELS[l]}
                    </span>
                    {text && <MathText text={text} display />}
                  </button>
                );
              })}
            </div>
          ) : byTeacher ? (
            <textarea
              value={done ? outcome.a : pick}
              disabled={done}
              onChange={(e) => setPick(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Хариултаа бичнэ үү (бодолтоо товч бичиж болно)"
              aria-label="Хариулт"
              className={`w-full resize-y rounded-xl border bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500 ${done ? (ok ? 'border-green-500' : v === false ? 'border-red-500' : 'border-violet-400') : 'border-neutral-700'}`}
            />
          ) : (
            <input
              value={done ? outcome.a : pick}
              disabled={done}
              onChange={(e) => setPick(e.target.value)}
              maxLength={40}
              placeholder="Хариултаа бичнэ үү"
              className={`w-full rounded-xl border bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500 sm:w-64 ${done ? (ok ? 'border-green-500' : v === false ? 'border-red-500' : 'border-violet-400') : 'border-neutral-700'}`}
            />
          )}
          {!done && withPhoto && !first && (
            <div className="mt-2">
              <PickPhoto file={photo} onFile={setPhoto} disabled={busy} />
            </div>
          )}
          {!done && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button disabled={busy || (!value && !(photoAlone && photo && !first))} className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:bg-neutral-800 disabled:text-neutral-500">
                {busy ? (byTeacher ? 'Илгээж байна…' : 'Шалгаж байна…') : byTeacher ? 'Багшид илгээх' : 'Шалгах'}
              </button>
              {!practice && !first && !teacher && <span className="text-xs text-neutral-500">{byTeacher ? 'Хариулт тань (бодолтын зураг ч) багшид очно: багш шалгаад зөв, бурууг тань хэлнэ.' : 'Эхний хариулт тань багшид харагдана.'}</span>}
            </div>
          )}
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {done && (
        <div className="mt-4 space-y-3">
          {withPhoto && counted && uid && <MyWork uid={uid} tid={tid} pid={p.id} sent={sentPhoto || !!first?.w} open={waiting} onSent={() => setSentPhoto(true)} />}
          {waiting ? (
            <p className="flex flex-wrap items-center gap-2 font-semibold text-violet-200">
              <Hourglass size={18} /> Багшид илгээсэн. Шалгаад зөв, бурууг тань энд хэлнэ.
            </p>
          ) : v === null ? (
            <p className="font-semibold text-neutral-300">Энэ бодлогод одоо шалгах хариулт алга.</p>
          ) : (
            <p className={`flex flex-wrap items-center gap-2 font-semibold ${ok ? 'text-green-400' : 'text-red-300'}`}>
              {ok ? <Check size={18} /> : <X size={18} />}
              {fromTeacher ? (ok ? 'Багш: зөв!' : `Багш: буруу.${shownKey ? ` Зөв хариулт: ${shownKey}` : ''}`) : ok ? 'Зөв! Гайхалтай.' : `Буруу. Зөв хариулт: ${shownKey}`}
            </p>
          )}
          {fromTeacher && mark.note && (
            <p className="flex items-start gap-2 rounded-xl bg-neutral-800/60 p-3 text-sm text-neutral-200">
              <MessageSquare size={16} className="mt-0.5 shrink-0 text-neutral-400" /> <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{mark.note}</span>
            </p>
          )}
          {solution && (
            <details open={v === false} className="rounded-xl bg-neutral-800/50 p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-amber-200">
                <Lightbulb size={16} /> {p.sol || p.solImg ? `Бодолт${p.vid ? ' · видео' : ''}` : 'Видео тайлбар'}
              </summary>
              {solution}
            </details>
          )}
          {outcome.key !== null && !review && (
            <button type="button" onClick={again} className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium hover:bg-neutral-700">
              <RotateCcw size={15} /> Дахин бодох
            </button>
          )}
        </div>
      )}
      {ask && !teacher && (
        <div className="mt-3 flex justify-end border-t border-neutral-800 pt-2">
          <AskButton ctx={{s: 'p', t: tid, q: p.id, label: ask}} />
        </div>
      )}
    </li>
  );
}
