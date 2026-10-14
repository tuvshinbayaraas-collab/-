import {lazy, Suspense} from 'react';
import Header from './components/Header';
import {CenterNote} from './components/Notices';
import Home from './pages/Home';
import {Link, useLocation} from './lib/router';

// The test pages carry the questions, figures and KaTeX, so they load on first visit.
const TestPage = lazy(() => import('./pages/TestPage'));
const Review = lazy(() => import('./pages/Review'));
const MyResults = lazy(() => import('./pages/MyResults'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/admin/Admin'));

export default function App() {
  const {path, query} = useLocation();
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);

  let page;
  if (path === '/') page = <Home />;
  else if (parts[0] === 'test' && parts.length === 2) page = <TestPage id={parts[1]} />;
  else if (parts[0] === 'review' && parts.length === 3) page = <Review test={parts[1]} id={parts[2]} uid={query.get('u') ?? undefined} />;
  else if (path === '/results') page = <MyResults />;
  else if (path === '/login') page = <Login />;
  else if (path === '/profile') page = <Profile />;
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
    <div className="min-h-screen">
      <Header />
      <main className="px-4 pb-10 pt-4 sm:px-6">
        <Suspense fallback={<p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>}>{page}</Suspense>
      </main>
    </div>
  );
}
