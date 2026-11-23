// «Сурах»: a test's problems solved step by step, from a file the teacher loads on the keys page. The solutions give
// the answers away and this code is public, so they live in the database and are read like the test's key: by whoever
// has handed the test in (or by anyone for the trial test), never while an exam on it is on; the teacher always.
//   learn/{test}/{n} = {a, rule?, steps: [...], check?, note?}   n = the problem's number (from 1); a = its right
//                       choice (A–E); every text is a line or several, with $math$, and $$math$$ lines set apart.
//   learnIndex/{test} = {n, at}   which tests have them and how many (for the menu and the pages), for everyone signed in.
//   learnDone/{uid}/{test}/{n} = true   the problems a student has marked «Ойлголоо» (they write their own; the teacher reads).
import {onValue, ref, serverTimestamp, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {db} from './firebase';
import {sharedLive, useLive, useSignIns} from './live';
import {sendKept} from './outbox';
import {testInfo} from '../tests';
import {CODES} from '../tests/types';

export interface Solution {
  /** The right choice, A–E. */
  a: string;
  /** The rule or formula it rests on. */
  rule?: string;
  /** The way, step by step. */
  steps: string[];
  /** How to see the answer is right. */
  check?: string;
  /** A slip to watch for, or a quicker way. */
  note?: string;
  /** A problem of the same kind to try after it: the problem, its answer and a line on how. */
  try?: {q: string; a: string; s?: string};
}

/** A test's solutions by problem number (from 1). */
export type Solutions = Record<number, Solution>;

/** The longest text the rules take. */
export const MAX_TEXT = 3000;
/** The most steps the rules take. */
export const MAX_STEPS = 20;

const text = (v: unknown) => (typeof v === 'string' && v.trim() && v.length <= MAX_TEXT ? v : undefined);
// (A list the database makes of numbered keys may have holes: Object.values/entries skip them.)
const asList = (v: unknown) => (v && typeof v === 'object' ? Object.values(v) : []);

/** One problem's solution as stored or as written in the file; null if it isn't one. */
export function parseSolution(v: unknown): Solution | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const a = typeof o.a === 'string' && o.a.length === 1 && CODES.includes(o.a) ? o.a : null;
  const steps = asList(o.steps).flatMap((s) => text(s) ?? []);
  if (!a || !steps.length || steps.length > MAX_STEPS) return null;
  const rule = text(o.rule);
  const check = text(o.check);
  const note = text(o.note);
  const t = (o.try ?? {}) as Record<string, unknown>;
  const tq = text(t.q);
  const ta = text(t.a);
  const ts = text(t.s);
  return {a, steps, ...(rule ? {rule} : {}), ...(check ? {check} : {}), ...(note ? {note} : {}), ...(tq && ta ? {try: {q: tq, a: ta, ...(ts ? {s: ts} : {})}} : {})};
}

/** A test's solutions as stored (an object by number, or the list the database makes of one). */
function parseAll(v: unknown): Solutions {
  const out: Solutions = {};
  for (const [k, x] of Object.entries(v && typeof v === 'object' ? v : {})) {
    const n = Number(k);
    const s = Number.isInteger(n) && n >= 1 ? parseSolution(x) : null;
    if (s) out[n] = s;
  }
  return out;
}

/**
 * A test's solutions: 'locked' when they may not be read yet (the test not handed in, or an exam on it is on), {} when
 * there are none; null while loading. Read again when someone else signs in.
 */
export function useSolutions(test: string | undefined): Solutions | 'locked' | null {
  const key = `${useSignIns()}|${test}`;
  const [state, setState] = useState<{key: string; value: Solutions | 'locked'} | null>(null);
  useEffect(() => {
    if (!test) return;
    return onValue(
      ref(db, `learn/${test}`),
      (s) => setState({key, value: parseAll(s.val())}),
      () => setState({key, value: 'locked'}),
    );
    // `key` stands for the test and who is signed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return test && state?.key === key ? state.value : null;
}

export interface LearnEntry {
  /** How many problems have a solution. */
  n: number;
  /** When the teacher loaded them. */
  at: number;
}

const index = sharedLive(
  'learnIndex',
  (v) =>
    Object.fromEntries(
      Object.entries((v ?? {}) as Record<string, Partial<LearnEntry>>).flatMap(([id, e]) =>
        testInfo(id) && typeof e?.n === 'number' && e.n > 0 ? [[id, {n: e.n, at: typeof e.at === 'number' ? e.at : 0}]] : [],
      ),
    ) as Record<string, LearnEntry>,
  {} as Record<string, LearnEntry>,
);

/** The tests with solutions (an empty list when signed out); null while loading. */
export const useLearnIndex = index.use;

/** The file the teacher loads: `{"app": "batnab-learn", "test": "8A", "items": {"1": {...}, ...}}`. */
export function parseLearnFile(raw: string): {test: string; items: Solutions} | {error: string} {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return {error: 'Файлыг уншиж чадсангүй. Бодолтын JSON файл сонгоно уу.'};
  }
  const o = (v ?? {}) as Record<string, unknown>;
  if (o.app !== 'batnab-learn' || typeof o.test !== 'string') return {error: 'Энэ нь бодолтын файл биш байна.'};
  const info = testInfo(o.test);
  if (!info) return {error: `«${o.test}» гэсэн тест сайтад алга.`};
  const items: Solutions = {};
  const bad: string[] = [];
  for (const [k, x] of Object.entries((o.items ?? {}) as Record<string, unknown>)) {
    const n = Number(k);
    const s = Number.isInteger(n) && n >= 1 && n <= info.count ? parseSolution(x) : null;
    if (s) items[n] = s;
    else bad.push(k);
  }
  if (bad.length) return {error: `${bad.length} бодлогын бодолт буруу бичигдсэн байна: ${bad.slice(0, 8).join(', ')}.`};
  if (!Object.keys(items).length) return {error: 'Файлд бодолт алга.'};
  return {test: info.id, items};
}

/** The teacher keeps a test's solutions (in place of any before). */
export const saveSolutions = (test: string, items: Solutions) =>
  update(ref(db), {[`learn/${test}`]: items, [`learnIndex/${test}`]: {n: Object.keys(items).length, at: serverTimestamp()}});

/** The teacher takes a test's solutions away. */
export const removeSolutions = (test: string) => update(ref(db), {[`learn/${test}`]: null, [`learnIndex/${test}`]: null});

/** One student's marks as stored: test → problem numbers (only tests the site knows, numbers in the test). */
function parseDone(v: unknown): Record<string, Set<number>> {
  const out: Record<string, Set<number>> = {};
  for (const [test, x] of Object.entries(v && typeof v === 'object' ? v : {})) {
    const info = testInfo(test);
    if (!info || !x || typeof x !== 'object') continue;
    const set = new Set<number>();
    for (const [k, on] of Object.entries(x)) {
      const n = Number(k);
      if (on === true && Number.isInteger(n) && n >= 1 && n <= info.count) set.add(n);
    }
    if (set.size) out[test] = set;
  }
  return out;
}

// The marks were kept on the device before (batnab.learn.{uid}.{test} = [n…]): moved into the account once per visit.
const moved = new Set<string>();
async function moveOldMarks(uid: string, have: Record<string, Set<number>>) {
  const prefix = `batnab.learn.${uid}.`;
  const keys: string[] = [];
  const ops: Record<string, true> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) {
      const info = testInfo(k.slice(prefix.length));
      if (!info) continue;
      let v: unknown;
      try {
        v = JSON.parse(localStorage.getItem(k) ?? '[]');
      } catch {
        continue;
      }
      if (!Array.isArray(v)) continue;
      for (const n of v) {
        if (Number.isInteger(n) && n >= 1 && n <= info.count && !have[info.id]?.has(n)) ops[`learnDone/${uid}/${info.id}/${n}`] = true;
      }
    }
  } catch {
    // No storage (a private window): nothing to move.
    return;
  }
  if (!keys.length) return;
  try {
    if (Object.keys(ops).length) await update(ref(db), ops);
  } catch {
    // Not saved: the marks stay on the device, to be moved on the next visit.
    return;
  }
  try {
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Left on the device: moving them again adds nothing.
  }
}

/** The student's marks by test; null while loading. Also moves this device's old marks into the account, once. */
export function useLearnDone(uid: string | undefined): Record<string, Set<number>> | null {
  const done = useLive(uid ? `learnDone/${uid}` : null, parseDone);
  useEffect(() => {
    if (!uid || !done || moved.has(uid)) return;
    moved.add(uid);
    void moveOldMarks(uid, done);
  }, [uid, done]);
  return done;
}

/** Marks (on=true) or unmarks one problem; kept on the phone until the database has it (outbox). */
export function setLearnDone(uid: string, test: string, n: number, on: boolean): Promise<void> {
  return sendKept(uid, `l:${test}/${n}`, {[`learnDone/${uid}/${test}/${n}`]: on ? true : null});
}

/** Teacher: every student's marks, uid → test → problem numbers; null while loading. */
export function useAllLearnDone(): Record<string, Record<string, Set<number>>> | null {
  return useLive('learnDone', (v) =>
    Object.fromEntries(Object.entries(v && typeof v === 'object' ? v : {}).map(([uid, x]) => [uid, parseDone(x)])),
  );
}

/** How many students marked each problem of a test: n → count. */
export function countLearnDone(all: Record<string, Record<string, Set<number>>>, test: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const marks of Object.values(all)) marks[test]?.forEach((n) => (out[n] = (out[n] ?? 0) + 1));
  return out;
}
