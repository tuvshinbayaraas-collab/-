// The mistakes notebook ("Алдааны дэвтэр"): every problem a student got wrong, to solve again until it sticks.
//   mistakes/{uid}/{id} = {s: 'p' (topic problem) | 't' (test question), t: topic or test, q: problem id or question
//   index, box, next, at, why?, note?, done?}. Solved right, a problem moves up a box and comes back later (tomorrow,
//   in 3 days, in a week); right in the last box (on a similar problem, Practice.tsx), it is learned: kept with `done`
//   (when), to look at again. Wrong, it starts over tomorrow. `why`: the student's own reason for the mistake;
//   `note`: their own few words on it.
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
  why?: Why;
  note?: string;
  /** When it was learned: out of the notebook, kept to look at again. */
  done?: number;
}

/** Why a problem went wrong, as the student sees it. */
export type Why = 'formula' | 'calc' | 'read' | 'guess';
export const WHYS: [Why, string, string][] = [
  ['formula', 'Томьёо мартсан', 'Томьёогоо жижиг картанд бичиж, өдөр бүр нэг харж байгаарай.'],
  ['calc', 'Тооцоонд алдсан', 'Тооцоогоо алхам алхмаар, яаралгүй хийж, эцэст нь буцааж шалгаарай.'],
  ['read', 'Нөхцөлийг буруу уншсан', 'Нөхцөлийг хоёр удаа уншиж, юу асууж байгааг доогуур нь зураарай.'],
  ['guess', 'Таасан', 'Таасан бодлогын сэдвийг эхнээс нь давтаарай — ойлгоогүй хэсэг үлдсэн байна.'],
];
export const NOTE_MAX = 300;

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

export const isDue = (m: Mistake, now = serverNow()) => !m.done && m.next <= now;
/** Still in the notebook (not learned yet). */
export const open = (m: Mistake) => !m.done;

/** Puts problems in the notebook (those already there stay as they are; one learned before comes back in). */
export async function addMistakes(items: {s: 'p' | 't'; t: string; q: string}[], have: Mistake[] | null) {
  const uid = auth.currentUser?.uid;
  if (!uid || !items.length) return;
  const known = new Map((have ?? []).map((m) => [m.id, m]));
  const now = serverNow();
  const ops: Record<string, unknown> = {};
  for (const it of items) {
    const id = mistakeId(it.s, it.t, it.q);
    const was = known.get(id);
    if ((was && !was.done) || ops[`mistakes/${uid}/${id}`] || ops[`mistakes/${uid}/${id}/box`]) continue;
    if (was) Object.assign(ops, {[`mistakes/${uid}/${id}/box`]: 0, [`mistakes/${uid}/${id}/next`]: now, [`mistakes/${uid}/${id}/done`]: null});
    else ops[`mistakes/${uid}/${id}`] = {s: it.s, t: it.t, q: it.q, box: 0, next: now, at: now};
  }
  if (!Object.keys(ops).length) return;
  await update(ref(db), ops);
  // Test questions: keep the test's key readable for the notebook after this week's results are cleared.
  // Marked once (the rules refuse a second write).
  for (const test of new Set(items.filter((i) => i.s === 't').map((i) => i.t))) {
    const mark = ref(db, `mistakeTests/${uid}/${test}`);
    if (
      !(await get(mark).then(
        (x) => x.exists(),
        () => false,
      ))
    )
      await set(mark, true).catch(() => {});
  }
}

/** After solving a notebook problem: up a box (or learned), or back to the start. Returns true when learned. */
export async function reviewed(m: Mistake, right: boolean) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const path = `mistakes/${uid}/${m.id}`;
  if (right && m.box >= LAST_BOX) {
    await update(ref(db, path), {done: serverNow()});
    return true;
  }
  const now = serverNow();
  const box = right ? m.box + 1 : 0;
  // Wrong: tomorrow. Right: after the wait of its new box.
  await update(ref(db, path), {box, next: now + (right ? WAIT[box] : 1) * DAY});
  return false;
}

const mine = (m: Mistake) => {
  const uid = auth.currentUser?.uid;
  return uid ? ref(db, `mistakes/${uid}/${m.id}`) : null;
};

/** The reason the student gives for the mistake (the same one again: none). */
export async function setWhy(m: Mistake, why: Why | null) {
  const r = mine(m);
  if (r) await update(r, {why: why === m.why ? null : why});
}

/** The student's own note on the problem (empty: none). */
export async function setNote(m: Mistake, note: string) {
  const r = mine(m);
  if (r) await update(r, {note: note.trim().slice(0, NOTE_MAX) || null});
}

/** A learned problem back into the notebook, from the start. */
export async function reopen(m: Mistake) {
  const r = mine(m);
  if (r) await update(r, {done: null, box: 0, next: serverNow()});
}
