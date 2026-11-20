// «ЭЕШ сорил»: a problem as the exam has them, five answers А–Д, one right. The four wrong ones are the slips that
// lead to them (the percent over 10, the root left out, x₁ + x₂ = b, A for C), so a guess at the odd one out doesn't
// work. Five levels: percent, equations, means; powers and progressions; Vieta, logarithms, the vertex; trigonometry,
// sums of logarithms, derivatives; combinations, integrals, chance and distance.
// Each item keeps what it was made from (`kind`, `params`) so the check can work it out again.
import {coin, int, pick, rnd, shuffle, withRng, type Rng} from '../lib/rand';

export interface Item {
  /** The problem, with its mathematics within $…$ (MathText). */
  q: string;
  /** Five answers, in KaTeX within $…$. */
  choices: string[];
  /** What each answer is worth, as a number. */
  values: number[];
  /** Which one is right. */
  right: number;
  level: number;
  /** The way to it, for the review. */
  why: string;
  kind: string;
  params: number[];
}

type V = [number, string];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** n/d in lowest terms, as a value and its KaTeX. */
const frac = (n: number, d = 1): V => {
  if (d < 0) (n = -n), (d = -d);
  const g = gcd(n, d) || 1;
  const [a, b] = [n / g, d / g];
  return [a / b, b === 1 ? `${a}` : `${a < 0 ? '-' : ''}\\frac{${Math.abs(a)}}{${b}}`];
};
const N = (n: number) => frac(n);
const sgn = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);

/** The bottom of a fraction for x (up to 72), or 0 when it isn't one (a root). */
const bottom = (x: number) => {
  for (let d = 1; d <= 72; d++) if (Math.abs(x * d - Math.round(x * d)) < 1e-9) return d;
  return 0;
};

/**
 * Five answers: the right one, the slips that differ from it and each other, and near numbers with the same bottom if
 * too few did (whole numbers next to a root).
 */
function item(level: number, kind: string, params: number[], q: string, right: V, slips: V[], why: string): Item {
  const pool: V[] = [right];
  const differs = (v: V) => Number.isFinite(v[0]) && pool.every((p) => Math.abs(p[0] - v[0]) > 1e-9 && p[1] !== v[1]);
  for (const s of slips) if (pool.length < 5 && differs(s)) pool.push(s);
  const d = bottom(right[0]) || 1;
  const top = d === 1 ? Math.round(right[0]) : Math.round(right[0] * d);
  for (let k = 1; pool.length < 5; k++) for (const n of [top + k, top - k]) if (pool.length < 5 && differs(frac(n, d))) pool.push(frac(n, d));
  const order = shuffle([0, 1, 2, 3, 4]);
  return {q, choices: order.map((i) => `$${pool[i][1]}$`), values: order.map((i) => pool[i][0]), right: order.indexOf(0), level, why, kind, params};
}

const MAKERS: (() => Item)[][] = [
  // 1: percent, a linear equation, a mean
  [
    () => {
      const [p, w] = pick([
        [10, 240],
        [20, 150],
        [25, 80],
        [40, 60],
        [50, 90],
        [75, 120],
        [30, 70],
        [15, 200],
      ] as const);
      const r = (p * w) / 100;
      return item(1, 'percent', [p, w], `$${w}$ тооны $${p}$ хувийг ол.`, N(r), [N((p * w) / 10), N(w - p), N(((100 - p) * w) / 100), N(p + w)], `$${w} \\cdot \\frac{${p}}{100} = ${r}$`);
    },
    () => {
      const a = int(2, 9);
      let x = int(-5, 9);
      if (x === 0) x = 3;
      let b = int(-15, 15);
      if (b === 0) b = 4;
      const c = a * x + b;
      return item(
        1,
        'linear',
        [a, b, c],
        `$${a}x ${sgn(b)} = ${c}$ тэгшитгэлийг бод.`,
        N(x),
        [frac(c + b, a), N(c - b), N(-x), N((c - b) * a), N(x + 1)],
        `$${a}x = ${c} ${sgn(-b)} = ${c - b}$, $x = ${c - b} : ${a} = ${x}$`,
      );
    },
    () => {
      const a = int(2, 20);
      const b = int(2, 20);
      let c = int(2, 20);
      while ((a + b + c) % 3) c++;
      const s = a + b + c;
      const mid = [a, b, c].sort((x, y) => x - y)[1];
      return item(1, 'mean', [a, b, c], `$${a}$, $${b}$, $${c}$ тоонуудын арифметик дунджийг ол.`, N(s / 3), [N(s), frac(s, 2), N(mid), N(Math.max(a, b, c) - Math.min(a, b, c))], `$(${a} + ${b} + ${c}) : 3 = ${s} : 3$`);
    },
  ],
  // 2: a fraction for a power, arithmetic and geometric progressions
  [
    () => {
      const [b, m, n] = pick([
        [8, 2, 3],
        [27, 2, 3],
        [16, 3, 4],
        [4, 3, 2],
        [9, 3, 2],
        [32, 2, 5],
        [25, 3, 2],
        [64, 2, 3],
        [81, 3, 4],
      ] as const);
      const root = Math.round(b ** (1 / n));
      const r = root ** m;
      return item(
        2,
        'fracpow',
        [b, m, n],
        `Илэрхийллийн утгыг ол: $${b}^{\\frac{${m}}{${n}}}$`,
        N(r),
        [N(root * m), frac(b * m, n), N(root ** (m + 1)), N(root)],
        `$\\sqrt[${n}]{${b}} = ${root}$, $${root}^{${m}} = ${r}$`,
      );
    },
    () => {
      const a1 = int(-5, 10);
      let d = int(-4, 6);
      if (d === 0) d = 3;
      const n = int(5, 15);
      const r = a1 + (n - 1) * d;
      return item(
        2,
        'ap',
        [a1, d, n],
        `Арифметик прогрессийн $a_1 = ${a1}$, ялгавар $d = ${d}$ бол $a_{${n}}$ гишүүнийг ол.`,
        N(r),
        [N(a1 + n * d), N((n - 1) * d), N(a1 + (n - 2) * d), N(-r)],
        `$a_n = a_1 + (n - 1)d = ${a1} ${sgn((n - 1) * d)}$`,
      );
    },
    () => {
      const b1 = pick([1, 2, 3, 5]);
      const q = pick([2, 3, -2]);
      const n = int(3, 6);
      const r = b1 * q ** (n - 1);
      return item(
        2,
        'gp',
        [b1, q, n],
        `Геометр прогрессийн $b_1 = ${b1}$, хуваарь $q = ${q}$ бол $b_{${n}}$ гишүүнийг ол.`,
        N(r),
        [N(b1 * q ** n), N(b1 + (n - 1) * q), N(b1 * q * (n - 1)), N(b1 * q ** (n - 2))],
        `$b_n = b_1 q^{n - 1} = ${b1} \\cdot (${q})^{${n - 1}}$`,
      );
    },
  ],
  // 3: Vieta, a logarithm, the vertex of a parabola
  [
    () => {
      let r1 = int(-6, 8);
      let r2 = int(-6, 8);
      while (r1 + r2 === 0 || r1 * r2 === 0 || Math.abs(r1 + r2) === Math.abs(r1 * r2)) (r1 = int(-6, 8)), (r2 = int(-6, 8));
      const p = -(r1 + r2);
      const c = r1 * r2;
      const eqn = `x^2 ${sgn(p).replace(/ (\d+)$/, ' $1x')} ${sgn(c)} = 0`.replace(/([+-]) 1x/, '$1 x');
      const sum = coin();
      return sum
        ? item(3, 'vieta-sum', [p, c], `$${eqn}$ тэгшитгэлийн шийдүүдийн нийлбэрийг ол.`, N(-p), [N(p), N(c), N(-c), N(-p + 1)], 'Виетийн теорем: $x_1 + x_2 = -\\frac{b}{a}$')
        : item(3, 'vieta-product', [p, c], `$${eqn}$ тэгшитгэлийн шийдүүдийн үржвэрийг ол.`, N(c), [N(-c), N(p), N(-p), N(c + 1)], 'Виетийн теорем: $x_1 x_2 = \\frac{c}{a}$');
    },
    () => {
      const b = pick([2, 3, 5, 10]);
      const n = int(2, b === 10 ? 4 : b === 5 ? 3 : 5);
      const kind = int(0, 2);
      if (kind === 0)
        return item(3, 'log', [b, b ** n], `Утгыг ол: $\\log_{${b}} ${b ** n}$`, N(n), [N(b ** n / b), N(n + 1), N(n - 1), N(b * n), N(-n)], `$${b}^{${n}} = ${b ** n}$`);
      if (kind === 1)
        return item(3, 'log', [b, 1 / b ** n], `Утгыг ол: $\\log_{${b}} \\frac{1}{${b ** n}}$`, N(-n), [N(n), frac(1, n), frac(-1, n), N(-n - 1)], `$\\frac{1}{${b ** n}} = ${b}^{-${n}}$`);
      return item(3, 'log', [b, Math.sqrt(b)], `Утгыг ол: $\\log_{${b}} \\sqrt{${b}}$`, frac(1, 2), [N(2), frac(-1, 2), N(1), frac(1, b)], `$\\sqrt{${b}} = ${b}^{\\frac{1}{2}}$`);
    },
    () => {
      let half = int(-5, 5);
      if (half === 0) half = 2;
      const b = 2 * half;
      const c = int(-9, 9);
      const eqn = `y = x^2 ${sgn(b).replace(/ (\d+)$/, ' $1x')} ${c ? sgn(c) : ''}`.replace(/([+-]) 1x/, '$1 x').trim();
      return item(3, 'vertex', [b, c], `$${eqn}$ параболын оройн абсциссыг ол.`, N(-half), [N(half), N(-b), N(b), N(c)], `$x_0 = -\\frac{b}{2a} = -\\frac{${b}}{2}$`);
    },
  ],
  // 4: trigonometry in radians, a sum of logarithms, a derivative at a point
  [
    () => {
      const ALL: V[] = [
        [0, '0'],
        [0.5, '\\frac{1}{2}'],
        [Math.SQRT2 / 2, '\\frac{\\sqrt{2}}{2}'],
        [Math.sqrt(3) / 2, '\\frac{\\sqrt{3}}{2}'],
        [1, '1'],
        [-1, '-1'],
        [-0.5, '-\\frac{1}{2}'],
        [Math.sqrt(3), '\\sqrt{3}'],
      ];
      const [fn, angle, deg, num, den] = pick([
        ['sin', '\\frac{\\pi}{6}', 30, 1, 6],
        ['cos', '\\frac{\\pi}{3}', 60, 1, 3],
        ['sin', '\\frac{\\pi}{4}', 45, 1, 4],
        ['cos', '\\frac{\\pi}{6}', 30, 1, 6],
        ['tan', '\\frac{\\pi}{4}', 45, 1, 4],
        ['sin', '\\frac{\\pi}{2}', 90, 1, 2],
        ['cos', '\\pi', 180, 1, 1],
        ['tan', '\\frac{\\pi}{3}', 60, 1, 3],
        ['cos', '\\frac{\\pi}{2}', 90, 1, 2],
      ] as const);
      const v = Math[fn]((num * Math.PI) / den);
      const right = ALL.find((x) => Math.abs(x[0] - v) < 1e-9)!;
      return item(4, 'trig', [['sin', 'cos', 'tan'].indexOf(fn), num, den], `Утгыг ол: $\\${fn} ${angle}$`, right, shuffle(ALL.filter((x) => x !== right)), `$${angle} = ${deg}^\\circ$`);
    },
    () => {
      const m = int(1, 5);
      const n = int(1, 4);
      return item(
        4,
        'logsum',
        [m, n],
        `Утгыг ол: $\\log_{2} ${2 ** m} + \\log_{2} ${2 ** n}$`,
        N(m + n),
        [N(m * n), N(2 ** (m + n)), N(m + n + 1), N(Math.abs(m - n))],
        `$\\log_a x + \\log_a y = \\log_a xy$: $\\log_{2} ${2 ** (m + n)} = ${m + n}$`,
      );
    },
    () => {
      const a = pick([1, 2]);
      const b = int(-3, 3);
      const c = int(-5, 5);
      const x = pick([-2, -1, 1, 2, 3]);
      const d = 3 * a * x * x + 2 * b * x + c;
      const terms = [`${a === 1 ? '' : a}x^3`, b ? `${sgn(b)}x^2`.replace(/([+-]) 1x/, '$1 x') : '', c ? `${sgn(c)}x`.replace(/([+-]) 1x/, '$1 x') : ''].join(' ').replace(/\s+/g, ' ').trim();
      const dterms = [`${3 * a}x^2`, b ? `${sgn(2 * b)}x` : '', c ? sgn(c) : ''].join(' ').replace(/\s+/g, ' ').trim();
      return item(
        4,
        'deriv',
        [a, b, c, x],
        `$f(x) = ${terms}$ бол $f'(${x})$ утгыг ол.`,
        N(d),
        [N(a * x * x + b * x + c), N(3 * a * x * x + b * x + c), N(a * x ** 3 + b * x * x + c * x), N(3 * a * x + 2 * b + c)],
        `$f'(x) = ${dterms}$`,
      );
    },
  ],
  // 5: combinations, an integral, the chance with two dice, the distance between two points
  [
    () => {
      const n = int(5, 10);
      const k = int(2, 4);
      const C = (p: number, r: number) => {
        let v = 1;
        for (let i = 0; i < r; i++) v = (v * (p - i)) / (i + 1);
        return Math.round(v);
      };
      const A = (p: number, r: number) => {
        let v = 1;
        for (let i = 0; i < r; i++) v *= p - i;
        return v;
      };
      return item(
        5,
        'comb',
        [n, k],
        `${n} сурагчаас ${k} хүнтэй багийг хэдэн янзаар сонгох вэ?`,
        N(C(n, k)),
        [N(A(n, k)), N(n * k), N(C(n, k - 1)), N(C(n, k) + n)],
        `Дараалал хамаарахгүй тул $C_{${n}}^{${k}} = \\frac{${n}!}{${k}! \\cdot ${n - k}!}$`,
      );
    },
    () => {
      if (coin()) {
        const a = int(1, 5);
        const b = int(1, 5);
        return item(5, 'integral', [a, b], `Утгыг ол: $\\int_0^{${a}} (2x + ${b})\\,dx$`, N(a * a + a * b), [N(2 * a + b), N(a * a + b), frac(a * a + a * b, 2), N(2 * a * a + a * b)], `Эх функц нь $x^2 + ${b}x$. Түүний $${a}$ ба $0$ дээрх утгын ялгаврыг олно`);
      }
      const a = pick([3, 6]);
      return item(5, 'integral2', [a], `Утгыг ол: $\\int_0^{${a}} x^2\\,dx$`, N(a ** 3 / 3), [N(a ** 3), N(2 * a), N(a * a), N((a ** 3 / 3) * 2)], `Эх функц нь $\\frac{x^3}{3}$, утга нь $\\frac{${a ** 3}}{3}$`);
    },
    () => {
      const s = int(3, 11);
      const ways = 6 - Math.abs(s - 7);
      return item(
        5,
        'dice',
        [s],
        `Хоёр шоо хаяхад буусан тоонуудын нийлбэр ${s} байх магадлалыг ол.`,
        frac(ways, 36),
        [frac(1, 11), frac(ways + 1, 36), frac(ways, 12), frac(1, s)],
        `$36$ боломжоос $${ways}$ нь нийлбэр $${s}$ болно`,
      );
    },
    () => {
      const [dx, dy, d] = pick([
        [3, 4, 5],
        [6, 8, 10],
        [5, 12, 13],
        [8, 6, 10],
        [4, 3, 5],
      ] as const);
      const x1 = int(-4, 3);
      const y1 = int(-4, 3);
      const [x2, y2] = [x1 + (coin() ? dx : -dx), y1 + (coin() ? dy : -dy)];
      return item(
        5,
        'dist',
        [x1, y1, x2, y2],
        `$A(${x1};\\ ${y1})$ ба $B(${x2};\\ ${y2})$ цэгийн хоорондох зайг ол.`,
        N(d),
        [N(dx + dy), N(Math.abs(dx - dy)), N(d * d), N(d + 1)],
        `$AB = \\sqrt{${dx}^2 + ${dy}^2} = \\sqrt{${d * d}}$`,
      );
    },
  ],
];

/** An item at `level` (1–5): mostly the level's own, now and then one from below; from `rng` when given. */
export function itemAt(level: number, last?: string, rng?: Rng): Item {
  const lv = Math.min(5, Math.max(1, level));
  return withRng(rng, () => {
    for (let i = 0; i < 10; i++) {
      const from = lv > 1 && rnd() < 0.3 ? int(1, lv - 1) : lv;
      const it = pick(MAKERS[from - 1])();
      if (it.q !== last) return it;
    }
    return pick(MAKERS[lv - 1])();
  });
}

/** The level of the n-th item in the day's challenge. */
export const levelOfItem = (n: number) => Math.min(5, 1 + Math.floor(n / 3));

export const LETTERS = ['А', 'Б', 'В', 'Г', 'Д'];
