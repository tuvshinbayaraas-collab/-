import {ArrowLeft, BarChart3, LogIn, LogOut, Menu, Search, Upload, UserSquare} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {Link, navigate} from '../lib/router';
import {displayName, logOut, signIn, useUser} from '../lib/auth';
import Avatar from './Avatar';
import Logo from './Logo';

export default function Header({query, onMenu}: {query: string; onMenu: () => void}) {
  const [text, setText] = useState(query);
  const [mobileSearch, setMobileSearch] = useState(false);
  const {user, ready} = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setText(query), [query]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setMobileSearch(false);
    navigate(`/results?search_query=${encodeURIComponent(q)}`);
  };

  const searchForm = (
    <form onSubmit={submit} className="flex flex-1 max-w-xl items-center">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Хайх"
        aria-label="Хайх"
        autoFocus={mobileSearch}
        className="h-10 w-full min-w-0 rounded-l-full border border-neutral-700 bg-neutral-950 px-4 text-[15px] outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        aria-label="Хайх"
        className="h-10 w-16 shrink-0 rounded-r-full border border-l-0 border-neutral-700 bg-neutral-800 flex items-center justify-center hover:bg-neutral-700"
      >
        <Search size={20} />
      </button>
    </form>
  );

  if (mobileSearch) {
    return (
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-[#0f0f0f] px-2">
        <button onClick={() => setMobileSearch(false)} className="p-2 rounded-full hover:bg-neutral-800" aria-label="Буцах">
          <ArrowLeft size={22} />
        </button>
        {searchForm}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 bg-[#0f0f0f] px-2 sm:px-4">
      <div className="flex items-center gap-2">
        <button onClick={onMenu} className="p-2 rounded-full hover:bg-neutral-800" aria-label="Цэс">
          <Menu size={22} />
        </button>
        <Logo />
      </div>

      <div className="hidden sm:flex flex-1 justify-center">{searchForm}</div>

      <div className="flex items-center gap-1 sm:gap-3">
        <button
          onClick={() => setMobileSearch(true)}
          className="sm:hidden p-2 rounded-full hover:bg-neutral-800"
          aria-label="Хайх"
        >
          <Search size={22} />
        </button>
        <Link
          href="/upload"
          className="flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-2 text-sm font-medium hover:bg-neutral-700"
        >
          <Upload size={18} />
          <span className="hidden md:inline">Бичлэг оруулах</span>
        </Link>
        {user ? (
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} aria-label="Миний бүртгэл" className="block rounded-full">
              <Avatar name={displayName(user)} photo={user.photoURL} size={32} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl bg-neutral-800 py-2 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-neutral-700 px-4 pb-3 pt-1">
                    <Avatar name={displayName(user)} photo={user.photoURL} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{displayName(user)}</p>
                      {user.email && <p className="truncate text-sm text-neutral-400">{user.email}</p>}
                    </div>
                  </div>
                  <Link
                    href={`/channel/${user.uid}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700"
                  >
                    <UserSquare size={20} /> Миний суваг
                  </Link>
                  <Link
                    href="/studio"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700"
                  >
                    <BarChart3 size={20} /> Үзүүлэлт
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logOut();
                    }}
                    className="flex w-full items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700"
                  >
                    <LogOut size={20} /> Гарах
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          ready && (
            <button
              onClick={signIn}
              className="flex items-center gap-2 rounded-full border border-neutral-700 px-3 py-1.5 text-sm font-medium text-blue-400 hover:bg-blue-500/10"
            >
              <LogIn size={18} />
              <span className="hidden sm:inline">Нэвтрэх</span>
            </button>
          )
        )}
      </div>
    </header>
  );
}
