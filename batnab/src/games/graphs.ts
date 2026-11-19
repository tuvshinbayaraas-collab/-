// «График таах»: a graph, and four equations of the same kind to pick from: lines first, then parabolas, then |x|.
// The wrong ones are the slips one makes reading a graph (a sign turned, the shift the wrong way), never the same curve
// as the right one; every graph shows where it can be read (its intercept, its vertex) inside the picture.

export type Kind = 'line' | 'parabola' | 'abs';

export interface Curve {
  kind: Kind;
  /** line: slope; parabola, |x|: 1 or −1 (opening up or down). */
  a: number;
  /** line: where it crosses the y axis; parabola, |x|: how far right the vertex is. */
  h: number;
  /** parabola, |x|: how high the vertex is (lines: unused, 0). */
  k: number;
}

export interface Round {
  curve: Curve;
  /** Four, one of them `curve`, in a random order. */
  choices: Curve[];
}

export const valueAt = (c: Curve, x: number) => (c.kind === 'line' ? c.a * x + c.h : c.kind === 'parabola' ? c.a * (x - c.h) ** 2 + c.k : c.a * Math.abs(x - c.h) + c.k);

/** The same curve, as far as anyone could tell from the picture. */
const same = (p: Curve, r: Curve) => p.kind === r.kind && [-4, -2.5, -1, 0, 1, 2.5, 4].every((x) => Math.abs(valueAt(p, x) - valueAt(r, x)) < 1e-9);

const int = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const shuffle = <T,>(xs: T[]) => {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
};

const SLOPES = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];

/** The kind for the n-th round: lines, then parabolas, then all three. */
export const kindFor = (n: number): Kind => (n < 3 ? 'line' : n < 6 ? 'parabola' : pick(['line', 'parabola', 'abs'] as const));

function target(kind: Kind): Curve {
  if (kind === 'line') return {kind, a: pick(SLOPES), h: int(-4, 4), k: 0};
  return {kind, a: pick([1, -1]), h: int(-3, 3), k: int(-3, 3)};
}

/** The slips: the same kind with one thing changed. */
function slips(c: Curve): Curve[] {
  if (c.kind === 'line')
    return [
      {...c, a: -c.a},
      {...c, h: -c.h},
      {...c, a: -c.a, h: -c.h},
      {...c, a: c.a === 0.5 || c.a === -0.5 ? c.a * 4 : c.a / 2},
      {...c, h: c.h + (c.h >= 0 ? -2 : 2)},
      {...c, a: Math.abs(c.a) === 1 ? c.a * 2 : Math.sign(c.a)},
    ];
  return [
    {...c, h: -c.h},
    {...c, a: -c.a},
    {...c, k: -c.k},
    {...c, h: c.h + 1},
    {...c, k: c.k + (c.k >= 0 ? -2 : 2)},
    {...c, a: -c.a, k: -c.k},
  ];
}

export function newRound(n: number): Round {
  const curve = target(kindFor(n));
  const wrong: Curve[] = [];
  for (const s of shuffle(slips(curve))) if (!same(s, curve) && !wrong.some((w) => same(w, s)) && wrong.length < 3) wrong.push(s);
  // (Too few slips differ when a number is 0: a nearby curve of the same kind fills the place.)
  while (wrong.length < 3) {
    const s = target(curve.kind);
    if (!same(s, curve) && !wrong.some((w) => same(w, s))) wrong.push(s);
  }
  return {curve, choices: shuffle([curve, ...wrong])};
}

const coef = (a: number) => (a === 1 ? '' : a === -1 ? '-' : a === 0.5 ? '\\tfrac{1}{2}' : a === -0.5 ? '-\\tfrac{1}{2}' : String(a));
const plus = (b: number) => (b > 0 ? ` + ${b}` : b < 0 ? ` - ${-b}` : '');
const inner = (h: number) => (h === 0 ? 'x' : h > 0 ? `x - ${h}` : `x + ${-h}`);

/** The equation as plain words for a screen reader («y = −1/2 x + 3»): KaTeX's own reading isn't a button's name. */
export function say(c: Curve) {
  const m = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
  const k = (a: number) => (a === 1 ? '' : a === -1 ? '−' : Math.abs(a) === 0.5 ? `${a < 0 ? '−' : ''}1/2 ` : `${m(a)} `);
  const tail = (b: number) => (b > 0 ? ` + ${b}` : b < 0 ? ` − ${-b}` : '');
  const x = (h: number) => (h === 0 ? 'x' : h > 0 ? `x − ${h}` : `x + ${-h}`);
  if (c.kind === 'line') return `y = ${k(c.a)}x${tail(c.h)}`;
  const sign = c.a < 0 ? '−' : '';
  if (c.kind === 'parabola') return `y = ${sign}${c.h === 0 ? 'x²' : `(${x(c.h)})²`}${tail(c.k)}`;
  return `y = ${sign}|${x(c.h)}|${tail(c.k)}`;
}

/** The equation in KaTeX (within $…$ for MathText). */
export function tex(c: Curve) {
  if (c.kind === 'line') return `$y = ${coef(c.a)}x${plus(c.h)}$`;
  const sign = c.a < 0 ? '-' : '';
  if (c.kind === 'parabola') return `$y = ${sign}${c.h === 0 ? 'x^2' : `(${inner(c.h)})^2`}${plus(c.k)}$`;
  return `$y = ${sign}\\lvert ${inner(c.h)} \\rvert${plus(c.k)}$`;
}
