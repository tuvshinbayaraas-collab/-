// Scheduled exams: the teacher opens a test as an exam from `start` to `end` (exams/{testId}). Each student takes it
// once; their answers are saved as they go to examAnswers/{testId}/{uid} and marked `done` when handed in (or left
// as they are when time runs out). The rules only accept these writes between start and end (+1 min), block
// practising that test until the exam is over, and keep its answer key closed until then.
import {onValue, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {auth, db} from './firebase';
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
  update(ref(db), {[`exams/${test}`]: {start, end, createdAt: serverTimestamp()}, [`examAnswers/${test}`]: null});

export const cancelExam = (test: string) => update(ref(db), {[`exams/${test}`]: null, [`examAnswers/${test}`]: null});

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
