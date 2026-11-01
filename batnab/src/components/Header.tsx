import {BookOpen, CircleHelp, Download, Flame, GraduationCap, ListChecks, LogIn, LogOut, MessageCircleQuestion, Moon, NotebookPen, Settings, Sun, Trophy, UserRound, Zap} from 'lucide-react';
import {lazy, Suspense, useState, type ReactNode} from 'react';
import {Link, useLocation} from '../lib/router';
import {logOut, shownName, useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {lightSupported, useTheme} from '../lib/theme';
import Avatar from './Avatar';
import {openGuide} from '../lib/guide';
import {BetaBadge, useGetApp} from './GetApp';
import {useGuideRole} from './Guide';
import Logo from './Logo';

// The bell and its list come in their own file, after the page (it reads a fair bit to know what's new).
const Bell = lazy(() => import('./Bell'));

export default function Header() {
  const {user, ready, profile, admin} = useSession();
  const {path} = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const app = useGetApp();
  const guideRole = useGuideRole();
  const settings = useSettings();
  const name = shownName(profile);
  // What's on the page now ("Төхөөрөмжийн" included): the menu offers the other one.
  const {light, setTheme} = useTheme();

  const item = (href: string, icon: ReactNode, label: string) => (
    <Link href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700">
      {icon} {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 bg-page px-4">
      <Logo />
      {user ? (
        <div className="flex items-center gap-2">
          {admin && path !== '/admin' && (
            <Link href="/admin" className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-blue-300 hover:bg-blue-500/10 sm:flex">
              <GraduationCap size={18} /> Багшийн самбар
            </Link>
          )}
          {(admin || (profile && !profile.disabled)) && (
            <Suspense fallback={<span className="block h-[34px] w-[34px]" />}>
              <Bell />
            </Suspense>
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
                      {item('/topics', <BookOpen size={20} />, 'Сэдвүүд')}
                      {item('/live', <Zap size={20} />, 'Шууд тэмцээн')}
                      {!admin && item('/daily', <Flame size={20} />, 'Өдрийн дасгал')}
                      {!admin && item('/mistakes', <NotebookPen size={20} />, 'Алдааны дэвтэр')}
                      {!admin && item('/questions', <MessageCircleQuestion size={20} />, 'Асуултууд')}
                      {settings?.leaderboard && item('/leaderboard', <Trophy size={20} />, 'Leaderboard')}
                      {item('/profile', <UserRound size={20} />, 'Профайл')}
                      {item('/settings', <Settings size={20} />, 'Тохиргоо')}
                    </>
                  )}
                  {guideRole && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        openGuide();
                      }}
                      className="flex w-full items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700"
                    >
                      <CircleHelp size={20} /> Заавар
                    </button>
                  )}
                  {lightSupported && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setTheme(light ? 'dark' : 'light');
                      }}
                      className="flex w-full items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700"
                    >
                      {light ? <Moon size={20} /> : <Sun size={20} />} {light ? 'Бараан загвар' : 'Гэрэлтэй загвар'}
                    </button>
                  )}
                  {!app.installed && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        app.start();
                      }}
                      className="flex w-full items-center gap-4 px-4 py-2.5 text-sm hover:bg-neutral-700"
                    >
                      <Download size={20} /> Апп татах
                      <span className="ml-auto">
                        <BetaBadge />
                      </span>
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
        ready && (
          <div className="flex items-center gap-1">
            <button onClick={openGuide} aria-label="Заавар" title="Заавар" className="rounded-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">
              <CircleHelp size={20} />
            </button>
            {path !== '/login' && (
              <Link href="/login" className="flex items-center gap-2 rounded-full border border-neutral-700 px-3 py-1.5 text-sm font-medium text-blue-400 hover:bg-blue-500/10">
                <LogIn size={18} />
                Нэвтрэх
              </Link>
            )}
          </div>
        )
      )}
    </header>
  );
}
