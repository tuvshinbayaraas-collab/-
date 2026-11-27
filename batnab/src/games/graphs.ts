// «График таах»: a graph, and four equations of the same family to pick from. Five stages: lines, parabolas, |x|,
// then a^x and logarithms, then sin and cos. The wrong ones are the slips one makes reading a graph (a sign turned,
// the shift the wrong way, the base turned over, sin for cos), never the same curve as the right one; every graph
// shows where it can be read (its intercept, its vertex, its turning point) inside the picture.
import {int, pick, rnd, shuffle, withRng, type Rng} from '../lib/rand';

export type Kind = 'line' | 'parabola' | 'abs' | 'exp' | 'log' | 'sin' | 'cos';

export interface Curve {
  kind: Kind;
  /**
   * line: slope; parabola, |x|: 1 or −1 (opening up or down); a^x, log: the base (2 or ½); sin, cos: how tall (±1, ±2).
   */
  a: number;
  /** line: where it crosses the y axis; parabola, |x|, a^x, log: how far right it is moved (sin, cos: 0). */
  h: number;
  /** How far up it is moved (lines: unused, 0). */
  k: number;
}

export interface Round {
  curve: Curve;
  /** Four, one of them `curve`, in a random order. */
  choices: Curve[];
}

/** The stage of a kind: 1 lines … 5 sin and cos (what a right answer scores). */
export const STAGE: Record<Kind, number> = {line: 1, parabola: 2, abs: 3, exp: 4, log: 4, sin: 5, cos: 5};

export const valueAt = (c: Curve, x: number) => {
  switch (c.kind) {
    case 'line':
      return c.a * x + c.h;
    case 'parabola':
      return c.a * (x - c.h) ** 2 + c.k;
    case 'abs':
      return c.a * Math.abs(x - c.h) + c.k;
    case 'exp':
      return c.a ** (x - c.h) + c.k;
    case 'log':
      return x > c.h ? Math.log(x - c.h) / Math.log(c.a) + c.k : NaN;
    case 'sin':
      return c.a * Math.sin(x) + c.k;
    case 'cos':
      return c.a * Math.cos(x) + c.k;
  }
};

const SAMPLE = [-4, -2.5, -1, 0, 0.5, 1, 2.5, 4, 5.5];
/** The same curve, as far as anyone could tell from the picture (drawn at the same places, to the same heights). */
const same = (p: Curve, r: Curve) =>
  SAMPLE.every((x) => {
    const a = valueAt(p, x);
    const b = valueAt(r, x);
    return Number.isNaN(a) ? Number.isNaN(b) : Math.abs(a - b) < 1e-9;
  });

const SLOPES = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];
const HALF = 0.5;

/** The kinds a stage brings in. */
const KINDS: Kind[][] = [['line'], ['parabola'], ['abs'], ['exp', 'log'], ['sin', 'cos']];

/**
 * The kind for a round at `level` (1–5): mostly the level's own, sometimes one from below, so nothing learnt is left
 * behind.
 */
export const kindAt = (level: number): Kind => {
  const lv = Math.min(5, Math.max(1, level));
  const from = lv > 1 && rnd() < 0.35 ? int(1, lv - 1) : lv;
  return pick(KINDS[from - 1]);
};

/** The level of the n-th round in the day's challenge: three of each, then any. */
export const levelOfRound = (n: number) => Math.min(5, 1 + Math.floor(n / 3));

function target(kind: Kind): Curve {
  switch (kind) {
    case 'line':
      return {kind, a: pick(SLOPES), h: int(-4, 4), k: 0};
    case 'parabola':
    case 'abs':
      return {kind, a: pick([1, -1]), h: int(-3, 3), k: int(-3, 3)};
    case 'exp':
      // Through (h, 1 + k), flat towards y = k.
      return {kind, a: pick([2, HALF]), h: int(-2, 2), k: int(-3, 2)};
    case 'log':
      // Through (h + 1, k), up the wall x = h.
      return {kind, a: pick([2, HALF]), h: int(-3, 2), k: int(-2, 2)};
    case 'sin':
    case 'cos':
      return {kind, a: pick([1, 2, -1, -2]), h: 0, k: int(-2, 2)};
  }
}

/** The slips: the same family with one thing changed. */
function slips(c: Curve): Curve[] {
  switch (c.kind) {
    case 'line':
      return [
        {...c, a: -c.a},
        {...c, h: -c.h},
        {...c, a: -c.a, h: -c.h},
        {...c, a: c.a === 0.5 || c.a === -0.5 ? c.a * 4 : c.a / 2},
        {...c, h: c.h + (c.h >= 0 ? -2 : 2)},
        {...c, a: Math.abs(c.a) === 1 ? c.a * 2 : Math.sign(c.a)},
      ];
    case 'parabola':
    case 'abs':
      return [
        {...c, h: -c.h},
        {...c, a: -c.a},
        {...c, k: -c.k},
        {...c, h: c.h + 1},
        {...c, k: c.k + (c.k >= 0 ? -2 : 2)},
        {...c, a: -c.a, k: -c.k},
      ];
    case 'exp':
    case 'log':
      return [
        {...c, a: c.a === 2 ? HALF : 2},
        {...c, h: -c.h},
        {...c, k: -c.k},
        {...c, h: c.h + (c.h >= 0 ? -1 : 1)},
        {...c, k: c.k + (c.k >= 0 ? -2 : 2)},
        {...c, a: c.a === 2 ? HALF : 2, h: -c.h},
      ];
    case 'sin':
    case 'cos':
      return [
        {...c, kind: c.kind === 'sin' ? 'cos' : 'sin'},
        {...c, a: -c.a},
        {...c, k: -c.k},
        {...c, a: Math.abs(c.a) === 1 ? c.a * 2 : c.a / 2},
        {...c, k: c.k + (c.k >= 0 ? -2 : 2)},
        {...c, kind: c.kind === 'sin' ? 'cos' : 'sin', a: -c.a},
      ];
  }
}

/** A round with a curve of `kind`, from `rng` when given. */
export function roundOf(kind: Kind, rng?: Rng): Round {
  return withRng(rng, () => {
    const curve = target(kind);
    const wrong: Curve[] = [];
    for (const s of shuffle(slips(curve))) if (!same(s, curve) && !wrong.some((w) => same(w, s)) && wrong.length < 3) wrong.push(s);
    // (Too few slips differ when a number is 0: a nearby curve of the same family fills the place.)
    while (wrong.length < 3) {
      const s = target(curve.kind === 'sin' || curve.kind === 'cos' ? pick(['sin', 'cos'] as const) : curve.kind);
      if (!same(s, curve) && !wrong.some((w) => same(w, s))) wrong.push(s);
    }
    return {curve, choices: shuffle([curve, ...wrong])};
  });
}

/** A round at `level` (1–5). */
export const newRound = (level: number, rng?: Rng) => roundOf(withRng(rng, () => kindAt(level)), rng);

const coef = (a: number) => (a === 1 ? '' : a === -1 ? '-' : a === 0.5 ? '\\tfrac{1}{2}' : a === -0.5 ? '-\\tfrac{1}{2}' : String(a));
const plus = (b: number) => (b > 0 ? ` + ${b}` : b < 0 ? ` - ${-b}` : '');
const inner = (h: number) => (h === 0 ? 'x' : h > 0 ? `x - ${h}` : `x + ${-h}`);
const base = (a: number) => (a === 0.5 ? '\\left(\\tfrac{1}{2}\\right)' : String(a));

/** The equation as plain words for a screen reader («y = −1/2 x + 3»): KaTeX's own reading isn't a button's name. */
export function say(c: Curve) {
  const m = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
  const k = (a: number) => (a === 1 ? '' : a === -1 ? '−' : Math.abs(a) === 0.5 ? `${a < 0 ? '−' : ''}1/2 ` : `${m(a)} `);
  const tail = (b: number) => (b > 0 ? ` + ${b}` : b < 0 ? ` − ${-b}` : '');
  const x = (h: number) => (h === 0 ? 'x' : h > 0 ? `x − ${h}` : `x + ${-h}`);
  const b = c.a === 0.5 ? '1/2' : String(c.a);
  switch (c.kind) {
    case 'line':
      return `y = ${k(c.a)}x${tail(c.h)}`;
    case 'parabola':
      return `y = ${c.a < 0 ? '−' : ''}${c.h === 0 ? 'x²' : `(${x(c.h)})²`}${tail(c.k)}`;
    case 'abs':
      return `y = ${c.a < 0 ? '−' : ''}|${x(c.h)}|${tail(c.k)}`;
    case 'exp':
      return `y = ${b} зэрэгт ${x(c.h)}${tail(c.k)}`;
    case 'log':
      return `y = log суурь ${b} (${x(c.h)})${tail(c.k)}`;
    case 'sin':
    case 'cos':
      return `y = ${k(c.a)}${c.kind} x${tail(c.k)}`;
  }
}

/** The equation in KaTeX (within $…$ for MathText). */
export function tex(c: Curve) {
  switch (c.kind) {
    case 'line':
      return `$y = ${coef(c.a)}x${plus(c.h)}$`;
    case 'parabola':
      return `$y = ${c.a < 0 ? '-' : ''}${c.h === 0 ? 'x^2' : `(${inner(c.h)})^2`}${plus(c.k)}$`;
    case 'abs':
      return `$y = ${c.a < 0 ? '-' : ''}\\lvert ${inner(c.h)} \\rvert${plus(c.k)}$`;
    case 'exp':
      return `$y = ${base(c.a)}^{${inner(c.h)}}${plus(c.k)}$`;
    case 'log':
      return `$y = \\log_{${c.a === 0.5 ? '\\frac{1}{2}' : c.a}} ${c.h === 0 ? 'x' : `(${inner(c.h)})`}${plus(c.k)}$`;
    case 'sin':
    case 'cos':
      return `$y = ${coef(c.a)}\\${c.kind} x${plus(c.k)}$`;
  }
}

/** Where a curve can be read: the point to look at (inside the picture), for the check that each one can. */
export const keyPoint = (c: Curve): [number, number] =>
  c.kind === 'line' ? [0, c.h] : c.kind === 'exp' ? [c.h, 1 + c.k] : c.kind === 'log' ? [c.h + 1, c.k] : c.kind === 'sin' || c.kind === 'cos' ? [0, valueAt(c, 0)] : [c.h, c.k];

/** Why the picked curve isn't the one drawn: what to look at in the picture (for the review). */
export function whyNot(right: Curve, picked: Curve): string {
  if (right.kind !== picked.kind) return '$x = 0$ үед sin x дундаж шугам дээрээ, cos x хамгийн дээд эсвэл доод цэгтээ байдаг';
  switch (right.kind) {
    case 'line':
      if (Math.sign(right.a) !== Math.sign(picked.a)) return 'Баруун тийш өгсөж байвал налалт эерэг, буурч байвал сөрөг';
      if (right.h !== picked.h) return `Шулуун y тэнхлэгийг $(0;\\ ${right.h})$ цэгт огтолж байна`;
      return 'x нэгээр өсөхөд y хэдээр өөрчлөгдөхийг хар';
    case 'parabola':
    case 'abs':
      if (right.a !== picked.a) return right.a > 0 ? 'Салаа нь дээшээ тул урд нь хасах тэмдэггүй' : 'Салаа нь доошоо тул урд нь хасах тэмдэгтэй';
      if (right.h !== picked.h) return `Орой нь $x = ${right.h}$ дээр байна. $(x - h)$ нь графикийг баруун тийш h нэгж шилжүүлнэ`;
      return `Орой нь $y = ${right.k}$ өндөрт байна`;
    case 'exp':
      if (right.a !== picked.a) return right.a === 2 ? 'Баруун тийш өсөж байгаа тул суурь нь 2' : 'Баруун тийш буурч байгаа тул суурь нь ½';
      if (right.h !== picked.h) return `$x = ${right.h}$ үед зэрэг нь 0 болж, график $(${right.h};\\ ${1 + right.k})$ цэгээр гарна`;
      return `График $y = ${right.k}$ шулуун руу ойртож байна`;
    case 'log':
      if (right.a !== picked.a) return right.a === 2 ? 'Баруун тийш өсөж байгаа тул суурь нь 2' : 'Баруун тийш буурч байгаа тул суурь нь ½';
      if (right.h !== picked.h) return `График $x = ${right.h}$ шулууны баруун талд л байна`;
      return `График $(${right.h + 1};\\ ${right.k})$ цэгээр гарч байна`;
    case 'sin':
    case 'cos':
      if (Math.sign(right.a) !== Math.sign(picked.a)) return 'Урд нь хасах тэмдэг байвал график доош эргэнэ';
      if (Math.abs(right.a) !== Math.abs(picked.a)) return `Дундаж шугамаас $${Math.abs(right.a)}$ нэгжээр дээш, доош хэлбэлзэж байна`;
      return `Дундаж шугам нь $y = ${right.k}$`;
  }
}
