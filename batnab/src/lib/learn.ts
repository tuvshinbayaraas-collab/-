// «Сурах»: a test's problems solved step by step, from a file the teacher loads on the keys page. The solutions give
// the answers away and this code is public, so they live in the database and are read like the test's key: by whoever
// has handed the test in (or by anyone for the trial test), never while an exam on it is on; the teacher always.
//   learn/{test}/{n} = {a, rule?, steps: [...], check?, note?}   n = the problem's number (from 1); a = its right
//                       choice (A–E); every text is a line or several, with $math$, and $$math$$ lines set apart.
//   learnIndex/{test} = {n, at}   which tests have them and how many (for the menu and the pages), for everyone signed in.
import {onValue, ref, serverTimestamp, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {db} from './firebase';
import {sharedLive, useSignIns} from './live';
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
  return {a, steps, ...(rule ? {rule} : {}), ...(check ? {check} : {}), ...(note ? {note} : {})};
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
