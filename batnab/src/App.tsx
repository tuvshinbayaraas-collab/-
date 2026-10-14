import Header from './components/Header';
import Home from './pages/Home';
import {Link, useLocation} from './lib/router';

export default function App() {
  const {path} = useLocation();

  let page;
  if (path === '/') page = <Home />;
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
      <main className="px-4 pb-10 pt-4 sm:px-6">{page}</main>
    </div>
  );
}
