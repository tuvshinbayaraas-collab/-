// «Зөв үү, буруу юу?»: a statement, right or wrong about as often. The wrong ones are the slips people make (a sum off
// by a little, (a + b)² = a² + b², ½ + ⅓ = ⅖, (−3)² = −9), so it takes knowing, not a guess at which looks odd. Higher
// up come the rules of powers, of roots, a little trigonometry and logarithms, then negative and zero powers, sums of
// logarithms and dividing fractions. Each statement carries the rule it tests (`why`), for the review at the end.
import {coin, int, pick, rnd, withRng, type Rng} from '../lib/rand';

export interface Claim {
  /** In KaTeX, within $…$ (MathText). */
  tex: string;
  truth: boolean;
  /** The right statement, shown after a wrong answer. */
  right: string;
  /** The rule behind it, for the review. */
  why?: string;
}

/** A number near n but not n. */
const near = (n: number, spread = 3) => {
  let d = int(1, spread);
  if (coin()) d = -d;
  return n + d === n ? n + 1 : n + d;
};
const neg = (n: number) => (n < 0 ? `-${-n}` : `${n}`);

/** `left = value`, true, or with a wrong value (`wrong`). */
const eq = (left: string, value: string, truth: boolean, wrong: string, why?: string): Claim => ({tex: `$${left} = ${truth ? value : wrong}$`, truth, right: `$${left} = ${value}$`, why});

const EASY: (() => Claim)[] = [
  () => {
    const a = int(3, 12);
    const b = int(3, 12);
    return eq(`${a} \\cdot ${b}`, `${a * b}`, coin(), `${coin() ? near(a * b) : a * (b + 1)}`);
  },
  () => {
    const n = int(4, 16);
    return eq(`${n}^2`, `${n * n}`, coin(), `${coin() ? near(n * n, 4) : 2 * n}`, `$${n}^2 = ${n} \\cdot ${n}$, $2 \\cdot ${n}$ биш`);
  },
  () => {
    const n = int(4, 15);
    return eq(`\\sqrt{${n * n}}`, `${n}`, coin(), `${near(n, 2)}`, `$${n} \\cdot ${n} = ${n * n}$`);
  },
  () => {
    const n = int(3, 9);
    return eq(`2^{${n}}`, `${2 ** n}`, coin(), `${coin() ? 2 * n : 2 ** n + pick([-2, 2])}`, `$2^{${n}}$ гэдэг нь ${n} ширхэг 2-ын үржвэр`);
  },
  () => {
    const a = int(2, 15);
    const b = int(2, 9);
    const c = int(2, 9);
    // The slip: adding first.
    return eq(`${a} + ${b} \\cdot ${c}`, `${a + b * c}`, coin(), `${(a + b) * c}`, 'Нэмэхээс өмнө үржинэ');
  },
  () => {
    const p = pick([10, 20, 25, 50]);
    const w = pick([40, 80, 120, 200, 400]);
    return eq(`${p}\\% \\cdot ${w}`, `${(p * w) / 100}`, coin(), `${coin() ? (p * w) / 10 : near((p * w) / 100, 5)}`, `$${p}\\%$ гэдэг нь $\\tfrac{${p}}{100}$ хэсэг`);
  },
];

const HARD: (() => Claim)[] = [
  () => {
    const a = int(2, 9);
    // (−a)² = a², and the slip −a².
    return eq(`(-${a})^2`, `${a * a}`, coin(), `${-a * a}`, 'Сөрөг тоог тэгш зэрэгт дэвшүүлэхэд эерэг гарна');
  },
  () => {
    const a = int(2, 5);
    return eq(`(-${a})^3`, `${neg(-(a ** 3))}`, coin(), `${a ** 3}`, 'Сондгой зэрэгт тэмдэг хэвээр үлдэнэ');
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
    return eq(`\\frac{${n1}}{${d1}} + \\frac{${n2}}{${d2}}`, `\\frac{${num / g}}{${den / g}}`, coin(), `\\frac{${n1 + n2}}{${d1 + d2}}`, 'Хуваарийг ижил болгоод хүртвэрийг нэмнэ');
  },
  () => {
    const m = int(2, 6);
    const n = int(2, 6);
    return eq(`x^{${m}} \\cdot x^{${n}}`, `x^{${m + n}}`, coin(), `x^{${m * n}}`, 'Үржихэд зэрэг нэмэгдэнэ: $x^m \\cdot x^n = x^{m+n}$');
  },
  () => {
    const m = int(2, 4);
    const n = int(2, 4);
    return eq(`(x^{${m}})^{${n}}`, `x^{${m * n}}`, coin(), `x^{${m + n}}`, 'Зэрэгт дэвшүүлэхэд зэрэг үржигдэнэ: $(x^m)^n = x^{mn}$');
  },
  () =>
    coin()
      ? eq('(a + b)^2', 'a^2 + 2ab + b^2', coin(), 'a^2 + b^2', 'Дунд нь $2ab$ бий: $(a + b)^2 = a^2 + 2ab + b^2$')
      : eq('a^2 - b^2', '(a - b)(a + b)', coin(), '(a - b)^2', 'Квадратуудын ялгавар: $a^2 - b^2 = (a - b)(a + b)$'),
  () => {
    const a = pick([2, 3, 5, 6, 7]);
    const b = pick([3, 5, 7, 10, 11]);
    const why = 'Язгуурыг үржүүлэхэд доорх тоо үржигдэнэ: $\\sqrt{a} \\cdot \\sqrt{b} = \\sqrt{ab}$';
    return a === b ? eq('\\sqrt{4} \\cdot \\sqrt{9}', '6', coin(), '\\sqrt{13}', why) : eq(`\\sqrt{${a}} \\cdot \\sqrt{${b}}`, `\\sqrt{${a * b}}`, coin(), `\\sqrt{${a + b}}`, why);
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
    return eq(`\\log_{${b}} ${b ** n}`, `${n}`, coin(), `${coin() ? b ** n / b : n + 1}`, `$${b}^{${n}} = ${b ** n}$ тул $\\log_{${b}} ${b ** n} = ${n}$`);
  },
];

/** The top level: negative and zero powers, a sum of logarithms, dividing fractions (ЭЕШ ground). */
const EXTRA: (() => Claim)[] = [
  () => {
    const [a, n] = pick([
      [2, 3],
      [2, 2],
      [3, 2],
      [5, 2],
      [10, 2],
      [2, 4],
    ] as const);
    return eq(`${a}^{-${n}}`, `\\frac{1}{${a ** n}}`, coin(), coin() ? `${-a * n}` : `-\\frac{1}{${a ** n}}`, 'Сөрөг зэрэг: $a^{-n} = \\frac{1}{a^n}$');
  },
  () => {
    const a = int(2, 12);
    return eq(`${a}^{0}`, '1', coin(), coin() ? '0' : `${a}`, 'Тэгээс ялгаатай тоог 0 зэрэгт дэвшүүлбэл 1 гарна');
  },
  () => {
    const [m, n] = pick([
      [3, 2],
      [3, 1],
      [4, 1],
      [2, 2],
      [5, 1],
    ] as const);
    // log₂ 2^m + log₂ 2^n = m + n; the slip multiplies them.
    return eq(`\\log_{2} ${2 ** m} + \\log_{2} ${2 ** n}`, `${m + n}`, coin(), `${m * n === m + n ? m + n + 1 : m * n}`, 'Логарифмын нийлбэр: $\\log_a x + \\log_a y = \\log_a xy$');
  },
  () => {
    const [a, b, c, d] = pick([
      [2, 3, 4, 9],
      [1, 2, 1, 4],
      [3, 4, 3, 8],
      [2, 5, 4, 5],
      [5, 6, 5, 12],
    ] as const);
    const num = a * d;
    const den = b * c;
    const g = gcd(num, den);
    const value = den / g === 1 ? `${num / g}` : `\\frac{${num / g}}{${den / g}}`;
    const g2 = gcd(a * c, b * d);
    // The slip: multiplying instead of turning the second over.
    return eq(`\\frac{${a}}{${b}} \\div \\frac{${c}}{${d}}`, value, coin(), `\\frac{${(a * c) / g2}}{${(b * d) / g2}}`, 'Бутархайгаар хуваахдаа хуваагчийг урвуулж үржүүлнэ');
  },
];

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Which statements a level draws from, and how often. */
const POOLS: [number, (() => Claim)[]][][] = [
  [[1, EASY]],
  [
    [0.7, EASY],
    [0.3, HARD],
  ],
  [
    [0.5, EASY],
    [0.5, HARD],
  ],
  [
    [0.1, EASY],
    [0.7, HARD],
    [0.2, EXTRA],
  ],
  [
    [0.5, HARD],
    [0.5, EXTRA],
  ],
];

const draw = (level: number) => {
  const pools = POOLS[Math.min(5, Math.max(1, level)) - 1];
  let x = rnd();
  for (const [p, pool] of pools) {
    if (x < p) return pick(pool)();
    x -= p;
  }
  return pick(pools[pools.length - 1][1])();
};

/** A statement at `level` (1–5), not the same as `last`; from `rng` when given. */
export function claimAt(level: number, last?: string, rng?: Rng): Claim {
  return withRng(rng, () => {
    for (let i = 0; i < 12; i++) {
      const c = draw(level);
      // A wrong one must really be wrong (a slip can land on the right value).
      if (!c.truth && c.tex === c.right) continue;
      if (c.tex !== last) return c;
    }
    return eq('2 + 2', '4', true, '5');
  });
}

/** The level of the n-th statement in the day's challenge: the same climb for everyone. */
export const levelAt = (n: number) => (n < 6 ? 1 : n < 12 ? 2 : n < 18 ? 3 : n < 24 ? 4 : 5);

/** Right answers in a row from five on count double. */
export const bonus = (streak: number) => (streak >= 5 ? 2 : 1);
