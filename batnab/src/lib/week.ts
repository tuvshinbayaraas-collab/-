// Scores start over every week: at the end of Friday (Saturday 00:00, Ulaanbaatar time = Friday 16:00 UTC) all results
// are cleared. The same arithmetic is in database.rules.json, which lets students delete their own older results.
const WEEK = 7 * 24 * 3600 * 1000;
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

// "Хамгийн өндөр оноо" runs in rounds of two weeks (the per-test boards stay weekly): at the end of a round its top 3
// get that round's medals. The first round began Saturday 31 October 2026; weeks before it were rounds of their own.
export const ROUND = 2 * WEEK;
export const ROUND_ANCHOR = 1_793_376_000_000;

/** The start of the round `at` falls in (a week of its own before the first round). */
export const roundStart = (at = Date.now()) => (at < ROUND_ANCHOR ? weekStart(at) : ROUND_ANCHOR + Math.floor((at - ROUND_ANCHOR) / ROUND) * ROUND);
/** How long the round starting at `start` lasts. */
export const roundLength = (start: number) => (start < ROUND_ANCHOR ? WEEK : ROUND);
/** Rounds counted from 1 (0 for the weekly ones before). */
export const roundNo = (start: number) => (start < ROUND_ANCHOR ? 0 : Math.floor((start - ROUND_ANCHOR) / ROUND) + 1);
/** The week starts of the round starting at `start`. */
export const roundWeeks = (start: number) => (start < ROUND_ANCHOR ? [start] : [start, start + WEEK]);

/** "2 өдөр 5 цаг" until `end`. */
export function until(end: number, now = Date.now()) {
  const m = Math.max(1, Math.round((end - now) / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d} өдөр ${h} цаг`;
  if (h) return `${h} цаг ${m % 60} мин`;
  return `${m} мин`;
}
