// Scores start over every week: at the end of Friday (Saturday 00:00, Ulaanbaatar time = Friday 16:00 UTC) all results
// are cleared. The same arithmetic is in database.rules.json, which lets students delete their own older results.
export const WEEK = 7 * 24 * 3600 * 1000;
/** A Saturday 00:00 in Ulaanbaatar (1970-01-02 16:00 UTC), in milliseconds since the epoch. */
const ANCHOR = 144_000_000;

/** When the current week started (the last reset). */
export const weekStart = (now = Date.now()) => now - ((now - ANCHOR) % WEEK);
/** The start of the week `at` falls in. */
export const weekOf = (at: number) => weekStart(at);
/** When the next reset happens. */
export const nextReset = (now = Date.now()) => weekStart(now) + WEEK;
export const inThisWeek = (at: number, now = Date.now()) => at >= weekStart(now);

/** "2 өдөр 5 цаг", "3 цаг 10 мин", "12 мин" until the next reset. */
export const untilReset = (now = Date.now()) => until(nextReset(now), now);

// Medals are given every week. From the week of Saturday 31 October 2026 each week has its number, and with it its
// animal (lib/leaderboard: the 1st the Horse's); the weeks before it have none.
export const WEEK_ONE = 1_793_376_000_000;
/** The week starting at `start` counted from 1 (0 before the animals). */
export const weekNo = (start: number) => (start < WEEK_ONE ? 0 : Math.floor((start - WEEK_ONE) / WEEK) + 1);

/** "2 өдөр 5 цаг" until `end`. */
export function until(end: number, now = Date.now()) {
  const m = Math.max(1, Math.round((end - now) / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d} өдөр ${h} цаг`;
  if (h) return `${h} цаг ${m % 60} мин`;
  return `${m} мин`;
}
