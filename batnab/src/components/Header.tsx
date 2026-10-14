import {Download, GraduationCap, ListChecks, LogIn, LogOut, UserRound} from 'lucide-react';
import {lazy, Suspense, useState, type ReactNode} from 'react';
import {install, useInstall} from '../lib/install';
import {Link, useLocation} from '../lib/router';
import {logOut, shownName, useSession} from '../lib/session';
import Avatar from './Avatar';
import Logo from './Logo';

const InstallHelp = lazy(() => import('./InstallHelp'));

export default function Header() {
  const {user, ready, profile, admin} = useSession();
  const {path} = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const app = useInstall();
  const name = shownName(profile);

  const getApp = async () => {
    setMenuOpen(false);
    if (!(await install())) setHelp(true); // no install dialog in this browser: show how to do it by hand
  };

  const item = (href: string, icon: ReactNode, label: string) => (
    <Link href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700">
      {icon} {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 bg-[#0f0f0f] px-4">
      <Logo />
      {user ? (
        <div className="flex items-center gap-2">
          {admin && path !== '/admin' && (
            <Link href="/admin" className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-blue-300 hover:bg-blue-500/10 sm:flex">
              <GraduationCap size={18} /> Багшийн самбар
            </Link>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} aria-label="Миний бүртгэл" className="block rounded-full">
              <Avatar name={name} photo={profile?.photo} size={32} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl bg-neutral-800 py-2 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-neutral-700 px-4 pb-3 pt-1">
                    <Avatar name={name} photo={profile?.photo} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{name}</p>
                      <p className="truncate text-sm text-neutral-400">{profile ? `@${profile.username}` : ''}</p>
                    </div>
                  </div>
                  {admin && item('/admin', <GraduationCap size={20} />, 'Багшийн самбар')}
                  {profile && !profile.disabled && (
                    <>
                      {!admin && item('/results', <ListChecks size={20} />, 'Миний дүнгүүд')}
                      {item('/profile', <UserRound size={20} />, 'Профайл')}
                    </>
                  )}
                  {!app.installed && (
                    <button onClick={getApp} className="flex w-full items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700">
                      <Download size={20} /> Апп татах
                      <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">туршилт</span>
                    </button>
                  )}
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
        </div>
      ) : (
        ready &&
        path !== '/login' && (
          <Link href="/login" className="flex items-center gap-2 rounded-full border border-neutral-700 px-3 py-1.5 text-sm font-medium text-blue-400 hover:bg-blue-500/10">
            <LogIn size={18} />
            Нэвтрэх
          </Link>
        )
      )}
      {help && (
        <Suspense fallback={null}>
          <InstallHelp onClose={() => setHelp(false)} />
        </Suspense>
      )}
    </header>
  );
}
