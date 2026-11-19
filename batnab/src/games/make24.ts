// «24 тоглоом»: four numbers from 1 to 9, put together two at a time with + − × ÷ until one is left: 24. Worked with
// fractions (3 ÷ 4 stays ¾, not 0.75), so every way there is counts. Only sets that can be done are given.

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

/** Four numbers 1–9 that can make 24 (and not the same four as `last`, in any order). */
export function newPuzzle(last?: number[]): number[] {
  const key = (xs: number[]) => [...xs].sort().join(',');
  for (;;) {
    const xs = Array.from({length: 4}, () => 1 + Math.floor(Math.random() * 9));
    if (last && key(xs) === key(last)) continue;
    if (solve(xs.map((n) => q(n)))) return xs;
  }
}
