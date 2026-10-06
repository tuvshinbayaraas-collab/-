import {useEffect, useState} from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import {EmptyState} from './components/VideoCard';
import Channel from './pages/Channel';
import Home from './pages/Home';
import Library from './pages/Library';
import Results from './pages/Results';
import Notifications from './pages/Notifications';
import Shorts from './pages/Shorts';
import Studio from './pages/Studio';
import Subscriptions from './pages/Subscriptions';
import Upload from './pages/Upload';
import Watch from './pages/Watch';
import {Link, useLocation} from './lib/router';

const isDesktop = () => window.innerWidth >= 1024;

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
  else if (path === '/watch' && query.get('v')) page = <Watch id={query.get('v')!} highlight={query.get('lc') ?? undefined} />;
  else if (path === '/results') page = <Results query={search} />;
  else if (path === '/shorts' || path.startsWith('/shorts/'))
    page = <Shorts startId={path.split('/')[2] ? decodeURIComponent(path.split('/')[2]) : undefined} />;
  else if (path === '/subscriptions') page = <Subscriptions />;
  else if (path === '/studio') page = <Studio />;
  else if (path === '/notifications') page = <Notifications />;
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
      <main className={`px-4 pb-10 pt-4 sm:px-6 ${pushContent ? 'lg:pl-[264px]' : ''}`}>{page}</main>
    </div>
  );
}
