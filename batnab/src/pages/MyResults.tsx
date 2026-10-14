import {LogIn} from 'lucide-react';
import {formatTime} from '../lib/attempt';
import {signIn, useUser} from '../lib/auth';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {testInfo} from '../tests';

const date = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function MyResults() {
  const {user, ready} = useUser();
  const results = useMyResults();

  if (ready && !user) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <p className="text-neutral-400">Дүнгээ харахын тулд нэвтэрнэ үү.</p>
        <button onClick={signIn} className="mt-4 flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 font-semibold text-black hover:bg-blue-400">
          <LogIn size={18} /> Google-ээр нэвтрэх
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="text-2xl font-bold">Миний дүнгүүд</h1>
      {results === null ? (
        <p className="mt-6 text-neutral-400">Ачаалж байна…</p>
      ) : !results.length ? (
        <p className="mt-6 text-neutral-400">
          Одоогоор дүн алга.{' '}
          <Link href="/" className="text-blue-400 hover:underline">
            Тест өгөх
          </Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/test/${r.test}`} className="font-semibold hover:underline">
                  {testInfo(r.test)?.title ?? r.test}
                </Link>
                <p className="text-sm text-neutral-400">
                  {date(r.at)} • {formatTime(r.seconds)}
                </p>
              </div>
              <p className="text-right">
                <span className="text-lg font-bold">
                  {r.score}/{r.total}
                </span>
                <span className="ml-2 text-sm text-neutral-400">{Math.round((r.score / r.total) * 100)}%</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
