import {Check, Copy, Mail, MoreHorizontal, X} from 'lucide-react';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {formatClock} from '../lib/playback';

interface Props {
  /** Absolute link to share. */
  url: string;
  title: string;
  /** Offer "start at the current time" (watch page). */
  currentTime?: number;
  onClose: () => void;
}

const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Share sheet: Facebook, Messenger, Telegram, WhatsApp, X, e-mail, the system share sheet and copy-link. */
export default function ShareDialog({url, title, currentTime, onClose}: Props) {
  const [atTime, setAtTime] = useState(false);
  const [copied, setCopied] = useState(false);
  const start = Math.floor(currentTime ?? 0);
  const link = useMemo(() => {
    if (!atTime || start < 1) return url;
    const u = new URL(url);
    u.searchParams.set('t', String(start));
    return u.toString();
  }, [url, atTime, start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const enc = encodeURIComponent;
  const targets: Array<{name: string; href: string; bg: string; icon: ReactNode}> = [
    {name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`, bg: '#1877f2', icon: <Glyph>f</Glyph>},
    ...(isPhone()
      ? [{name: 'Messenger', href: `fb-messenger://share/?link=${enc(link)}`, bg: '#0084ff', icon: <Glyph>m</Glyph>}]
      : []),
    {name: 'Telegram', href: `https://t.me/share/url?url=${enc(link)}&text=${enc(title)}`, bg: '#229ed9', icon: <Glyph>✈</Glyph>},
    {name: 'WhatsApp', href: `https://wa.me/?text=${enc(`${title} ${link}`)}`, bg: '#25d366', icon: <Glyph>W</Glyph>},
    {name: 'X', href: `https://twitter.com/intent/tweet?url=${enc(link)}&text=${enc(title)}`, bg: '#000', icon: <Glyph>𝕏</Glyph>},
    {name: 'И-мэйл', href: `mailto:?subject=${enc(title)}&body=${enc(link)}`, bg: '#525252', icon: <Mail size={22} />},
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      prompt('Холбоосыг хуулна уу:', link);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const systemShare = 'share' in navigator ? () => navigator.share({title, url: link}).catch(() => {}) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-2xl bg-neutral-900 p-5 sm:rounded-2xl" role="dialog" aria-label="Хуваалцах">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Хуваалцах</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-800" aria-label="Хаах">
            <X size={20} />
          </button>
        </div>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
          {targets.map((t) => (
            <a
              key={t.name}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs text-neutral-300 hover:text-white"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{background: t.bg}}>
                {t.icon}
              </span>
              {t.name}
            </a>
          ))}
          {systemShare && (
            <button onClick={systemShare} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs text-neutral-300 hover:text-white">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-700">
                <MoreHorizontal size={22} />
              </span>
              Бусад
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 p-2 pl-3">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Холбоос" />
          <button onClick={copy} className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Хуулагдлаа' : 'Хуулах'}
          </button>
        </div>
        {currentTime !== undefined && start >= 1 && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={atTime} onChange={(e) => setAtTime(e.target.checked)} className="h-4 w-4 accent-blue-500" />
            {formatClock(start)}-с эхлүүлэх
          </label>
        )}
      </div>
    </div>
  );
}

function Glyph({children}: {children: ReactNode}) {
  return <span className="text-2xl font-bold leading-none">{children}</span>;
}
