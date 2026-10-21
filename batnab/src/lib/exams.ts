// Scheduled exams: the teacher opens a test as an exam from `start` to `end` (exams/{testId}). Each student takes it
// once; their answers are saved as they go to examAnswers/{testId}/{uid} and marked `done` when handed in (or left
// as they are when time runs out). The rules only accept these writes between start and end (+1 min), block
// practising that test until the exam is over, and keep its answer key closed until then.
// Each time a student leaves the exam's page and comes back is also written as it happens to
// examEvents/{testId}/{uid}/{id} = {k: 'o' (out) | 'b' (back), w?: why, ms?: time away, at}: the teacher sees who is
// away right now, and when and for how long each student was.
import {onIdTokenChanged} from 'firebase/auth';
import {onValue, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {auth, db, emulators, firebaseConfig} from './firebase';
import type {LeaveWhy} from './leaves';
import type {Result} from './results';

export interface Exam {
  start: number;
  end: number;
}

export interface ExamAnswer {
  /** A–E or '-' per question, book order. */
  answers: string;
  leaves: number;
  /** Milliseconds spent away from the page. */
  away: number;
  seconds: number;
  startedAt: number;
  /** Server time of the last save. */
  at: number;
  done?: boolean;
}

/** Writes are still accepted this long after the end, so an answer sent at the last second arrives. */
export const GRACE = 60_000;

export type ExamState = 'upcoming' | 'active' | 'ended';
export const examState = (e: Exam, now: number): ExamState => (now < e.start ? 'upcoming' : now <= e.end ? 'active' : 'ended');

let exams: Record<string, Exam> | null = null;
const listeners = new Set<() => void>();
let started = false;
const subscribe = (l: () => void) => {
  if (!started) {
    started = true;
    onValue(
      ref(db, 'exams'),
      (s) => {
        const v = (s.val() ?? {}) as Record<string, Partial<Exam>>;
        exams = Object.fromEntries(
          Object.entries(v).flatMap(([test, e]) => (typeof e?.start === 'number' && typeof e?.end === 'number' ? [[test, {start: e.start, end: e.end}]] : [])),
        );
        listeners.forEach((f) => f());
      },
      () => {
        exams = {};
        listeners.forEach((f) => f());
      },
    );
  }
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Every scheduled exam by test id (null while loading). */
export const useExams = () => useSyncExternalStore(subscribe, () => exams);

/** Schedules (or reschedules) a test's exam; the answers of an earlier exam of that test are removed. */
export const scheduleExam = (test: string, start: number, end: number) =>
  update(ref(db), {[`exams/${test}`]: {start, end, createdAt: serverTimestamp()}, [`examAnswers/${test}`]: null, [`examEvents/${test}`]: null});

export const cancelExam = (test: string) => update(ref(db), {[`exams/${test}`]: null, [`examAnswers/${test}`]: null, [`examEvents/${test}`]: null});

const parse = (v: Partial<ExamAnswer> | null): ExamAnswer | null =>
  v && typeof v.answers === 'string'
    ? {
        answers: v.answers,
        leaves: Number(v.leaves) || 0,
        away: Number(v.away) || 0,
        seconds: Number(v.seconds) || 0,
        startedAt: Number(v.startedAt) || 0,
        at: Number(v.at) || 0,
        done: v.done === true,
      }
    : null;

/** A student's saved exam answers: undefined while loading, null if they haven't started. */
export function useExamAnswer(test: string, uid: string | undefined) {
  const [state, setState] = useState<{key: string; value: ExamAnswer | null} | null>(null);
  const key = `${test}/${uid}`;
  useEffect(() => {
    if (!uid) return;
    return onValue(
      ref(db, `examAnswers/${test}/${uid}`),
      (s) => setState({key, value: parse(s.val())}),
      () => setState({key, value: null}),
    );
  }, [test, uid, key]);
  return state?.key === key ? state.value : undefined;
}

/** The same, shaped like a result so it can be graded and reviewed. */
export const asResult = (test: string, uid: string, a: ExamAnswer): Result => ({
  id: 'exam',
  uid,
  test,
  answers: a.answers,
  seconds: a.seconds,
  at: a.startedAt,
  leaves: a.leaves,
  away: a.away,
});

/** Saves the student's progress; the first save also records when they started. */
export function saveExam(test: string, a: Omit<ExamAnswer, 'at' | 'startedAt'>, first: boolean) {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Нэвтэрнэ үү'));
  const data = {answers: a.answers, leaves: a.leaves, away: Math.round(a.away), seconds: Math.round(a.seconds), at: serverTimestamp(), ...(a.done ? {done: true} : {})};
  return first ? set(ref(db, `examAnswers/${test}/${uid}`), {...data, startedAt: serverTimestamp()}) : update(ref(db, `examAnswers/${test}/${uid}`), data);
}

export const parseExamAnswer = parse;

// ---- leaving the exam's page ----

export interface ExamEvent {
  k: 'o' | 'b';
  w?: LeaveWhy;
  ms?: number;
  at: number;
}

// The student's sign-in token, at hand for a request sent while the page hides (there's no waiting then).
let token: string | null = null;
onIdTokenChanged(auth, (u) => {
  token = null;
  u?.getIdToken()
    .then((t) => (token = t))
    .catch(() => {});
});
const rest = emulators ? `http://127.0.0.1:9000` : firebaseConfig.databaseURL;
const ns = emulators ? `ns=${new URL(firebaseConfig.databaseURL).hostname.split('.')[0]}&` : '';

/**
 * Records leaving or coming back. Sent with sendBeacon: it still goes out as the page hides or closes, when the
 * database connection of a phone in the background has already stopped (the teacher sees it at once, not when the
 * student returns); the database's own write is the fallback.
 */
export function examEvent(test: string, e: {k: 'o' | 'b'; w?: LeaveWhy; ms?: number}) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const data = {k: e.k, ...(e.w ? {w: e.w} : {}), ...(e.ms !== undefined ? {ms: Math.round(Math.min(e.ms, 86_400_000))} : {})};
  try {
    const url = `${rest}/examEvents/${test}/${uid}.json?${ns}auth=${token}`;
    if (token && navigator.sendBeacon?.(url, new Blob([JSON.stringify({...data, at: {'.sv': 'timestamp'}})], {type: 'text/plain'}))) return;
  } catch {
    // no beacon here: the database writes it
  }
  push(ref(db, `examEvents/${test}/${uid}`), {...data, at: serverTimestamp()}).catch(() => {});
}

/** The comings and goings in an exam: uid → events (oldest first). One student's when `uid` is given; none for null. */
export function useExamEvents(test: string | null, uid?: string) {
  const [state, setState] = useState<{key: string; value: Record<string, ExamEvent[]>} | null>(null);
  const key = `${test}/${uid ?? ''}`;
  useEffect(
    () =>
      test === null
        ? undefined
        : onValue(
        ref(db, uid ? `examEvents/${test}/${uid}` : `examEvents/${test}`),
        (s) => {
          const v = (s.val() ?? {}) as Record<string, unknown>;
          const list = (x: unknown) =>
            Object.values((x ?? {}) as Record<string, ExamEvent>)
              .filter((e) => (e?.k === 'o' || e?.k === 'b') && typeof e.at === 'number')
              .sort((a, b) => a.at - b.at);
          setState({key, value: uid ? {[uid]: list(v)} : Object.fromEntries(Object.entries(v).map(([u, x]) => [u, list(x)]))});
        },
        () => setState({key, value: {}}),
      ),
    [test, uid, key],
  );
  return state?.key === key ? state.value : null;
}

/** A time away: since when, why, and for how long (undefined while still away). */
export interface Away {
  at: number;
  why: LeaveWhy;
  ms?: number;
}

/** The times away from the events: a leave starts one (a second one while away only tells why), a return ends it. */
export function awayTimes(events: ExamEvent[]): Away[] {
  const out: Away[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    const open = last && last.ms === undefined;
    if (e.k === 'o') {
      if (open) last.why = e.w ?? last.why;
      else out.push({at: e.at, why: e.w ?? 't'});
    } else if (open) last.ms = e.ms ?? Math.max(0, e.at - last.at);
  }
  return out;
}

