import {Award, ChevronDown} from 'lucide-react';
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

const OPEN_KEY = 'batnab.badges.open';
const PREVIEW = 4;

/** The badges, folded by default (the earned ones peek out): earned ones in colour, the rest grey with what it takes. */
export function BadgeGrid({facts}: {facts: BadgeFacts}) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? '0' : '1');
    } catch {
      // storage blocked: folded again next time
    }
  };
  const list = badges(facts);
  const earned = list.filter((b) => b.earned);
  return (
    <section className="rounded-2xl bg-neutral-900">
      <h2>
        <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 rounded-2xl p-5 text-left font-semibold hover:bg-neutral-800/40">
          <Award size={18} className="shrink-0 text-amber-300" /> Амжилтууд
          <span className="text-sm font-normal text-neutral-500">
            {earned.length}/{list.length}
          </span>
          <span className="flex-1" />
          {!open && earned.length > 0 && (
            <span className="flex items-center gap-0.5 text-lg" aria-hidden>
              {earned.slice(0, PREVIEW).map((b) => (
                <span key={b.id}>{b.icon}</span>
              ))}
              {earned.length > PREVIEW && <span className="ml-1 text-xs font-normal text-neutral-400">+{earned.length - PREVIEW}</span>}
            </span>
          )}
          <ChevronDown size={18} className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      {open && (
        <ul className="grid grid-cols-3 gap-3 px-5 pb-5 sm:grid-cols-4">
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
      )}
    </section>
  );
}
