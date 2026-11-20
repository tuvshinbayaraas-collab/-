import {Bell as BellIcon, BellRing, CalendarClock, ClipboardCheck, Megaphone, MessageCircleQuestion, MessageCircleReply, Sparkles, Trophy, X, Zap} from 'lucide-react';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {canNotify, clearNotes, showSystemNote, useNotes, type Note, type NoteKind} from '../lib/notifications';
import {Link} from '../lib/router';
import {timeAgo} from '../pages/admin/data';

const ICONS: Record<NoteKind, [ReactNode, string]> = {
  task: [<ClipboardCheck key="t" size={16} />, 'bg-blue-500/15 text-blue-300'],
  due: [<CalendarClock key="d" size={16} />, 'bg-amber-500/15 text-amber-300'],
  news: [<Megaphone key="n" size={16} />, 'bg-sky-500/15 text-sky-300'],
  exam: [<CalendarClock key="e" size={16} />, 'bg-red-500/15 text-red-300'],
  mark: [<ClipboardCheck key="m" size={16} />, 'bg-violet-500/15 text-violet-300'],
  reply: [<MessageCircleReply key="r" size={16} />, 'bg-green-500/15 text-green-300'],
  medal: [<Trophy key="md" size={16} />, 'bg-amber-500/15 text-amber-300'],
  unlock: [<Sparkles key="ul" size={16} />, 'bg-violet-500/15 text-violet-300'],
  live: [<Zap key="l" size={16} />, 'bg-pink-500/15 text-pink-300'],
  question: [<MessageCircleQuestion key="q" size={16} />, 'bg-green-500/15 text-green-300'],
  check: [<ClipboardCheck key="c" size={16} />, 'bg-violet-500/15 text-violet-300'],
};

/** The header's bell: how many notes are new, and the list (opening it marks them seen; a student may clear it). */
export default function Bell() {
  const {notes, seen, fresh, markAll, canClear, hide} = useNotes();
  const [error, setError] = useState('');
  const failed = (e: unknown) => setError(`Цэвэрлэж чадсангүй: ${(e as Error).message}`);
  const [open, setOpen] = useState(false);
  // What counted as new when the list was opened stays marked while it's open.
  const [shownSeen, setShownSeen] = useState(seen);
  const [permission, setPermission] = useState(() => (canNotify() ? Notification.permission : 'denied'));

  // The app's icon shows the count (an installed app, where the device allows it).
  useEffect(() => {
    const nav = navigator as Navigator & {setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void>};
    (fresh ? nav.setAppBadge?.(fresh) : nav.clearAppBadge?.())?.catch(() => {});
    // Signed out: no count left on the icon.
    return () => void nav.clearAppBadge?.()?.catch(() => {});
  }, [fresh]);

  // A note that arrives while the site is in another tab or app: on the device's own list too (again when one comes
  // back newer, as more answers to check in a topic).
  const told = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!notes) return;
    const key = (n: Note) => `${n.id}:${n.at}`;
    if (!told.current) {
      told.current = new Set(notes.map(key));
      return;
    }
    for (const n of notes)
      if (!told.current.has(key(n))) {
        told.current.add(key(n));
        if (n.at > seen) showSystemNote(n);
      }
  }, [notes, seen]);

  const toggle = () => {
    if (!open) {
      setShownSeen(seen);
      markAll();
    }
    setOpen(!open);
  };
  const ask = () => Notification.requestPermission().then(setPermission, () => {});

  return (
    <div className="relative">
      <button onClick={toggle} aria-label={fresh ? `Мэдэгдэл: ${fresh} шинэ` : 'Мэдэгдэл'} aria-expanded={open} className="relative block rounded-full p-1.5 text-neutral-300 hover:bg-neutral-800">
        {fresh ? <BellRing size={22} /> : <BellIcon size={22} />}
        {fresh > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[11px] font-bold leading-[18px] text-white">{fresh > 9 ? '9+' : fresh}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-2 top-14 z-50 max-h-[75dvh] overflow-y-auto rounded-xl bg-neutral-800 py-2 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96" role="dialog" aria-label="Мэдэгдэл">
            <div className="flex items-center gap-2 px-4 pb-2 pt-1">
              <p className="flex-1 font-semibold">Мэдэгдэл</p>
              {canClear && !!notes?.length && (
                <button type="button" onClick={() => (setError(''), clearNotes().catch(failed))} className="rounded-full px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-700">
                  Бүгдийг цэвэрлэх
                </button>
              )}
            </div>
            {error && <p className="px-4 pb-2 text-xs text-red-300">{error}</p>}
            {notes === null ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-400">Ачаалж байна…</p>
            ) : !notes.length ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-400">Шинэ мэдэгдэл алга.</p>
            ) : (
              <ul>
                {notes.slice(0, 40).map((n) => {
                  const [icon, tone] = ICONS[n.kind];
                  const isNew = n.at > shownSeen;
                  return (
                    <li key={n.id} className={`flex items-start hover:bg-neutral-700 ${isNew ? 'bg-blue-500/10' : ''}`}>
                      <Link href={n.href} onClick={() => setOpen(false)} className={`flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-4 ${canClear ? 'pr-1' : 'pr-4'}`}>
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-3 text-sm [overflow-wrap:anywhere]">{n.text}</span>
                          <span className="mt-0.5 block text-xs text-neutral-500">{timeAgo(n.at)}</span>
                        </span>
                        {isNew && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-400" aria-label="шинэ" />}
                      </Link>
                      {canClear && (
                        <button type="button" onClick={() => (setError(''), hide(n).catch(failed))} aria-label="Энэ мэдэгдлийг арилгах" className="mr-2 mt-2 shrink-0 rounded-full p-1.5 text-neutral-500 hover:bg-neutral-600 hover:text-neutral-200">
                          <X size={15} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canNotify() && permission === 'default' && (
              <button onClick={ask} className="mx-4 mt-2 block w-[calc(100%-2rem)] rounded-full bg-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-600">
                Утас, компьютерийн мэдэгдэлд харуулах
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
