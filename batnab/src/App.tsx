import {WifiOff} from 'lucide-react';
import {lazy, Suspense, useEffect, useState, type ComponentType} from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import {InstallHelpHost} from './components/GetApp';
import GuideHost from './components/Guide';
import Header from './components/Header';
import {CenterNote} from './components/Notices';
import Home from './pages/Home';
import {Link, useLocation} from './lib/router';
import {useDbLost} from './lib/connection';
import {usePrefs} from './lib/prefs';
import {loadTest} from './tests';

// The test pages carry the questions, figures and KaTeX, so they load on first visit.
const TestPage = lazy(() => import('./pages/TestPage'));
const Review = lazy(() => import('./pages/Review'));
const MyResults = lazy(() => import('./pages/MyResults'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const Credits = lazy(() => import('./pages/Credits'));
/**
 * The credits page is tiny: it comes down in the background, so the footer link opens it at once. Once it's here it's
 * shown straight away (a lazy page would still show "Ачаалж байна…" for a moment).
 */
let CreditsReady: ComponentType | null = null;
let creditsWarm = false;
function warmCredits() {
  if (creditsWarm) return;
  creditsWarm = true;
  import('./pages/Credits').then(
    (m) => (CreditsReady = m.default),
    () => (creditsWarm = false),
  );
}
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));

export default function App() {
  const {path, query} = useLocation();
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);

  // A test's questions start downloading right away, alongside the page code and the sign-in check, not after them.
  const testId = (parts[0] === 'test' && parts.length === 2) || (parts[0] === 'review' && parts.length === 3) ? parts[1] : undefined;
  useEffect(() => {
    if (testId) loadTest(testId)?.catch(() => {});
  }, [testId]);

  // Once the first page is up and the browser has nothing else to do.
  useEffect(() => {
    // Safari has no requestIdleCallback: a short wait does the same there.
    const idle = window.requestIdleCallback as typeof requestIdleCallback | undefined;
    let id = 0;
    const later = () => (id = idle ? idle(warmCredits, {timeout: 4000}) : window.setTimeout(warmCredits, 2500));
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, {once: true});
    return () => {
      window.removeEventListener('load', later);
      if (idle) cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, []);

  // "Том үсэг" setting: every size on the site is in rem, so this scales them all.
  const {bigText} = usePrefs();
  useEffect(() => {
    document.documentElement.style.fontSize = bigText ? '112.5%' : '';
  }, [bigText]);

  let page;
  if (path === '/') page = <Home />;
  else if (parts[0] === 'test' && parts.length === 2) page = <TestPage id={parts[1]} />;
  else if (parts[0] === 'review' && parts.length === 3) page = <Review test={parts[1]} id={parts[2]} uid={query.get('u') ?? undefined} />;
  else if (path === '/results') page = <MyResults />;
  else if (path === '/login') page = <Login />;
  else if (path === '/profile') page = <Profile />;
  else if (path === '/credits') page = CreditsReady ? <CreditsReady /> : <Credits />;
  else if (path === '/leaderboard') page = <Leaderboard />;
  else if (path === '/settings') page = <SettingsPage />;
  else if (parts[0] === 'u' && parts.length === 2) page = <PublicProfile uid={parts[1]} />;
  else if (parts[0] === 'admin' && (parts.length === 1 || (parts[1] === 'student' && parts.length === 3))) page = <Admin student={parts[2]} />;
  else
    page = (
      <CenterNote title="Хуудас олдсонгүй">
        <Link href="/" className="text-blue-400 hover:underline">
          Нүүр хуудас руу буцах
        </Link>
      </CenterNote>
    );

  return (
    // A column as tall as the screen at least, so the footer sits at the very bottom even on a short page.
    <div className="flex min-h-screen flex-col supports-[min-height:100dvh]:min-h-dvh">
      <Header />
      <OfflineBar />
      <main className="flex-1 px-4 pb-10 pt-4 sm:px-6">
        <ErrorBoundary resetKey={path}>
          <Suspense fallback={<p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>}>{page}</Suspense>
        </ErrorBoundary>
      </main>
      {path !== '/credits' && (
        <footer className="px-4 pb-8 text-center text-xs text-neutral-500">
          <Link href="/credits" onPointerEnter={warmCredits} onTouchStart={warmCredits} onFocus={warmCredits} className="hover:text-neutral-300">
            © {new Date().getFullYear()} Batnab · Бүтээсэн: Баттүшиг
          </Link>
        </footer>
      )}
      <GuideHost />
      <InstallHelpHost />
    </div>
  );
}

/**
 * Shown while the device has no connection (e.g. the installed app opened offline), or is online but can't reach the
 * database for a while, so a page waiting on it doesn't look stuck.
 */
function OfflineBar() {
  const lost = useDbLost();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online && !lost) return null;
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200">
      <WifiOff size={16} className="shrink-0" />
      {online ? 'Сервертэй холбогдож чадахгүй байна. Холбогдмогц автоматаар үргэлжилнэ.' : 'Интернэт холболт алга. Холбогдоход автоматаар үргэлжилнэ.'}
      {online && (
        <button onClick={() => location.reload()} className="font-semibold text-amber-100 underline underline-offset-2">
          Дахин ачаалах
        </button>
      )}
    </p>
  );
}
