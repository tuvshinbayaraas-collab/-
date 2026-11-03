import {Loader2, RefreshCw, WifiOff} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useDbConnected} from '../lib/connection';

/** After this long a wait gets explained, with a way to try again. */
const SLOW = 6000;

/**
 * "Ачаалж байна…" that doesn't leave one guessing: a spinner at once; if it takes a while, what's likely wrong (no
 * internet, the server out of reach, or just a slow connection), that nothing is lost, and «Дахин оролдох» (reload the
 * page, or `retry`). `what`: what is loading ("Тестийг ачаалж байна…"); `small`: inside a section, not a whole page.
 */
export default function Loading({what = 'Ачаалж байна…', small, retry}: {what?: string; small?: boolean; retry?: () => void}) {
  const [slow, setSlow] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const db = useDbConnected();
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      clearTimeout(t);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  const why = !online
    ? 'Интернэт холболт алга байна. Холбогдмогц өөрөө үргэлжилнэ.'
    : !db
      ? 'Сервертэй холбогдож чадахгүй байна (сүлжээ сул эсвэл хаагдсан байж магадгүй).'
      : 'Интернэт сул эсвэл сервер ачаалалтай байж магадгүй.';
  return (
    <div role="status" aria-live="polite" className={`mx-auto flex max-w-sm flex-col items-center text-center ${small ? 'py-10' : 'py-24'}`}>
      <p className="flex items-center gap-2 text-neutral-400">
        <Loader2 size={18} className="animate-spin text-blue-400 motion-reduce:animate-none" /> {what}
      </p>
      {slow && (
        <div className="mt-4 animate-[saved-in_.3s_ease-out] space-y-3">
          <p className="flex items-start justify-center gap-2 text-sm text-neutral-300">
            {!online && <WifiOff size={16} className="mt-0.5 shrink-0 text-amber-300" />}
            <span>Удаж байна. {why} Хариулт, дүн тань алга болохгүй.</span>
          </p>
          <button
            type="button"
            onClick={retry ?? (() => location.reload())}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm font-semibold hover:bg-neutral-700"
          >
            <RefreshCw size={16} /> Дахин оролдох
          </button>
        </div>
      )}
    </div>
  );
}
