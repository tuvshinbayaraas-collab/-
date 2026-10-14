import {ChevronRight, FlaskConical, GraduationCap, Lock, LogIn} from 'lucide-react';
import {InactiveNote, loginHref} from '../components/Notices';
import {inProgress} from '../lib/attempt';
import {grade, percent, useKeys, type Grade} from '../lib/keys';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {isStudent, shownName, useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {TESTS, testInfo} from '../tests';

export default function Home() {
  const session = useSession();
  const settings = useSettings();
  const results = useMyResults();
  const student = isStudent(session);
  const keys = useKeys(student && results ? results.map((r) => r.test) : []);
  const groups = [...new Set(TESTS.map((t) => t.group))];
  const owner = session.user?.uid ?? 'guest';
  const trial = settings?.trial ? testInfo(settings.trial) : undefined;

  if (session.ready && session.user && !session.admin && !student) return <InactiveNote blocked={!!session.profile?.disabled} />;

  const best = (id: string) =>
    (results ?? [])
      .filter((r) => r.test === id)
      .map((r) => grade(r.answers, keys[id], testInfo(id)!.count))
      .reduce<Grade | null>((b, g) => (g && (!b || percent(g) > percent(b)) ? g : b), null);

  return (
    <div className="mx-auto max-w-3xl py-6">
      {student ? (
        <>
          <h1 className="text-2xl font-bold sm:text-3xl">Сайн уу, {shownName(session.profile)}!</h1>
          <p className="mt-2 text-neutral-400">Тест бүр 30 бодлоготой. Тест өгөх бүрт бодлогуудын байр холилдоно.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold sm:text-3xl">Математикийн тест</h1>
          <p className="mt-2 text-neutral-400">Тест бүр 30 бодлоготой. Тест өгөх бүрт бодлогуудын байр холилдоно. Дуусгахад оноо болон зөв хариултууд харагдана.</p>
        </>
      )}

      {session.ready && !session.user && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/login" className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 font-semibold text-black hover:bg-blue-400">
            <LogIn size={18} /> Нэвтрэх
          </Link>
          {trial && (
            <Link href={`/test/${trial.id}`} className="flex items-center gap-2 rounded-full border border-neutral-700 px-5 py-2 font-medium text-blue-400 hover:bg-blue-500/10">
              <FlaskConical size={18} /> Туршилтаар өгөх
            </Link>
          )}
        </div>
      )}
      {session.admin && (
        <Link href="/admin" className="mt-5 flex items-center gap-3 rounded-2xl bg-blue-500/10 p-4 text-blue-300 hover:bg-blue-500/15">
          <GraduationCap size={22} />
          <span className="flex-1 font-semibold">Багшийн самбар: сурагчид, түлхүүр, анализ</span>
          <ChevronRight size={18} />
        </Link>
      )}

      <div className="mt-8 space-y-6">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Тест {g}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {TESTS.filter((t) => t.group === g).map((t) => {
                const locked = session.ready && !session.user && trial?.id !== t.id;
                const mine = (results ?? []).filter((r) => r.test === t.id);
                const top = best(t.id);
                const going = inProgress(owner, t.id, t.count);
                const done = !going && mine.length > 0 && student && settings?.retakes === false;
                const action = locked ? 'Нэвтэрч өгнө' : going ? 'Үргэлжлүүлэх' : done ? 'Хариултаа харах' : mine.length ? 'Дахин өгөх' : 'Эхлэх';
                return (
                  <Link
                    key={t.id}
                    href={locked ? loginHref(`/test/${t.id}`) : done ? `/review/${t.id}/${mine[0].id}` : `/test/${t.id}`}
                    className={`group flex items-center gap-4 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800 ${locked ? 'opacity-70' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-lg font-semibold">
                        {t.title}
                        {!session.user && trial?.id === t.id && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">Туршилт</span>}
                      </p>
                      <p className="text-sm text-neutral-400">
                        {t.count} бодлого
                        {mine.length > 0 && ` • ${mine.length} удаа өгсөн`}
                        {top && ` • Шилдэг: ${top.score}/${top.total}`}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-blue-400">
                      {locked && <Lock size={14} />}
                      {action} {!locked && <ChevronRight size={16} />}
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
