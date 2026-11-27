// Chance for the games' problems: Math.random, or a seeded source so that everyone gets the same problems (the day's
// challenge, lib/games). The generators take their numbers from `rnd()`; `withRng` makes one of them draw from a
// given source for as long as it runs (they are synchronous, so nothing else draws in between).

export type Rng = () => number;

let current: Rng = Math.random;

/** A number in [0, 1) from the source in use. */
export const rnd = () => current();

/** Runs `f` with its draws from `r` (or Math.random when there is none). */
export function withRng<T>(r: Rng | undefined, f: () => T): T {
  if (!r) return f();
  const before = current;
  current = r;
  try {
    return f();
  } finally {
    current = before;
  }
}

/** mulberry32: a small seeded source, the same numbers on every phone for the same seed. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from words and numbers (FNV-1a). */
export function seedOf(...parts: (string | number)[]) {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
export const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
export const coin = () => rnd() < 0.5;
export function shuffle<T>(xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
