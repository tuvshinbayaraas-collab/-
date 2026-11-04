import {BookOpen, CircleHelp, Download, Flame, GraduationCap, ListChecks, LogIn, LogOut, MessageCircleQuestion, Moon, NotebookPen, Settings, Sun, Trophy, UserRound, Zap} from 'lucide-react';
import {lazy, Suspense, useState, type ReactNode} from 'react';
import {Link, useLocation} from '../lib/router';
import {logOut, shownName, useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {useWide} from '../lib/wide';
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

  // The pages as small tiles, three to a row (the menu fits a phone's screen); the account's own actions as rows.
  const item = (href: string, icon: ReactNode, label: string) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      aria-current={path === href ? 'page' : undefined}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-xs leading-tight hover:bg-neutral-700 ${path === href ? 'bg-neutral-700/70 text-neutral-50' : ''}`}
    >
      {icon}
      <span className="w-full break-words">{label}</span>
    </Link>
  );
  const row = 'flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-neutral-700';

  // On a computer, the main places as links beside the logo (on a phone they're in the menu under the avatar).
  const wide = useWide();
  const active = profile && !profile.disabled;
  const nav: [string, string][] = admin
    ? [
        ['/admin', 'Багшийн самбар'],
        ['/live', 'Шууд тэмцээн'],
        ['/admin/report', 'Тайлан'],
      ]
    : active
      ? [['/', 'Нүүр'], ['/topics', 'Сэдвүүд'], ['/daily', 'Өдрийн дасгал'], ['/results', 'Миний дүн'], ...(settings?.leaderboard ? ([['/leaderboard', 'Leaderboard']] as [string, string][]) : [])]
      : [];
  const here = (href: string) =>
    href === '/' ? path === '/' : path === href || (href !== '/admin' && path.startsWith(href + '/')) || (href === '/admin' && path.startsWith('/admin') && !path.startsWith('/admin/report'));

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-800/80 bg-page px-4 sm:px-6">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4">
        <Logo />
        {user && wide && nav.length > 0 && (
          <nav aria-label="Үндсэн цэс" className="mr-auto flex items-center gap-1">
            {nav.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={here(href) ? 'page' : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${here(href) ? 'bg-blue-500/15 text-blue-200' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        {user ? (
          <div className="flex items-center gap-2">
            {admin && !wide && path !== '/admin' && (
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
                  <div className="absolute right-0 top-11 z-50 max-h-[calc(100vh-4rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-xl bg-neutral-800 py-2 shadow-xl supports-[height:100dvh]:max-h-[calc(100dvh-4rem)]">
                    <div className="flex items-center gap-3 border-b border-neutral-700 px-4 pb-2.5 pt-1">
                      <Avatar name={name} photo={profile?.photo} size={40} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{name}</p>
                        <p className="truncate text-sm text-neutral-400">{profile ? `@${profile.username}` : ''}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-0.5 border-b border-neutral-700 px-2 py-2">
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
                    </div>
                    {guideRole && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          openGuide();
                        }}
                        className={row}
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
                        className={row}
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
                        className={row}
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
                      className={row}
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
      </div>
    </header>
  );
}
