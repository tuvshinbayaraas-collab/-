import {ChevronRight, RefreshCw} from 'lucide-react';
import {InactiveNote, LockedNote} from '../components/Notices';
import {formatDuration} from '../lib/attempt';
import {grade, percent, useKeys} from '../lib/keys';
import {formatDate, useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {TESTS, testInfo} from '../tests';
import {untilReset} from '../lib/week';

export default function MyResults() {
  const session = useSession();
  const results = useMyResults();
  const keys = useKeys(results ? results.map((r) => r.test) : []);

  if (session.ready && !session.user) return <LockedNote text="Дүнгээ харахын тулд нэвтэрнэ үү." />;
  if (session.ready && !session.profile) return <InactiveNote />;

  const graded = (results ?? []).map((r) => ({r, g: grade(r.answers, keys[r.test], testInfo(r.test)!.count)}));
  const taken = TESTS.filter((t) => graded.some((x) => x.r.test === t.id));

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="text-2xl font-bold">Миний дүнгүүд</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-400">
        <RefreshCw size={14} /> Энэ долоо хоногийн дүн. Баасан гараг бүрийн 24:00-д шинээр эхэлнэ ({untilReset()} үлдлээ).
      </p>
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
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {taken.map((t) => {
              const mine = graded.filter((x) => x.r.test === t.id);
              const best = mine.reduce<number | null>((b, x) => (x.g && (b === null || percent(x.g) > b) ? percent(x.g) : b), null);
              return (
                <div key={t.id} className="rounded-2xl bg-neutral-900 p-4">
                  <p className="text-sm text-neutral-400">{t.title}</p>
                  <p className="mt-1 text-2xl font-bold">{best === null ? '—' : `${best}%`}</p>
                  <p className="text-xs text-neutral-500">
                    шилдэг • {mine.length} удаа
                  </p>
                </div>
              );
            })}
          </div>

          <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-400">Бүх оролдлого</h2>
          <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
            {graded.map(({r, g}) => (
              <li key={r.id}>
                <Link href={`/review/${r.test}/${r.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-800/60">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{testInfo(r.test)?.title ?? r.test}</p>
                    <p className="text-sm text-neutral-400">
                      {formatDate(r.at)} • {formatDuration(r.seconds)}
                    </p>
                  </div>
                  <p className="text-right">
                    {g ? (
                      <>
                        <span className="text-lg font-bold">
                          {g.score}/{g.total}
                        </span>
                        <span className="ml-2 text-sm text-neutral-400">{percent(g)}%</span>
                      </>
                    ) : (
                      <span className="text-sm text-neutral-400">{keys[r.test] === undefined ? '…' : 'Түлхүүр хүлээж байна'}</span>
                    )}
                  </p>
                  <ChevronRight size={16} className="shrink-0 text-neutral-500" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
