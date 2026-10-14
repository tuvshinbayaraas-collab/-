import {lazy, Suspense} from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import {Link, useLocation} from './lib/router';

// The test page carries the questions, figures and KaTeX, so it loads on first visit.
const TestPage = lazy(() => import('./pages/TestPage'));
const MyResults = lazy(() => import('./pages/MyResults'));

export default function App() {
  const {path} = useLocation();

  let page;
  if (path === '/') page = <Home />;
  else if (path.startsWith('/test/')) page = <TestPage id={decodeURIComponent(path.slice('/test/'.length))} />;
  else if (path === '/results') page = <MyResults />;
  else
    page = (
      <div className="flex flex-col items-center py-24 text-center">
        <h1 className="text-xl font-semibold">Хуудас олдсонгүй</h1>
        <Link href="/" className="mt-3 text-blue-400 hover:underline">
          Нүүр хуудас руу буцах
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-4 pb-10 pt-4 sm:px-6">
        <Suspense fallback={<p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>}>{page}</Suspense>
      </main>
    </div>
  );
}
