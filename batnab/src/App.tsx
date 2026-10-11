import {lazy, Suspense, useEffect, useState} from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import {EmptyState} from './components/VideoCard';
import Home from './pages/Home';

// Home is the landing page; everything else loads on first visit.
const Channel = lazy(() => import('./pages/Channel'));
const Library = lazy(() => import('./pages/Library'));
const Admin = lazy(() => import('./pages/Admin'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Playlist = lazy(() => import('./pages/Playlist'));
const Playlists = lazy(() => import('./pages/Playlists'));
const Results = lazy(() => import('./pages/Results'));
const Shorts = lazy(() => import('./pages/Shorts'));
const Studio = lazy(() => import('./pages/Studio'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Upload = lazy(() => import('./pages/Upload'));
const Watch = lazy(() => import('./pages/Watch'));
import {parseClock} from './lib/playback';
import {Link, useLocation} from './lib/router';

const isDesktop = () => window.innerWidth >= 1024;

/** ?t=95, ?t=95s or ?t=1:35 -> seconds. */
function startTime(t: string | null): number | undefined {
  if (!t) return undefined;
  const n = /^\d+s?$/.test(t) ? parseInt(t, 10) : parseClock(t);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function App() {
  const {path, query} = useLocation();
  const isWatch = path === '/watch';
  const [sidebarOpen, setSidebarOpen] = useState(() => isDesktop() && !isWatch);

  // The watch page uses the full width, like YouTube; elsewhere keep the menu open on desktop.
  useEffect(() => setSidebarOpen(isDesktop() && !isWatch), [isWatch]);

  const search = query.get('search_query') ?? '';
  const pushContent = sidebarOpen && !isWatch;

  let page;
  if (path === '/') page = <Home />;
  else if (path === '/watch' && query.get('v')) page = <Watch id={query.get('v')!} highlight={query.get('lc') ?? undefined} startAt={startTime(query.get('t'))} list={query.get('list') ?? undefined} />;
  else if (path === '/results') page = <Results query={search} />;
  else if (path === '/shorts' || path.startsWith('/shorts/'))
    page = <Shorts startId={path.split('/')[2] ? decodeURIComponent(path.split('/')[2]) : undefined} />;
  else if (path === '/subscriptions') page = <Subscriptions />;
  else if (path === '/studio') page = <Studio />;
  else if (path === '/notifications') page = <Notifications />;
  else if (path === '/playlists') page = <Playlists />;
  else if (path === '/admin') page = <Admin />;
  else if (path === '/playlist' && query.get('list')) page = <Playlist list={query.get('list')!} />;
  else if (path === '/upload') page = <Upload />;
  else if (path === '/history') page = <Library kind="history" />;
  else if (path === '/liked') page = <Library kind="liked" />;
  else if (path.startsWith('/channel/')) page = <Channel uid={decodeURIComponent(path.slice('/channel/'.length))} />;
  else
    page = (
      <EmptyState title="Хуудас олдсонгүй">
        <Link href="/" className="text-blue-400 hover:underline">
          Нүүр хуудас руу буцах
        </Link>
      </EmptyState>
    );

  return (
    <div className="min-h-screen">
      <Header query={search} onMenu={() => setSidebarOpen((o) => !o)} />
      <Sidebar path={path} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {isWatch && sidebarOpen && <div className="fixed inset-0 z-30 hidden bg-black/60 lg:block" onClick={() => setSidebarOpen(false)} />}
      <main className={`px-4 pb-10 pt-4 sm:px-6 ${pushContent ? 'lg:pl-[264px]' : ''}`}>
        <Suspense fallback={<PageSpinner />}>{page}</Suspense>
      </main>
    </div>
  );
}

function PageSpinner() {
  return (
    <div className="flex justify-center py-24" aria-label="Ачаалж байна">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-700 border-t-white" />
    </div>
  );
}
