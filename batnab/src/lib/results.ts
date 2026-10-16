// Handed-in tests: results/{uid}/{testId}/{pushId} = {answers, seconds, at}. Scores are worked out from the
// current answer key whenever they are shown, so fixing a key fixes every score. Only this week's results count
// (see week.ts); older ones are hidden and deleted.
import {onValue, push, ref, serverTimestamp, set} from 'firebase/database';
import {useEffect, useState} from 'react';
import {testInfo} from '../tests';
import {auth, db} from './firebase';
import {useSession} from './session';
import {inThisWeek} from './week';

export interface Result {
  id: string;
  uid: string;
  test: string;
  /** Chosen answers in book order, A–E or '-'. */
  answers: string;
  seconds: number;
  at: number;
  /** How often the student left the page while taking it, and for how long (ms). */
  leaves?: number;
  away?: number;
}

export async function saveResult(test: string, answers: string, seconds: number, leaves = 0, away = 0) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Эхлээд нэвтэрнэ үү');
  const r = push(ref(db, `results/${uid}/${test}`));
  await set(r, {answers, seconds, at: serverTimestamp(), ...(leaves ? {leaves, away: Math.round(away)} : {})});
  return r.key!;
}

type Tree = Record<string, Record<string, Partial<Result>> | unknown>;

/** results/{uid} as a list, newest first; anything that isn't a known test is skipped. */
export function flatten(uid: string, tree: Tree | null): Result[] {
  const out: Result[] = [];
  for (const [test, attempts] of Object.entries(tree ?? {})) {
    if (!testInfo(test) || !attempts || typeof attempts !== 'object') continue;
    for (const [id, r] of Object.entries(attempts as Record<string, Partial<Result>>)) {
      if (typeof r?.answers !== 'string') continue;
      out.push({id, uid, test, answers: r.answers, seconds: Number(r.seconds) || 0, at: Number(r.at) || 0, leaves: Number(r.leaves) || 0, away: Number(r.away) || 0});
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Deletes results from before this week's reset (best effort: the rules allow it once the week has turned). */
export function clearOld(results: Result[]) {
  for (const r of results) if (!inThisWeek(r.at)) set(ref(db, `results/${r.uid}/${r.test}/${r.id}`), null).catch(() => {});
}

/** The signed-in user's results from this week, newest first: null while loading. */
export function useMyResults() {
  const {user, ready} = useSession();
  const uid = user?.uid;
  const [results, setResults] = useState<{uid: string | undefined; list: Result[]} | null>(null);
  // Starts as soon as the account is known, alongside the profile, instead of after it.
  useEffect(() => {
    if (!uid) return;
    return onValue(
      ref(db, `results/${uid}`),
      (s) => {
        const all = flatten(uid, s.val());
        clearOld(all);
        setResults({uid, list: all.filter((r) => inThisWeek(r.at))});
      },
      () => setResults({uid, list: []}),
    );
  }, [uid]);
  if (!uid) return ready ? [] : null;
  return results?.uid === uid ? results.list : null;
}

/** One result (own, or anyone's for the teacher): undefined while loading, null if missing. */
export function useResult(uid: string | undefined, test: string, id: string) {
  const [r, setR] = useState<{key: string; result: Result | null} | null>(null);
  const key = `${uid}/${test}/${id}`;
  useEffect(() => {
    if (!uid) return;
    return onValue(
      ref(db, `results/${uid}/${test}/${id}`),
      (s) => {
        const v = s.val() as Partial<Result> | null;
        setR({key, result: v && typeof v.answers === 'string' ? {id, uid, test, answers: v.answers, seconds: Number(v.seconds) || 0, at: Number(v.at) || 0, leaves: Number(v.leaves) || 0, away: Number(v.away) || 0} : null});
      },
      () => setR({key, result: null}),
    );
  }, [uid, test, id, key]);
  return r?.key === key ? r.result : undefined;
}

export const formatDate = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
