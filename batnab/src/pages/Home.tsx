import {ChevronRight, LogIn} from 'lucide-react';
import {inProgress} from '../lib/attempt';
import {signIn, useUser} from '../lib/auth';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {TESTS} from '../tests';

export default function Home() {
  const {user, ready} = useUser();
  const results = useMyResults();
  const groups = [...new Set(TESTS.map((t) => t.group))];
  const best = (id: string) => results?.filter((r) => r.test === id).reduce<number | null>((b, r) => (b === null || r.score > b ? r.score : b), null) ?? null;

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Математикийн тест</h1>
      <p className="mt-2 text-neutral-400">
        Тест бүр 30 бодлоготой. Тест өгөх бүрт бодлогуудын байр холилдоно. Дуусгахад оноо болон зөв хариултууд харагдана.
      </p>
      {ready && !user && (
        <button onClick={signIn} className="mt-4 flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10">
          <LogIn size={16} /> Нэвтэрвэл дүн тань хадгалагдана
        </button>
      )}

      <div className="mt-8 space-y-6">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Тест {g}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {TESTS.filter((t) => t.group === g).map((t) => {
                const top = best(t.id);
                const going = inProgress(t.id, t.count);
                return (
                  <Link key={t.id} href={`/test/${t.id}`} className="group flex items-center gap-4 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold">{t.title}</p>
                      <p className="text-sm text-neutral-400">
                        {t.count} бодлого
                        {top !== null && ` • Шилдэг: ${top}/${t.count}`}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-blue-400">
                      {going ? 'Үргэлжлүүлэх' : 'Эхлэх'} <ChevronRight size={16} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
