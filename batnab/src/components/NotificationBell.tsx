import {Bell, CheckCheck, Settings} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {
  desktopNotify,
  markRead,
  notificationText,
  removeNotification,
  useNotifications,
  type AppNotification,
} from '../lib/notifications';
import {Link} from '../lib/router';
import NotificationItem from './NotificationItem';

export default function NotificationBell() {
  const {items, loaded, unread} = useNotifications();
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  // Tab title badge, plus a browser notification for new items while the tab is hidden.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, '');
    document.title = unread ? `(${unread > 99 ? '99+' : unread}) ${base}` : base;
  }, [unread, items]);

  useEffect(() => {
    if (!loaded) return;
    if (seen.current === null) {
      seen.current = new Set(items.map((n) => n.id));
      return;
    }
    const fresh = items.filter((n) => !seen.current!.has(n.id));
    fresh.forEach((n) => seen.current!.add(n.id));
    if (fresh.length && document.hidden && desktopNotify.enabled()) {
      for (const n of fresh.slice(0, 3)) {
        try {
          new Notification('Batnab', {body: notificationText(n), icon: n.actorPhoto, tag: n.id});
        } catch {
          // Some mobile browsers only allow notifications from a service worker.
        }
      }
    }
  }, [items, loaded]);

  const openItem = (n: AppNotification) => {
    setOpen(false);
    if (!n.read) markRead([n.id]).catch(() => {});
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 hover:bg-neutral-800"
        aria-label={unread ? `Мэдэгдэл, ${unread} уншаагүй` : 'Мэдэгдэл'}
        aria-expanded={open}
      >
        <Bell size={22} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-2 top-14 z-50 flex max-h-[calc(100dvh-72px)] flex-col overflow-hidden rounded-xl bg-neutral-900 shadow-2xl ring-1 ring-neutral-800 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[420px] sm:max-h-[min(640px,calc(100dvh-80px))]">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <p className="font-semibold">Мэдэгдэл</p>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))}
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-blue-400 hover:bg-neutral-800"
                  >
                    <CheckCheck size={14} /> Бүгдийг уншсан
                  </button>
                )}
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-neutral-300 hover:bg-neutral-800"
                  aria-label="Мэдэгдлийн тохиргоо"
                >
                  <Settings size={18} />
                </Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!loaded ? (
                <p className="p-6 text-center text-sm text-neutral-400">Ачаалж байна…</p>
              ) : !items.length ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <Bell size={44} className="text-neutral-600" />
                  <p className="mt-3 font-semibold">Мэдэгдэл алга</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    Таны бичлэгт сэтгэгдэл бичих, сувгийг тань захиалах, захиалсан суваг шинэ бичлэг гаргахад энд мэдэгдэнэ.
                  </p>
                </div>
              ) : (
                items.slice(0, 30).map((n) => (
                  <NotificationItem key={n.id} n={n} onOpen={openItem} onRemove={(x) => removeNotification(x.id)} />
                ))
              )}
            </div>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="border-t border-neutral-800 px-4 py-3 text-center text-sm font-semibold text-blue-400 hover:bg-neutral-800"
            >
              Бүх мэдэгдлийг харах
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
