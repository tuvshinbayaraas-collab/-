// Class polls («Ангийн санал асуулга»): a student asks their class something; classmates pick an answer and, once
// they have, see how the class answered (never who). The teacher sees who asked and who picked what, and may close or
// delete any; a switch (settings/studentPolls) turns the whole thing off.
//   classPolls/{class}/{uid}/{slot} = {id, q, options: [2–6], multi?, closed? (when), at}
//                 slot 1–3: a student has at most three at a time (the rules hold it); `id` is new for each poll, so a
//                 poll made later in the same slot never takes the old one's votes.
//   classPollVotes/{class}/{uid}/{slot}/{voter} = {id (the poll's), c: {index: true}, at}: one each, changed as they
//                 like while it is open; the author deletes the poll and its votes together.
import {push, ref, serverTimestamp, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {useLive} from './live';

export const SLOTS = ['1', '2', '3'] as const;
export const MAX_CLASS_OPTIONS = 6;
/** Closed this long ago, a poll leaves the classmates' page (its author still sees it, to delete it). */
export const CLOSED_SHOWN = 3 * 86_400_000;

export interface ClassPoll {
  cls: string;
  /** Who asked (shown to the teacher only). */
  by: string;
  slot: string;
  id: string;
  q: string;
  options: string[];
  multi: boolean;
  /** When it was closed; 0 while open. */
  closed: number;
  at: number;
}

export type ClassVotes = Record<string, Record<string, {id: string; c: number[]; at: number}>>;

const pollKey = (p: Pick<ClassPoll, 'by' | 'slot'>) => `${p.by}/${p.slot}`;

function parsePoll(cls: string, by: string, slot: string, v: unknown): ClassPoll | null {
  const x = v as Partial<Record<keyof ClassPoll, unknown>> | null;
  if (!x || typeof x !== 'object' || typeof x.q !== 'string' || typeof x.id !== 'string' || !(SLOTS as readonly string[]).includes(slot)) return null;
  // The options by their place ("0", "1"…), as the votes name them.
  const raw = (x.options ?? {}) as Record<string, unknown>;
  const options: string[] = [];
  for (let i = 0; i < MAX_CLASS_OPTIONS && typeof raw[i] === 'string'; i++) options.push(raw[i] as string);
  if (options.length < 2) return null;
  return {cls, by, slot, id: x.id, q: x.q, options, multi: x.multi === true, closed: Number(x.closed) || 0, at: Number(x.at) || 0};
}

/** classPolls/{class} (or the whole node, the teacher) → polls, newest first. */
function parseClass(cls: string, v: unknown) {
  return Object.entries((v ?? {}) as Record<string, Record<string, unknown>>).flatMap(([by, slots]) =>
    Object.entries(slots ?? {}).flatMap(([slot, p]) => parsePoll(cls, by, slot, p) ?? []),
  );
}
const newest = (a: ClassPoll, b: ClassPoll) => b.at - a.at;

/** The polls of the student's class; null while loading. */
export const useClassPolls = (cls: string | null | undefined, on = true) => useLive(on && cls ? `classPolls/${cls}` : null, (v) => parseClass(cls!, v).sort(newest));

/** Every class's polls (the teacher). */
export const useAllClassPolls = (on = true) =>
  useLive(on ? 'classPolls' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, unknown>)
      .flatMap(([cls, x]) => parseClass(cls, x))
      .sort(newest),
  );

function parseVotes(v: unknown): ClassVotes {
  const out: ClassVotes = {};
  for (const [by, slots] of Object.entries((v ?? {}) as Record<string, Record<string, Record<string, unknown>>>))
    for (const [slot, voters] of Object.entries(slots ?? {}))
      for (const [voter, x] of Object.entries(voters ?? {})) {
        const vote = x as {id?: unknown; c?: Record<string, unknown>; at?: unknown} | null;
        if (!vote || typeof vote.id !== 'string') continue;
        const c = Object.entries(vote.c ?? {})
          .filter(([, on]) => on === true)
          .map(([i]) => Number(i))
          .filter((i) => Number.isInteger(i) && i >= 0)
          .sort((a, b) => a - b);
        (out[`${by}/${slot}`] ??= {})[voter] = {id: vote.id, c, at: Number(vote.at) || 0};
      }
  return out;
}

/** The votes in a class (classPollVotes/{class}): "{by}/{slot}" → voter → vote. */
export const useClassVotes = (cls: string | null | undefined, on = true) => useLive(on && cls ? `classPollVotes/${cls}` : null, parseVotes);

/** Every class's votes (the teacher): class → as useClassVotes. */
export const useAllClassVotes = (on = true) =>
  useLive(on ? 'classPollVotes' : null, (v) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).map(([cls, x]) => [cls, parseVotes(x)])) as Record<string, ClassVotes>);

/**
 * One poll's answers: only votes for this poll (its id: not one made earlier in the slot), only options it has, and
 * one pick each where only one may be picked. voter → the options picked.
 */
export function votesOf(p: ClassPoll, votes: ClassVotes | null | undefined): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [voter, v] of Object.entries(votes?.[pollKey(p)] ?? {})) {
    if (v.id !== p.id) continue;
    const c = v.c.filter((i) => i < p.options.length);
    if (c.length) out[voter] = p.multi ? c : c.slice(0, 1);
  }
  return out;
}

/** How many picked each option, and how many answered. */
export function tally(p: ClassPoll, votes: ClassVotes | null | undefined) {
  const by = Object.values(votesOf(p, votes));
  return {voters: by.length, counts: p.options.map((_, i) => by.filter((c) => c.includes(i)).length)};
}

/** The student's polls take the free slots; null when all three are used. */
export const freeSlot = (mine: ClassPoll[]) => SLOTS.find((s) => !mine.some((p) => p.slot === s)) ?? null;

export function createClassPoll(cls: string, slot: string, p: {q: string; options: string[]; multi: boolean}) {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Нэвтэрнэ үү'));
  const options = p.options.map((o) => o.trim().slice(0, 80)).filter(Boolean).slice(0, MAX_CLASS_OPTIONS);
  const q = p.q.trim().slice(0, 200);
  if (!q || options.length < 2) return Promise.reject(new Error('Асуулт, хоёроос доошгүй сонголт бичнэ үү.'));
  return set(ref(db, `classPolls/${cls}/${uid}/${slot}`), {
    id: push(ref(db, 'classPolls')).key!,
    q,
    options,
    multi: options.length > 2 && p.multi,
    at: serverTimestamp(),
  });
}

export const closeClassPoll = (p: ClassPoll) => set(ref(db, `classPolls/${p.cls}/${p.by}/${p.slot}/closed`), serverTimestamp());

/** The teacher only: open again. */
export const reopenClassPoll = (p: ClassPoll) => set(ref(db, `classPolls/${p.cls}/${p.by}/${p.slot}/closed`), null);

/** The poll and its votes, in one write. */
export const deleteClassPoll = (p: ClassPoll) => update(ref(db), {[`classPolls/${p.cls}/${p.by}/${p.slot}`]: null, [`classPollVotes/${p.cls}/${p.by}/${p.slot}`]: null});

/** The student's answer (replacing the one before). */
export function voteClassPoll(p: ClassPoll, picked: number[]) {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Нэвтэрнэ үү'));
  const c = (p.multi ? picked : picked.slice(0, 1)).filter((i) => i >= 0 && i < p.options.length);
  if (!c.length) return Promise.reject(new Error('Сонголтоо хийнэ үү.'));
  return set(ref(db, `classPollVotes/${p.cls}/${p.by}/${p.slot}/${uid}`), {id: p.id, c: Object.fromEntries(c.map((i) => [String(i), true])), at: serverTimestamp()});
}

/** For deleting a student: their polls (and those polls' votes) and their votes on others', in every class. */
export function classPollPathsOf(uid: string, polls: unknown, votes: unknown) {
  const paths: Record<string, null> = {};
  for (const [cls, byUid] of Object.entries((polls ?? {}) as Record<string, Record<string, unknown>>))
    if (byUid?.[uid] !== undefined) paths[`classPolls/${cls}/${uid}`] = null;
  for (const [cls, byUid] of Object.entries((votes ?? {}) as Record<string, Record<string, Record<string, Record<string, unknown>>>>)) {
    // The votes on their own polls go with them (one path: an update may not name a path and one inside it).
    if (byUid?.[uid] !== undefined) paths[`classPollVotes/${cls}/${uid}`] = null;
    for (const [by, slots] of Object.entries(byUid ?? {}))
      if (by !== uid) for (const [slot, voters] of Object.entries(slots ?? {})) if (voters?.[uid] !== undefined) paths[`classPollVotes/${cls}/${by}/${slot}/${uid}`] = null;
  }
  return paths;
}
