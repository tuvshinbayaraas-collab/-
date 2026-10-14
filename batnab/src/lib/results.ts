// Handed-in tests: results/{uid}/{testId}/{pushId} = {answers, seconds, at}. Scores are worked out from the
// current answer key whenever they are shown, so fixing a key fixes every score.
import {onValue, push, ref, serverTimestamp, set} from 'firebase/database';
import {useEffect, useState} from 'react';
import {testInfo} from '../tests';
import {auth, db} from './firebase';
import {useSession} from './session';

export interface Result {
  id: string;
  uid: string;
  test: string;
  /** Chosen answers in book order, A–E or '-'. */
  answers: string;
  seconds: number;
  at: number;
}

export async function saveResult(test: string, answers: string, seconds: number) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Эхлээд нэвтэрнэ үү');
  const r = push(ref(db, `results/${uid}/${test}`));
  await set(r, {answers, seconds, at: serverTimestamp()});
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
      out.push({id, uid, test, answers: r.answers, seconds: Number(r.seconds) || 0, at: Number(r.at) || 0});
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

/** The signed-in user's results, newest first: null while loading. */
export function useMyResults() {
  const {user, ready} = useSession();
  const uid = user?.uid;
  const [results, setResults] = useState<{uid: string | undefined; list: Result[]} | null>(null);
  useEffect(() => {
    if (!ready || !uid) return;
    return onValue(
      ref(db, `results/${uid}`),
      (s) => setResults({uid, list: flatten(uid, s.val())}),
      () => setResults({uid, list: []}),
    );
  }, [ready, uid]);
  if (!ready) return null;
  if (!uid) return [];
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
        setR({key, result: v && typeof v.answers === 'string' ? {id, uid, test, answers: v.answers, seconds: Number(v.seconds) || 0, at: Number(v.at) || 0} : null});
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
