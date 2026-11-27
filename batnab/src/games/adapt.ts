// How hard the next problem is: three right in a row take it a level up, a wrong one a level down. Such a ladder
// settles where about four answers in five are right (79%), the band where practice teaches most; the next game
// starts a level below the highest reached, so it warms up but doesn't begin from the easiest again.

export interface Ladder {
  level: number;
  /** Right answers in a row at this level. */
  run: number;
  /** The highest level reached in this game. */
  top: number;
  max: number;
}

export const ladder = (start: number, max = 5): Ladder => {
  const level = Math.min(max, Math.max(1, Math.round(start) || 1));
  return {level, run: 0, top: level, max};
};

export function climb(l: Ladder, good: boolean): Ladder {
  if (!good) return {...l, level: Math.max(1, l.level - 1), run: 0};
  if (l.run + 1 < 3) return {...l, run: l.run + 1};
  const level = Math.min(l.max, l.level + 1);
  return {...l, level, run: 0, top: Math.max(l.top, level)};
}

/** Where the next game starts. */
export const nextStart = (l: Ladder) => Math.max(1, l.top - 1);
