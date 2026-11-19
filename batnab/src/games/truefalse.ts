// «Зөв үү, буруу юу?»: a statement, right or wrong about as often. The wrong ones are the slips people make (a sum off
// by a little, (a + b)² = a² + b², ½ + ⅓ = ⅖, (−3)² = −9), so it takes knowing, not a guess at which looks odd. Later
// on, rules of powers, of roots and a little trigonometry and logarithms come in.

export interface Claim {
  /** In KaTeX, within $…$ (MathText). */
  tex: string;
  truth: boolean;
  /** The right statement, shown after a wrong answer. */
  right: string;
}

const int = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const coin = () => Math.random() < 0.5;
/** A number near n but not n. */
const near = (n: number, spread = 3) => {
  let d = int(1, spread);
  if (coin()) d = -d;
  return n + d === n ? n + 1 : n + d;
};
const neg = (n: number) => (n < 0 ? `-${-n}` : `${n}`);

/** `left = value`, true, or with a wrong value (`wrong`). */
const eq = (left: string, value: string, truth: boolean, wrong: string): Claim => ({tex: `$${left} = ${truth ? value : wrong}$`, truth, right: `$${left} = ${value}$`});

const EASY: (() => Claim)[] = [
  () => {
    const a = int(3, 12);
    const b = int(3, 12);
    return eq(`${a} \\cdot ${b}`, `${a * b}`, coin(), `${coin() ? near(a * b) : a * (b + 1)}`);
  },
  () => {
    const n = int(4, 16);
    return eq(`${n}^2`, `${n * n}`, coin(), `${coin() ? near(n * n, 4) : 2 * n}`);
  },
  () => {
    const n = int(4, 15);
    return eq(`\\sqrt{${n * n}}`, `${n}`, coin(), `${near(n, 2)}`);
  },
  () => {
    const n = int(3, 9);
    return eq(`2^{${n}}`, `${2 ** n}`, coin(), `${coin() ? 2 * n : 2 ** n + pick([-2, 2])}`);
  },
  () => {
    const a = int(2, 15);
    const b = int(2, 9);
    const c = int(2, 9);
    // The slip: adding first.
    return eq(`${a} + ${b} \\cdot ${c}`, `${a + b * c}`, coin(), `${(a + b) * c}`);
  },
  () => {
    const p = pick([10, 20, 25, 50]);
    const w = pick([40, 80, 120, 200, 400]);
    return eq(`${p}\\% \\cdot ${w}`, `${(p * w) / 100}`, coin(), `${coin() ? (p * w) / 10 : near((p * w) / 100, 5)}`);
  },
];

const HARD: (() => Claim)[] = [
  () => {
    const a = int(2, 9);
    // (−a)² = a², and the slip −a².
    return eq(`(-${a})^2`, `${a * a}`, coin(), `${-a * a}`);
  },
  () => {
    const a = int(2, 5);
    return eq(`(-${a})^3`, `${neg(-(a ** 3))}`, coin(), `${a ** 3}`);
  },
  () => {
    const [n1, d1, n2, d2] = pick([
      [1, 2, 1, 3],
      [1, 2, 1, 4],
      [1, 3, 1, 6],
      [2, 3, 1, 6],
      [1, 4, 1, 4],
      [3, 4, 1, 8],
    ] as const);
    const num = n1 * d2 + n2 * d1;
    const den = d1 * d2;
    const g = gcd(num, den);
    // The slip: tops and bottoms added.
    return eq(`\\frac{${n1}}{${d1}} + \\frac{${n2}}{${d2}}`, `\\frac{${num / g}}{${den / g}}`, coin(), `\\frac{${n1 + n2}}{${d1 + d2}}`);
  },
  () => {
    const m = int(2, 6);
    const n = int(2, 6);
    return eq(`x^{${m}} \\cdot x^{${n}}`, `x^{${m + n}}`, coin(), `x^{${m * n}}`);
  },
  () => {
    const m = int(2, 4);
    const n = int(2, 4);
    return eq(`(x^{${m}})^{${n}}`, `x^{${m * n}}`, coin(), `x^{${m + n}}`);
  },
  () => (coin() ? eq('(a + b)^2', 'a^2 + 2ab + b^2', coin(), 'a^2 + b^2') : eq('a^2 - b^2', '(a - b)(a + b)', coin(), '(a - b)^2')),
  () => {
    const a = pick([2, 3, 5, 6, 7]);
    const b = pick([3, 5, 7, 10, 11]);
    return a === b ? eq('\\sqrt{4} \\cdot \\sqrt{9}', '6', coin(), '\\sqrt{13}') : eq(`\\sqrt{${a}} \\cdot \\sqrt{${b}}`, `\\sqrt{${a * b}}`, coin(), `\\sqrt{${a + b}}`);
  },
  () => {
    const [left, value, wrong] = pick([
      ['\\sin 30^\\circ', '\\tfrac{1}{2}', '\\tfrac{\\sqrt{3}}{2}'],
      ['\\cos 60^\\circ', '\\tfrac{1}{2}', '\\tfrac{\\sqrt{3}}{2}'],
      ['\\tan 45^\\circ', '1', '\\tfrac{1}{2}'],
      ['\\cos 0^\\circ', '1', '0'],
      ['\\sin 90^\\circ', '1', '0'],
      ['\\cos 30^\\circ', '\\tfrac{\\sqrt{3}}{2}', '\\tfrac{1}{2}'],
    ] as const);
    return eq(left, value, coin(), wrong);
  },
  () => {
    const [b, n] = pick([
      [2, 3],
      [2, 5],
      [3, 2],
      [3, 4],
      [10, 3],
      [5, 2],
    ] as const);
    return eq(`\\log_{${b}} ${b ** n}`, `${n}`, coin(), `${coin() ? b ** n / b : n + 1}`);
  },
];

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** The n-th statement: easy ones first, then the harder ones mixed in. */
export function nextClaim(n: number, last?: string): Claim {
  const pool = n < 6 ? EASY : n < 12 ? [...EASY, ...HARD] : HARD;
  for (let i = 0; i < 10; i++) {
    const c = pick(pool)();
    // A wrong one must really be wrong (a slip can land on the right value).
    if (!c.truth && c.tex === c.right) continue;
    if (c.tex !== last) return c;
  }
  return pick(EASY)();
}

/** Points for a right answer after `streak` right in a row: ×1, ×2 … ×5. */
export const multiplier = (streak: number) => Math.min(5, 1 + Math.floor(streak / 3));
