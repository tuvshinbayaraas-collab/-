import {Check, MessageCircleQuestion} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {askQuestion, type Question} from '../lib/classroom';
import {Link} from '../lib/router';
import Sheet from './Sheet';

/** "Багшаас асуух": a student's question about one problem, answered by the teacher in the dashboard. */
export default function AskButton({ctx}: {ctx: Question['ctx']}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await askQuestion(ctx, text);
      setSent(true);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setOpen(false);
    setSent(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
        <MessageCircleQuestion size={16} /> Багшаас асуух
      </button>
      {open && (
        <Sheet title="Багшаас асуух" sub={ctx.label} onClose={close}>
          {sent ? (
            <div className="flex flex-col items-center py-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                <Check size={28} />
              </span>
              <p className="mt-3 font-semibold">Асуулт илгээгдлээ</p>
              <p className="mt-1 text-sm text-neutral-400">
                Багшийн хариуг{' '}
                <Link href="/questions" className="text-blue-400 hover:underline">
                  «Асуултууд»
                </Link>{' '}
                хэсгээс харна. Хариулахад нүүр хуудсанд мэдэгдэл гарна.
              </p>
              <button onClick={close} className="mt-5 w-full rounded-full bg-neutral-800 py-2.5 text-sm font-semibold hover:bg-neutral-700">
                Хаах
              </button>
            </div>
          ) : (
            <form onSubmit={send}>
              <textarea
                autoFocus
                value={text}
                maxLength={600}
                rows={4}
                onChange={(e) => setText(e.target.value)}
                placeholder="Юуг нь ойлгосонгүй вэ? Жишээ нь: 2-р алхам яагаад ийм болсон бэ?"
                className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500"
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={close} className="rounded-full bg-neutral-800 py-2.5 text-sm font-semibold hover:bg-neutral-700">
                  Болих
                </button>
                <button disabled={busy || !text.trim()} className="rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
                  {busy ? 'Илгээж байна…' : 'Илгээх'}
                </button>
              </div>
            </form>
          )}
        </Sheet>
      )}
    </>
  );
}
