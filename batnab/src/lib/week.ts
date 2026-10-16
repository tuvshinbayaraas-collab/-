// Scores start over every week: at the end of Friday (Saturday 00:00, Ulaanbaatar time = Friday 16:00 UTC) all results
// are cleared. The same arithmetic is in database.rules.json, which lets students delete their own older results.
const WEEK = 7 * 24 * 3600 * 1000;
/** A Saturday 00:00 in Ulaanbaatar (1970-01-02 16:00 UTC), in milliseconds since the epoch. */
const ANCHOR = 144_000_000;

/** When the current week started (the last reset). */
export const weekStart = (now = Date.now()) => now - ((now - ANCHOR) % WEEK);
/** When the next reset happens. */
export const nextReset = (now = Date.now()) => weekStart(now) + WEEK;
export const inThisWeek = (at: number, now = Date.now()) => at >= weekStart(now);

/** "2 өдөр 5 цаг", "3 цаг 10 мин", "12 мин" until the next reset. */
export function untilReset(now = Date.now()) {
  const m = Math.max(1, Math.round((nextReset(now) - now) / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d} өдөр ${h} цаг`;
  if (h) return `${h} цаг ${m % 60} мин`;
  return `${m} мин`;
}
