import {Check, Flag} from 'lucide-react';
import {useState} from 'react';
import {sendReport, type Report} from '../lib/lead';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import Sheet from './Sheet';

/** The usual mistakes, one tap each (the words after them are optional). */
export const REASONS = ['Зөв хариулт нь буруу', 'Сонголт буруу эсвэл дутуу', 'Бичвэрт алдаа байна', 'Зураг буруу эсвэл харагдахгүй', 'Өөр'] as const;

/** The reason and the words added, as the one text the teacher reads. */
export const reportText = (reason: string, words: string) => (reason === 'Өөр' ? words.trim() : words.trim() ? `${reason}: ${words.trim()}` : reason);

/** Whether the signed-in student may report a mistake (a class leader, the power on). */
export function useCanReport() {
  const {profile, admin} = useSession();
  const settings = useSettings();
  return !admin && !!profile?.lead && !profile.disabled && !!profile.class && settings?.leadReports !== false;
}

/** What is wrong: a tap on one of the usual mistakes, a few words if wanted. */
export function ReasonPicker({
  reason,
  setReason,
  words,
  setWords,
}: {
  reason: string;
  setReason: (r: string) => void;
  words: string;
  setWords: (w: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Юу нь буруу вэ?">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            aria-pressed={reason === r}
            className={`rounded-full border px-3 py-1.5 text-sm ${reason === r ? 'border-amber-400 bg-amber-500/15 text-amber-100' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        value={words}
        maxLength={400}
        rows={2}
        onChange={(e) => setWords(e.target.value)}
        placeholder={reason === 'Өөр' ? 'Юу нь буруу вэ?' : 'Нэмж хэлэх зүйл (заавал биш). Жишээ нь: В сонголтод хасах тэмдэг дутуу.'}
        aria-label="Алдааны тайлбар"
        className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
    </div>
  );
}

/** «Алдаа мэдээлэх» under a problem, for the class leaders: a few taps, to the teacher. */
export default function ReportButton({what}: {what: Pick<Report, 'kind' | 'ref' | 'q' | 'label'>}) {
  const can = useCanReport();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  if (!can) return null;
  const text = reportText(reason, words);
  const close = () => {
    setOpen(false);
    setSent(false);
    setError('');
  };
  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await sendReport({...what, text});
      setSent(true);
      setReason('');
      setWords('');
    } catch (e) {
      setError(/permission/i.test((e as Error).message) ? 'Болсонгүй: багш энэ эрхийг унтраасан байж магадгүй.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-amber-200"
      >
        <Flag size={15} /> Алдаа мэдээлэх
      </button>
      {open && (
        <Sheet title="Бодлогын алдаа мэдээлэх" sub={what.label} onClose={close}>
          {sent ? (
            <div className="flex flex-col items-center py-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                <Check size={28} />
              </span>
              <p className="mt-3 font-semibold">Багшид илгээлээ. Баярлалаа!</p>
              <p className="mt-1 text-sm text-neutral-400">Багш зассан эсэхийг ангийн даргын самбарын «Алдаа» хэсгээс харна.</p>
              <button onClick={close} className="mt-5 w-full rounded-full bg-neutral-800 py-2.5 text-sm font-semibold hover:bg-neutral-700">
                Хаах
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm text-neutral-300">Юу нь буруу вэ?</p>
              <ReasonPicker reason={reason} setReason={setReason} words={words} setWords={setWords} />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={close} className="rounded-full bg-neutral-800 py-2.5 text-sm font-semibold hover:bg-neutral-700">
                  Болих
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !text}
                  className="rounded-full bg-amber-400 py-2.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                >
                  {busy ? 'Илгээж байна…' : 'Илгээх'}
                </button>
              </div>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
