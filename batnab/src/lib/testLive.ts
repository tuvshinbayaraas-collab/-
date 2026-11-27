// A practice test going on, for the teacher's "Одоо тест өгч байна": testLive/{uid} = {test, started, n (answered),
// total, leaves, away (ms), out (when the student left the page; 0 while on it), at}. Written by the student's page
// while the test is open and taken off when it's handed in; if the page closes or loses its connection the database
// itself marks the student out. The student isn't shown how often they left: only the teacher sees it.
import {onDisconnect, ref, remove, serverTimestamp, set, update} from 'firebase/database';
import {db} from './firebase';
import {useLive} from './live';

export interface TestLive {
  uid: string;
  test: string;
  started: number;
  n: number;
  total: number;
  leaves: number;
  away: number;
  out: number;
  at: number;
}

/** What the student's page reports. */
export function reportTestLive(uid: string, s: Omit<TestLive, 'uid' | 'at' | 'out'>, out: boolean) {
  const r = ref(db, `testLive/${uid}`);
  // Closed or cut off without a word: out from then.
  onDisconnect(r)
    .update({out: serverTimestamp()})
    .catch(() => {});
  return set(r, {...s, away: Math.round(s.away), out: out ? serverTimestamp() : 0, at: serverTimestamp()}).catch(() => {});
}

/** Left the page or came back (the rest as it was). */
export const markTestOut = (uid: string, out: boolean, s?: {leaves: number; away: number}) =>
  update(ref(db, `testLive/${uid}`), {out: out ? serverTimestamp() : 0, at: serverTimestamp(), ...(s ? {leaves: s.leaves, away: Math.round(s.away)} : {})}).catch(() => {});

/** Handed in (or the page left for good): off the teacher's list. */
export function endTestLive(uid: string) {
  const r = ref(db, `testLive/${uid}`);
  onDisconnect(r)
    .cancel()
    .catch(() => {});
  return remove(r).catch(() => {});
}

/** Everyone taking a practice test now (the teacher), newest activity first. */
export const useTestLive = (on = true) =>
  useLive(on ? 'testLive' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, Partial<TestLive>>)
      .flatMap(([uid, x]) =>
        x && typeof x.test === 'string'
          ? [{uid, test: x.test, started: Number(x.started) || 0, n: Number(x.n) || 0, total: Number(x.total) || 0, leaves: Number(x.leaves) || 0, away: Number(x.away) || 0, out: Number(x.out) || 0, at: Number(x.at) || 0}]
          : [],
      )
      .sort((a, b) => b.at - a.at),
  );
