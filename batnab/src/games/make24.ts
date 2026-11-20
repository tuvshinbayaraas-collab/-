// «24 тоглоом»: four numbers from 1 to 9, put together two at a time with + − × ÷ until one is left: 24. Worked with
// fractions (3 ÷ 4 stays ¾, not 0.75), so every way there is counts. Only sets that can be done are given, graded by
// how many ways they have: 1 (16 ways or more), 2 (5 to 15), 3 (4 or fewer, or none without a fraction or a number
// below 0 on the way) — of the 404 sets that can be done, 175, 164 and 65.
import {rnd, withRng, type Rng} from '../lib/rand';

/** A fraction, always in lowest terms with a positive bottom. */
export interface Q {
  n: number;
  d: number;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const q = (n: number, d = 1): Q => {
  if (d < 0) (n = -n), (d = -d);
  const g = gcd(n, d) || 1;
  return {n: n / g, d: d / g};
};

export type Op = '+' | '−' | '×' | '÷';
export const OPS: Op[] = ['+', '−', '×', '÷'];

/** a op b, or null where it can't be (÷ 0). */
export function apply(a: Q, op: Op, b: Q): Q | null {
  switch (op) {
    case '+':
      return q(a.n * b.d + b.n * a.d, a.d * b.d);
    case '−':
      return q(a.n * b.d - b.n * a.d, a.d * b.d);
    case '×':
      return q(a.n * b.n, a.d * b.d);
    case '÷':
      return b.n === 0 ? null : q(a.n * b.d, a.d * b.n);
  }
}

export const isQ = (x: Q, n: number) => x.d === 1 && x.n === n;
/** "3", "−2", "3/4". */
export const show = (x: Q) => `${x.n < 0 ? '−' : ''}${Math.abs(x.n)}${x.d === 1 ? '' : `/${x.d}`}`;

/** One way to 24 from these, as steps ("8 ÷ 2 = 4"); null if there is none. */
export function solve(nums: Q[], target = 24): string[] | null {
  if (nums.length === 1) return isQ(nums[0], target) ? [] : null;
  for (let i = 0; i < nums.length; i++)
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      for (const op of OPS) {
        // + and × don't care about the order: each pair once.
        if ((op === '+' || op === '×') && j < i) continue;
        const r = apply(nums[i], op, nums[j]);
        if (!r) continue;
        const after = solve([...rest, r], target);
        if (after) return [`${show(nums[i])} ${op} ${show(nums[j])} = ${show(r)}`, ...after];
      }
    }
  return null;
}

/** How many ways lead to 24 (each pair once for + and ×), and how many keep to whole numbers from 0 up. */
export function ways(nums: Q[], whole = true, target = 24): [number, number] {
  if (nums.length === 1) return isQ(nums[0], target) ? [1, whole ? 1 : 0] : [0, 0];
  let all = 0;
  let plain = 0;
  for (let i = 0; i < nums.length; i++)
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      for (const op of OPS) {
        if ((op === '+' || op === '×') && j < i) continue;
        const r = apply(nums[i], op, nums[j]);
        if (!r) continue;
        const [a, b] = ways([...rest, r], whole && r.d === 1 && r.n >= 0, target);
        all += a;
        plain += b;
      }
    }
  return [all, plain];
}

/** 1 easy, 2 middling, 3 hard (0: it can't be done). What solving it scores. */
export function grade(xs: number[]): number {
  const [all, plain] = ways(xs.map((n) => q(n)));
  if (!all) return 0;
  if (!plain || all <= 4) return 3;
  return all <= 15 ? 2 : 1;
}

/** Four numbers 1–9 that can make 24, of grade `level` (1–3), and not the same four as `last` in any order. */
export function newPuzzle(level = 1, last?: number[], rng?: Rng): number[] {
  const want = Math.min(3, Math.max(1, level));
  const key = (xs: number[]) => [...xs].sort().join(',');
  return withRng(rng, () => {
    for (;;) {
      const xs = Array.from({length: 4}, () => 1 + Math.floor(rnd() * 9));
      if (last && key(xs) === key(last)) continue;
      if (grade(xs) === want) return xs;
    }
  });
}

/** The grade of the n-th set in the day's challenge. */
export const levelOfSet = (n: number) => (n < 3 ? 1 : n < 7 ? 2 : 3);
