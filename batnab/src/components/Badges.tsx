import {Award} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useMyQuestions} from '../lib/classroom';
import {grade} from '../lib/keys';
import {useHistory} from '../lib/history';
import {useMedals} from '../lib/leaderboard';
import type {Result} from '../lib/results';
import {badges, useStats, type BadgeFacts} from '../lib/stats';
import {readKey, useProgress, useTopics} from '../lib/topics';
import {testInfo} from '../tests';
import {isPerfect} from './Perfect';

/** What a student's badges are worked out from (their own data, or any student's for the teacher). */
export function useBadgeFacts(uid: string | undefined, results: Result[] | null, keys: Record<string, string | null | undefined>): BadgeFacts | null {
  const history = useHistory(uid);
  const stats = useStats(uid);
  const progress = useProgress(uid);
  const topics = useTopics();
  const medals = useMedals(uid, true);
  const questions = useMyQuestions(uid);
  const [master, setMaster] = useState(false);

  const done = (topics ?? []).filter((t) => {
    const ps = t.problems.filter((p) => p.k);
    return ps.length > 0 && ps.every((p) => progress?.[t.id]?.[p.id]);
  });
  const doneSig = done.map((t) => t.id).join(',');
  // "Сэдвийн мастер": every first answer right in a finished topic (the keys are readable once answered).
  useEffect(() => {
    let live = true;
    (async () => {
      for (const t of done) {
        const ps = t.problems.filter((p) => p.k);
        const ok = await Promise.all(ps.map(async (p) => (await readKey(t.id, p.id).catch(() => null)) === progress?.[t.id]?.[p.id]?.a));
        if (ok.every(Boolean)) return live && setMaster(true);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneSig]);

  if (!history || !stats || !progress || !topics || !results) return null;
  const weeks = Object.keys(history).length + (results.length ? 1 : 0);
  const perfect =
    results.some((r) => isPerfect(grade(r.answers, keys[r.test], testInfo(r.test)?.count ?? 30))) ||
    Object.values(history).some((w) => Object.entries(w).some(([t, v]) => typeof v.score === 'number' && v.score === v.total && v.total === testInfo(t)?.count));
  return {
    tests: results.length + Object.values(history).reduce((a, w) => a + Object.keys(w).length, 0),
    perfect,
    topicsDone: done.length,
    topicMaster: master,
    bestStreak: stats.best,
    learned: stats.learned,
    medals: medals?.length ?? 0,
    asked: (questions?.length ?? 0) > 0,
    weeks,
  };
}

/** The badges: earned ones in colour, the rest grey with what it takes. */
export function BadgeGrid({facts}: {facts: BadgeFacts}) {
  const list = badges(facts);
  const got = list.filter((b) => b.earned).length;
  return (
    <section className="rounded-2xl bg-neutral-900 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Award size={18} className="text-amber-300" /> Амжилтууд{' '}
        <span className="text-sm font-normal text-neutral-500">
          {got}/{list.length}
        </span>
      </h2>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {list.map((b) => (
          <li key={b.id} title={b.hint} className={`flex flex-col items-center rounded-xl p-2 text-center ${b.earned ? 'bg-amber-500/10' : 'opacity-45'}`}>
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${b.earned ? 'bg-amber-500/20' : 'bg-neutral-800 grayscale'}`} aria-hidden>
              {b.icon}
            </span>
            <span className="mt-1.5 text-xs font-semibold leading-tight">{b.name}</span>
            <span className="mt-0.5 text-[10px] leading-tight text-neutral-500">{b.earned ? 'Авсан' : b.hint}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
