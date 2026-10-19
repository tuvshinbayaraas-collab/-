// The mistakes notebook ("Алдааны дэвтэр"): every problem a student got wrong, to solve again until it sticks.
//   mistakes/{uid}/{id} = {s: 'p' (topic problem) | 't' (test question), t: topic or test, q: problem id or question
//   index, box, next, at}. Solved right, a problem moves up a box and comes back later (tomorrow, in 3 days, in a
//   week); right in the last box, it is learned and leaves the notebook. Wrong, it starts over tomorrow.
//   mistakeTests/{uid}/{test} = true keeps a test's key readable for its questions after the weekly reset.
import {get, ref, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {entries, useLive} from './live';
import {serverNow} from './time';

export interface Mistake {
  id: string;
  s: 'p' | 't';
  t: string;
  q: string;
  box: number;
  next: number;
  at: number;
}

const DAY = 86_400_000;
/** Days until a problem comes back, by box (box 0: right away). */
const WAIT = [0, 1, 3, 7];
export const LAST_BOX = WAIT.length - 1;

/** A short id for a problem, the same every time (so a mistake is only listed once). */
export function mistakeId(s: 'p' | 't', t: string, q: string) {
  let h = 0x811c9dc5;
  for (const ch of `${t}/${q}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return `${s}${h.toString(36)}`;
}

export const useMistakes = (uid: string | undefined) =>
  useLive(uid ? `mistakes/${uid}` : null, (v) => entries<Omit<Mistake, 'id'>>(v).filter((m) => (m.s === 'p' || m.s === 't') && typeof m.next === 'number'));

export const isDue = (m: Mistake, now = serverNow()) => m.next <= now;

/** Puts problems in the notebook (those already there stay as they are). */
export async function addMistakes(items: {s: 'p' | 't'; t: string; q: string}[], have: Mistake[] | null) {
  const uid = auth.currentUser?.uid;
  if (!uid || !items.length) return;
  const known = new Set((have ?? []).map((m) => m.id));
  const now = serverNow();
  const ops: Record<string, unknown> = {};
  for (const it of items) {
    const id = mistakeId(it.s, it.t, it.q);
    if (known.has(id) || ops[`mistakes/${uid}/${id}`]) continue;
    ops[`mistakes/${uid}/${id}`] = {s: it.s, t: it.t, q: it.q, box: 0, next: now, at: now};
  }
  if (!Object.keys(ops).length) return;
  await update(ref(db), ops);
  // Test questions: keep the test's key readable for the notebook after this week's results are cleared.
  // Marked once (the rules refuse a second write).
  for (const test of new Set(items.filter((i) => i.s === 't').map((i) => i.t))) {
    const mark = ref(db, `mistakeTests/${uid}/${test}`);
    if (!(await get(mark).then((x) => x.exists(), () => false))) await set(mark, true).catch(() => {});
  }
}

/** After solving a notebook problem: up a box (or learned), or back to the start. Returns true when learned. */
export async function reviewed(m: Mistake, right: boolean) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const path = `mistakes/${uid}/${m.id}`;
  if (right && m.box >= LAST_BOX) {
    await set(ref(db, path), null);
    return true;
  }
  const now = serverNow();
  const box = right ? m.box + 1 : 0;
  // Wrong: tomorrow. Right: after the wait of its new box.
  await update(ref(db, path), {box, next: now + (right ? WAIT[box] : 1) * DAY});
  return false;
}
