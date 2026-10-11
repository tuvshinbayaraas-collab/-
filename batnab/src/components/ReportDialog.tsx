import {Check, Flag, X} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {errorMessage} from '../lib/api';
import {AlreadyReported, REASONS, submitReport, type ReportReason} from '../lib/moderation';

interface Props {
  target: {type: 'video' | 'comment'; videoId: string; videoTitle: string; commentId?: string};
  onClose: () => void;
}

/** "Мэдээлэх": tell the site admins a video or comment breaks the rules. */
export default function ReportDialog({target, onClose}: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setState('sending');
    setError('');
    try {
      await submitReport({...target, reason, details});
      setState('done');
    } catch (err) {
      if (err instanceof AlreadyReported) setState('done');
      else {
        setError(errorMessage(err));
        setState('form');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl bg-neutral-900 sm:rounded-2xl" role="dialog" aria-label="Мэдээлэх">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Flag size={18} /> {target.type === 'comment' ? 'Сэтгэгдлийг мэдээлэх' : 'Бичлэгийг мэдээлэх'}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-800" aria-label="Хаах">
            <X size={20} />
          </button>
        </div>
        {state === 'done' ? (
          <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600/20 text-green-400">
              <Check size={26} />
            </span>
            <p className="mt-3 font-semibold">Баярлалаа!</p>
            <p className="mt-1 text-sm text-neutral-400">Таны мэдээллийг сайтын хянагч шалгах болно.</p>
            <button onClick={onClose} className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200">
              Хаах
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="px-5 pb-4">
            <p className="mb-2 text-sm text-neutral-400">Юу буруу байна вэ?</p>
            <div className="space-y-1">
              {(Object.keys(REASONS) as ReportReason[]).map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-neutral-800">
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-blue-500" />
                  <span className="text-sm">{REASONS[r]}</span>
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Нэмэлт тайлбар (заавал биш)"
              className="mt-3 w-full resize-none rounded-lg border border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-white"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm hover:bg-neutral-800">
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={!reason || state === 'sending'}
                className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
              >
                {state === 'sending' ? 'Илгээж байна…' : 'Мэдээлэх'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
