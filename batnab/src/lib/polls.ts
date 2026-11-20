// Polls ("Санал асуулга"), in the teacher's announcements: a question to the students (about an update, a lesson,
// anything), answered on their home page.
//   polls/{id} = {q, options: [text…] (0–8; none: a written answer only, or ideas), multi?, comment? (a written answer
//                 too), ideas? (the students add ideas and everyone sees the counts), classes? (none: every class),
//                 closed?, at}
//   pollVotes/{id}/{uid} = {c?: {index: true}, t?: written, no?: «Хариулахгүй», at}: each student's own answer
//                 (changed as they like while the poll is open), read by them and the teacher only. In an ideas poll it
//                 holds only the written answer or the «no»: the picks are in pollPicks.
//   pollIdeas/{id}/{uid}{1–3} = {by, text, n, at}: a student's ideas (three at most), shown to the poll's classes (not
//                 who added them; the teacher sees it). `n` is new for each idea, so one deleted and added again in the
//                 same place doesn't keep the old one's picks.
//   pollPicks/{id}/{uid} = {c?: {index: true}, d?: {idea: its n}, at}: an ideas poll's picks, which the poll's classes
//                 read to count (the page shows counts only).
import {push, ref, serverTimestamp, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {useLive} from './live';

export interface Poll {
  id: string;
  q: string;
  options: string[];
  multi: boolean;
  comment: boolean;
  /** The students add ideas, everyone picks from all of them and sees the counts. */
  ideas: boolean;
  classes?: Record<string, true>;
  closed: boolean;
  at: number;
}

export interface Vote {
  /** The options picked (indexes). */
  c: number[];
  t: string;
  /** «Хариулахгүй». */
  no: boolean;
  at: number;
}

export interface Idea {
  iid: string;
  by: string;
  text: string;
  n: string;
  at: number;
}

/** An ideas poll's picks: options (indexes) and ideas (id → its n). */
export interface Picks {
  c: number[];
  d: Record<string, string>;
  at: number;
}

export const MAX_OPTIONS = 8;

/** At most `n` characters (as the rules count them), never cutting an emoji or other two-part character in half. */
export function clip(s: string, n: number) {
  if (s.length <= n) return s;
  const code = s.charCodeAt(n - 1);
  return s.slice(0, code >= 0xd800 && code <= 0xdbff ? n - 1 : n);
}
/** A student's ideas in one poll, at most. */
export const IDEAS_EACH = 3;
/** The ideas poll's leaders, marked. */
export const TOP = 5;

const parsePoll = (id: string, v: Partial<Poll> & {options?: unknown}): Poll | null =>
  typeof v?.q === 'string'
    ? {
        id,
        q: v.q,
        options: (Array.isArray(v.options) ? v.options : Object.values(v.options ?? {})).filter((o): o is string => typeof o === 'string'),
        multi: v.multi === true || v.ideas === true,
        comment: v.comment === true,
        ideas: v.ideas === true,
        classes: v.classes && typeof v.classes === 'object' ? v.classes : undefined,
        closed: v.closed === true,
        at: Number(v.at) || 0,
      }
    : null;

/** The indexes set in {index: true} (the database gives {1: true} back as [null, true]: only the ones set count). */
const indexes = (c: unknown) =>
  Object.entries((c ?? {}) as Record<string, unknown>)
    .filter(([, on]) => on === true)
    .map(([i]) => Number(i))
    .filter((i) => Number.isInteger(i) && i >= 0)
    .sort((a, b) => a - b);

export const parseVote = (v: unknown): Vote | null => {
  const x = v as {c?: unknown; t?: unknown; no?: unknown; at?: unknown} | null;
  if (!x || typeof x !== 'object') return null;
  return {c: indexes(x.c), t: typeof x.t === 'string' ? x.t : '', no: x.no === true, at: Number(x.at) || 0};
};

/** Every poll, newest first. */
export const usePolls = (on = true) =>
  useLive(on ? 'polls' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, Partial<Poll>>)
      .flatMap(([id, p]) => parsePoll(id, p) ?? [])
      .sort((a, b) => b.at - a.at),
  );

/** The student's own answer to a poll: null while loading, false if none. */
export const useMyVote = (id: string, uid: string | undefined) => useLive(uid ? `pollVotes/${id}/${uid}` : null, (v) => parseVote(v) ?? false);

/** Everyone's answers to a poll (the teacher): uid → answer. */
export const useVotes = (id: string | null) =>
  useLive(id ? `pollVotes/${id}` : null, (v) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).flatMap(([uid, x]) => (parseVote(x) ? [[uid, parseVote(x)!]] : []))) as Record<string, Vote>);

/** An ideas poll's ideas, oldest first; null while loading. */
export const useIdeas = (id: string, on = true) =>
  useLive(on ? `pollIdeas/${id}` : null, (v) =>
    Object.entries((v ?? {}) as Record<string, Partial<Idea>>)
      .flatMap(([iid, x]) => (x && typeof x.text === 'string' && typeof x.n === 'string' && typeof x.by === 'string' ? [{iid, by: x.by, text: x.text, n: x.n, at: Number(x.at) || 0}] : []))
      .sort((a, b) => a.at - b.at),
  );

/** An ideas poll's picks: uid → picks; null while loading. */
export const usePicks = (id: string, on = true) =>
  useLive(on ? `pollPicks/${id}` : null, (v) =>
    Object.fromEntries(
      Object.entries((v ?? {}) as Record<string, {c?: unknown; d?: Record<string, unknown>; at?: unknown} | null>).flatMap(([uid, x]) =>
        x && typeof x === 'object' ? [[uid, {c: indexes(x.c), d: Object.fromEntries(Object.entries(x.d ?? {}).filter(([, n]) => typeof n === 'string')) as Record<string, string>, at: Number(x.at) || 0}]] : [],
      ),
    ) as Record<string, Picks>,
  );

/** One line of an ideas poll: a teacher's option or a student's idea. */
export interface Entry {
  key: string;
  text: string;
  /** The option's index, for a teacher's option. */
  i?: number;
  idea?: Idea;
  count: number;
}

/** Whether `p` picks the entry (an idea only by its own mark, so not one deleted and added again). */
export const picks = (p: Picks | undefined, e: Pick<Entry, 'i' | 'idea'>) => !!p && (e.idea ? p.d[e.idea.iid] === e.idea.n : p.c.includes(e.i!));

/** The options and ideas with their counts, most picked first (then the teacher's, then the older). */
export function entries(poll: Poll, ideas: Idea[], all: Record<string, Picks>): Entry[] {
  const list: Entry[] = [...poll.options.map((text, i) => ({key: `o${i}`, text, i, count: 0})), ...ideas.map((idea) => ({key: idea.iid, text: idea.text, idea, count: 0}))];
  for (const e of list) e.count = Object.values(all).filter((p) => picks(p, e)).length;
  return list.map((e, at) => ({e, at})).sort((a, b) => b.e.count - a.e.count || a.at - b.at).map(({e}) => e);
}

/** Who has picked anything in an ideas poll. */
export const pickers = (all: Record<string, Picks>, poll: Poll, ideas: Idea[]) =>
  Object.keys(all).filter((uid) => entries(poll, ideas, {[uid]: all[uid]}).some((e) => e.count));

export function createPoll(p: {q: string; options: string[]; multi: boolean; comment: boolean; ideas?: boolean; classes?: Record<string, true>}) {
  const options = p.options.map((o) => clip(o.trim(), 120)).filter(Boolean).slice(0, MAX_OPTIONS);
  const ideas = !!p.ideas;
  return set(push(ref(db, 'polls')), {
    q: clip(p.q.trim(), 300),
    ...(options.length ? {options} : {}),
    // Ideas: as many picked as one likes.
    multi: ideas || (options.length > 1 && p.multi),
    // With no options (and no ideas), a written answer is the answer.
    comment: (!options.length && !ideas) || p.comment,
    ...(ideas ? {ideas: true} : {}),
    classes: p.classes && Object.keys(p.classes).length ? p.classes : null,
    at: serverTimestamp(),
  });
}

export const closePoll = (id: string, closed: boolean) => set(ref(db, `polls/${id}/closed`), closed || null);

/** The poll and everyone's answers, ideas and picks. */
export const deletePoll = (id: string) => update(ref(db), {[`polls/${id}`]: null, [`pollVotes/${id}`]: null, [`pollIdeas/${id}`]: null, [`pollPicks/${id}`]: null});

const me = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  return uid;
};

/** The student's answer (replacing the one before). */
export async function vote(id: string, picked: number[], text: string) {
  const t = clip(text.trim(), 500);
  return set(ref(db, `pollVotes/${id}/${me()}`), {
    ...(picked.length ? {c: Object.fromEntries(picked.map((i) => [String(i), true]))} : {}),
    ...(t ? {t} : {}),
    at: serverTimestamp(),
  });
}

/** «Хариулахгүй»: the poll leaves their page (the teacher sees who said so); answering later replaces it. */
export const decline = async (id: string) => set(ref(db, `pollVotes/${id}/${me()}`), {no: true, at: serverTimestamp()});

/** Takes the «Хариулахгүй» back (their written answer, if any, isn't touched). */
export const undecline = async (id: string) => set(ref(db, `pollVotes/${id}/${me()}`), null);

/** An ideas poll: the student's picks (replacing the ones before; only ideas still there), and their «no» gone. */
export async function savePicks(poll: Poll, c: number[], d: Record<string, string>, ideas: Idea[], declined: boolean) {
  const uid = me();
  const opts = c.filter((i) => i >= 0 && i < poll.options.length);
  const live = Object.fromEntries(Object.entries(d).filter(([iid, n]) => ideas.some((x) => x.iid === iid && x.n === n)));
  const any = opts.length > 0 || Object.keys(live).length > 0;
  return update(ref(db), {
    [`pollPicks/${poll.id}/${uid}`]: any ? {...(opts.length ? {c: Object.fromEntries(opts.map((i) => [String(i), true]))} : {}), ...(Object.keys(live).length ? {d: live} : {}), at: serverTimestamp()} : null,
    ...(declined && any ? {[`pollVotes/${poll.id}/${uid}`]: null} : {}),
  });
}

/** Adds the student's idea in a free place of their three; false when all three are used. */
export async function addIdea(poll: Poll, text: string, ideas: Idea[]) {
  const uid = me();
  const slot = ['1', '2', '3'].find((s) => !ideas.some((x) => x.iid === uid + s));
  const t = clip(text.trim().replace(/\s+/g, ' '), 80);
  if (!slot || !t) return false;
  await set(ref(db, `pollIdeas/${poll.id}/${uid}${slot}`), {by: uid, text: t, n: push(ref(db, 'pollIdeas')).key!, at: serverTimestamp()});
  return true;
}

/** The idea gone (its author, or the teacher); picks of it no longer count. */
export const deleteIdea = (pollId: string, iid: string) => set(ref(db, `pollIdeas/${pollId}/${iid}`), null);

/** For deleting a student: their answers, ideas and picks in every poll. */
export const pollPathsOf = (uid: string, pollIds: string[]) =>
  Object.fromEntries(pollIds.flatMap((id) => [`pollVotes/${id}/${uid}`, `pollPicks/${id}/${uid}`, ...['1', '2', '3'].map((s) => `pollIdeas/${id}/${uid}${s}`)].map((p) => [p, null])));
