import {History, Home, ThumbsUp, Upload, UserSquare} from 'lucide-react';
import type {ReactNode} from 'react';
import {Link} from '../lib/router';
import {useUser} from '../lib/auth';

interface Props {
  path: string;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({path, open, onClose}: Props) {
  const {user} = useUser();
  const items: Array<{href: string; label: string; icon: ReactNode}> = [
    {href: '/', label: 'Нүүр', icon: <Home size={22} />},
    {href: '/upload', label: 'Бичлэг оруулах', icon: <Upload size={22} />},
    ...(user ? [{href: `/channel/${user.uid}`, label: 'Миний суваг', icon: <UserSquare size={22} />}] : []),
    {href: '/history', label: 'Үзсэн түүх', icon: <History size={22} />},
    {href: '/liked', label: 'Таалагдсан', icon: <ThumbsUp size={22} />},
  ];

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <nav
        className={`fixed top-14 bottom-0 left-0 z-40 w-60 overflow-y-auto bg-[#0f0f0f] p-3 transition-transform lg:z-20 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {items.map((item) => {
          const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => window.innerWidth < 1024 && onClose()}
              className={`flex items-center gap-5 rounded-lg px-3 py-2.5 text-sm ${
                active ? 'bg-neutral-800 font-semibold' : 'hover:bg-neutral-800/70'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
        <p className="mt-6 border-t border-neutral-800 px-3 pt-4 text-xs text-neutral-500">© {new Date().getFullYear()} Batnab</p>
      </nav>
    </>
  );
}
