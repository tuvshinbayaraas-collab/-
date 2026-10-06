import {BarChart3, History, Home, ThumbsUp, Upload, UserSquare, Users} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import {api} from '../lib/api';
import {useUser} from '../lib/auth';
import {Link} from '../lib/router';
import type {Subscription} from '../lib/types';
import Avatar from './Avatar';
import {ShortsLogo} from './ShortCard';
import {SUBS_CHANGED} from './SubscribeButton';

interface Props {
  path: string;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({path, open, onClose}: Props) {
  const {user} = useUser();
  const [subs, setSubs] = useState<Subscription[]>([]);

  useEffect(() => {
    const load = () => api.mySubscriptions().then(setSubs, () => setSubs([]));
    load();
    window.addEventListener(SUBS_CHANGED, load);
    return () => window.removeEventListener(SUBS_CHANGED, load);
  }, [user?.uid]);

  const main: Array<{href: string; label: string; icon: ReactNode}> = [
    {href: '/', label: 'Нүүр', icon: <Home size={22} />},
    {href: '/shorts', label: 'Shorts', icon: <ShortsLogo />},
    {href: '/subscriptions', label: 'Захиалгууд', icon: <Users size={22} />},
  ];
  const mine: Array<{href: string; label: string; icon: ReactNode}> = [
    ...(user ? [{href: `/channel/${user.uid}`, label: 'Миний суваг', icon: <UserSquare size={22} />}] : []),
    ...(user ? [{href: '/studio', label: 'Үзүүлэлт', icon: <BarChart3 size={22} />}] : []),
    {href: '/upload', label: 'Бичлэг оруулах', icon: <Upload size={22} />},
    {href: '/history', label: 'Үзсэн түүх', icon: <History size={22} />},
    {href: '/liked', label: 'Таалагдсан', icon: <ThumbsUp size={22} />},
  ];

  const close = () => window.innerWidth < 1024 && onClose();
  const item = (it: {href: string; label: string; icon: ReactNode}) => {
    const active = it.href === '/' ? path === '/' : path.startsWith(it.href);
    return (
      <Link
        key={it.href}
        href={it.href}
        onClick={close}
        className={`flex items-center gap-5 rounded-lg px-3 py-2.5 text-sm ${
          active ? 'bg-neutral-800 font-semibold' : 'hover:bg-neutral-800/70'
        }`}
      >
        {it.icon}
        {it.label}
      </Link>
    );
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <nav
        className={`fixed top-14 bottom-0 left-0 z-40 w-60 overflow-y-auto bg-[#0f0f0f] p-3 transition-transform lg:z-20 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {main.map(item)}
        <div className="my-3 border-t border-neutral-800" />
        {mine.map(item)}
        {subs.length > 0 && (
          <>
            <div className="my-3 border-t border-neutral-800" />
            <p className="px-3 pb-1 text-sm font-semibold">Захиалсан сувгууд</p>
            {subs.map((s) => (
              <Link
                key={s.uid}
                href={`/channel/${s.uid}`}
                onClick={close}
                className={`flex items-center gap-4 rounded-lg px-3 py-2 text-sm ${
                  path === `/channel/${s.uid}` ? 'bg-neutral-800 font-semibold' : 'hover:bg-neutral-800/70'
                }`}
              >
                <Avatar name={s.name} photo={s.photo} size={24} />
                <span className="truncate">{s.name}</span>
              </Link>
            ))}
          </>
        )}
        <p className="mt-6 border-t border-neutral-800 px-3 pt-4 text-xs text-neutral-500">© {new Date().getFullYear()} Batnab</p>
      </nav>
    </>
  );
}
