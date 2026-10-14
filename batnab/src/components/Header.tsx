import {LogIn, LogOut} from 'lucide-react';
import {useState} from 'react';
import {displayName, logOut, signIn, useUser} from '../lib/auth';
import Avatar from './Avatar';
import Logo from './Logo';

export default function Header() {
  const {user, ready} = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 bg-[#0f0f0f] px-4">
      <Logo />
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
            Нэвтрэх
          </button>
        )
      )}
    </header>
  );
}
