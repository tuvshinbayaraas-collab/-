// «Хурдан тооцоо»: a sum to work out in the head, harder as more are right. Every answer is a whole number (perhaps
// negative), typed on the game's keypad. A sum knows how it is worked out quickly (`why`), for the review at the end.
import {int, pick, rnd, withRng, type Rng} from '../lib/rand';

export interface Sum {
  text: string;
  answer: number;
  /** 1–5: how hard, and what a right answer scores. */
  level: number;
  /** A quick way to it, shown with a wrong answer in the review. */
  why?: string;
}

/** A minus that reads as one (U+2212), not a hyphen. */
const neg = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const SUP: Record<string, string> = {'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'};
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[d]);
const PER_CENT: Record<number, string> = {10: '10% бол аравны нэг', 20: '20% бол тавны нэг', 25: '25% бол дөрөвний нэг', 50: '50% бол хагас', 75: '75% бол дөрөвний гурав'};

/** The level after `right` right answers: four at the first, then a few more at each (the day's challenge goes so). */
export const levelAfter = (right: number) => (right < 4 ? 1 : right < 8 ? 2 : right < 13 ? 3 : right < 19 ? 4 : 5);

const LEVELS: (() => Sum)[] = [
  // 1: adding and taking away within 100
  () => {
    if (rnd() < 0.5) {
      const a = int(6, 59);
      const b = int(6, 40);
      return {text: `${a} + ${b}`, answer: a + b, level: 1};
    }
    const a = int(20, 99);
    const b = int(5, a - 1);
    return {text: `${a} − ${b}`, answer: a - b, level: 1};
  },
  // 2: the times table, and dividing back
  () => {
    const a = int(2, 12);
    const b = int(2, 12);
    return rnd() < 0.6 ? {text: `${a} × ${b}`, answer: a * b, level: 2} : {text: `${a * b} ÷ ${a}`, answer: b, level: 2};
  },
  // 3: two digits by one, squares to 20, the order of operations
  () => {
    const kind = int(0, 2);
    if (kind === 0) {
      const a = int(12, 49);
      const b = int(3, 9);
      const tens = a - (a % 10);
      const why = a % 10 ? `${tens} · ${b} + ${a % 10} · ${b} = ${tens * b} + ${(a % 10) * b}` : `${a / 10} · ${b} = ${(a / 10) * b}, ард нь 0 залгана`;
      return {text: `${a} × ${b}`, answer: a * b, level: 3, why};
    }
    if (kind === 1) {
      const n = int(11, 19);
      const d = n - 10;
      return {text: `${n}²`, answer: n * n, level: 3, why: `(10 + ${d})² = 100 + ${20 * d} + ${d * d}`};
    }
    const a = int(2, 20);
    const b = int(2, 9);
    const c = int(2, 9);
    const why = `Эхлээд үржинэ: ${b} × ${c} = ${b * c}`;
    return rnd() < 0.5 ? {text: `${a} + ${b} × ${c}`, answer: a + b * c, level: 3, why} : {text: `${b} × ${c} − ${a}`, answer: b * c - a, level: 3, why};
  },
  // 4: negative numbers, powers, roots, per cent
  () => {
    const kind = int(0, 4);
    if (kind === 0) {
      const a = int(3, 30);
      const b = int(3, 30);
      const c = int(2, 9);
      return pick([
        {text: `${neg(-a)} + ${b}`, answer: b - a, level: 4, why: `−${a} + ${b} = ${b} − ${a}`},
        {text: `${neg(-a)} − ${b}`, answer: -a - b, level: 4, why: `−${a} − ${b} = −(${a} + ${b})`},
        {text: `${neg(-a)} × ${c}`, answer: -a * c, level: 4, why: 'Сөрөг тоог эерэг тоогоор үржүүлэхэд сөрөг гарна'},
      ]);
    }
    if (kind === 1) {
      const [b, n] = pick([
        [2, int(5, 10)],
        [3, int(3, 5)],
        [5, 3],
        [10, int(2, 4)],
        [4, 3],
      ] as const);
      return {text: `${b}${sup(n)}`, answer: b ** n, level: 4, why: `${b}${sup(n)} = ${Array(n).fill(b).join(' · ')}`};
    }
    if (kind === 2) {
      if (rnd() < 0.7) {
        const n = int(11, 25);
        return {text: `√${n * n}`, answer: n, level: 4, why: `${n} · ${n} = ${n * n}`};
      }
      const n = int(2, 6);
      return {text: `∛${n ** 3}`, answer: n, level: 4, why: `${n} · ${n} · ${n} = ${n ** 3}`};
    }
    if (kind === 3) {
      const p = pick([10, 20, 25, 50, 75]);
      const whole = pick([20, 40, 60, 80, 120, 160, 200, 240, 300, 400]);
      if ((p * whole) % 100) return {text: `10% · ${whole}`, answer: whole / 10, level: 4, why: PER_CENT[10]};
      return {text: `${p}% · ${whole}`, answer: (p * whole) / 100, level: 4, why: PER_CENT[p]};
    }
    const a = int(2, 9);
    return {text: `(${neg(-a)})²`, answer: a * a, level: 4, why: `(−${a}) · (−${a}) = ${a * a}`};
  },
  // 5: an equation for x, a fraction of a number, a difference of squares
  () => {
    const kind = int(0, 2);
    if (kind === 0) {
      const a = int(2, 9);
      let x = int(-9, 12);
      if (x === 0) x = 4;
      const b = int(-20, 20);
      const c = a * x + b;
      return {text: `${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${neg(c)}, x = ?`, answer: x, level: 5, why: `${a}x = ${neg(c)} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${neg(c - b)}, x = ${neg(c - b)} : ${a}`};
    }
    if (kind === 1) {
      const den = pick([3, 4, 5, 6, 8]);
      const num = int(1, den - 1);
      const whole = den * int(3, 12);
      return {text: `${num}/${den} · ${whole}`, answer: (num * whole) / den, level: 5, why: `${whole} : ${den} = ${whole / den}, ${whole / den} · ${num} = ${(num * whole) / den}`};
    }
    const a = int(11, 30);
    const b = a - int(1, 3);
    return {text: `${a}² − ${b}²`, answer: a * a - b * b, level: 5, why: `(${a} − ${b})(${a} + ${b}) = ${a - b} · ${a + b}`};
  },
];

/** A new sum at `level` (1–5), not the same text as `last`; from `rng` when given (the day's challenge). */
export function nextSum(level: number, last?: string, rng?: Rng): Sum {
  const make = LEVELS[Math.min(5, Math.max(1, level)) - 1];
  return withRng(rng, () => {
    for (let i = 0; i < 10; i++) {
      const s = make();
      if (s.text !== last) return s;
    }
    return make();
  });
}
