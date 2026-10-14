// Answer keys, entered by the teacher: keys/{testId} is one character per question in book order, A–E or '-' when not set.
// Students may read a key once they have handed in that test; everyone may read the trial test's key.
import {onValue, ref, set} from 'firebase/database';
import {useEffect, useState} from 'react';
import {CODES} from '../tests/types';
import {db} from './firebase';

/** Answers (or a key) in the stored form. */
export const encode = (choices: (number | null)[]) => choices.map((x) => (x === null ? '-' : CODES[x])).join('');

/** The choice index (0 = А) stored at question i, or null. */
export const choiceAt = (s: string | null | undefined, i: number) => {
  const k = s ? CODES.indexOf(s[i]) : -1;
  return k < 0 ? null : k;
};

export interface Grade {
  score: number;
  /** Questions the key covers; less than `count` while the teacher hasn't entered the whole key. */
  total: number;
  count: number;
}

/** Null when there is no key yet. */
export function grade(answers: string, key: string | null | undefined, count: number): Grade | null {
  if (!key) return null;
  let score = 0;
  let total = 0;
  for (let i = 0; i < count; i++) {
    const k = key[i];
    if (!k || k === '-') continue;
    total++;
    if (answers[i] === k) score++;
  }
  return total ? {score, total, count} : null;
}

export const percent = (g: Grade) => Math.round((g.score / g.total) * 100);

/** Keys of the given tests, kept up to date: undefined while loading, null when missing or not readable. */
export function useKeys(testIds: string[]) {
  const [keys, setKeys] = useState<Record<string, string | null>>({});
  const sig = [...new Set(testIds)].sort().join(',');
  useEffect(() => {
    const stops = sig
      .split(',')
      .filter(Boolean)
      .map((id) =>
        onValue(
          ref(db, `keys/${id}`),
          (s) => setKeys((m) => ({...m, [id]: typeof s.val() === 'string' ? s.val() : null})),
          () => setKeys((m) => ({...m, [id]: null})),
        ),
      );
    return () => stops.forEach((f) => f());
  }, [sig]);
  return keys;
}

export const saveKey = (testId: string, key: string) => set(ref(db, `keys/${testId}`), /[A-E]/.test(key) ? key : null);
