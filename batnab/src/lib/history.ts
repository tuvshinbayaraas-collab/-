// Each week's scores, kept after the weekly reset: history/{uid}/{weekStart}/{test} = {score (best attempt, when the
// test had a key), total, n (attempts)}. Whoever clears a finished week's results first (the student's own device, or
// the teacher's dashboard for everyone) writes the summary in the same step.
import {get, ref, update} from 'firebase/database';
import {db} from './firebase';
import {grade, percent, type Grade} from './keys';
import {useLive} from './live';
import type {Result} from './results';
import {inThisWeek, weekOf} from './week';
import {testInfo} from '../tests';

export type History = Record<string, Record<string, {score?: number; total: number; n: number}>>;

export const useHistory = (uid: string | undefined) => useLive(uid ? `history/${uid}` : null, (v) => (v ?? {}) as History);

/**
 * The writes that move finished weeks' results into the history: a summary per week and test, and the results
 * themselves removed. `keys` are the tests' keys (undefined: not readable now, so that test waits); `have` is the
 * history already there (not written again).
 */
export function archiveOps(uid: string, results: Result[], keys: Record<string, string | null | undefined>, have: History) {
  const ops: Record<string, unknown> = {};
  const groups = new Map<string, Result[]>();
  for (const r of results) {
    if (inThisWeek(r.at) || !testInfo(r.test) || keys[r.test] === undefined) continue;
    const k = `${weekOf(r.at)}/${r.test}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, rs] of groups) {
    const [week, test] = k.split('/');
    const count = testInfo(test)!.count;
    if (!have[week]?.[test]) {
      const gs = rs.map((r) => grade(r.answers, keys[test], count)).filter((g): g is Grade => !!g);
      const best = gs.reduce<Grade | null>((b, g) => (!b || percent(g) > percent(b) ? g : b), null);
      ops[`history/${uid}/${week}/${test}`] = best ? {score: best.score, total: best.total, n: rs.length} : {total: count, n: rs.length};
    }
    for (const r of rs) ops[`results/${uid}/${r.test}/${r.id}`] = null;
  }
  return ops;
}

/** On the student's device: last weeks' results become history, then go. */
export async function archiveMine(uid: string, results: Result[]) {
  const old = results.filter((r) => !inThisWeek(r.at));
  if (!old.length) return;
  const keys: Record<string, string | null | undefined> = {};
  for (const test of new Set(old.map((r) => r.test)))
    keys[test] = await get(ref(db, `keys/${test}`)).then(
      (s) => (typeof s.val() === 'string' ? s.val() : null),
      () => undefined, // e.g. an exam on that test right now: try again later
    );
  const have = ((await get(ref(db, `history/${uid}`)).catch(() => null))?.val() ?? {}) as History;
  const ops = archiveOps(uid, old, keys, have);
  if (Object.keys(ops).length) await update(ref(db), ops);
}
