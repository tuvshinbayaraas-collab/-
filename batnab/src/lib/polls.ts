// Polls ("Санал асуулга"), in the teacher's announcements: a question to the students (about an update, a lesson,
// anything), answered on their home page.
//   polls/{id} = {q, options: [text…] (0–8; none: a written answer only), multi?, comment? (a written answer too),
//                 classes? (none: every class), closed?, at}
//   pollVotes/{id}/{uid} = {c?: {index: true}, t?: written, at}: each student's own answer (changed as they like while
//                 the poll is open), read by them and the teacher only.
import {push, ref, serverTimestamp, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {useLive} from './live';

export interface Poll {
  id: string;
  q: string;
  options: string[];
  multi: boolean;
  comment: boolean;
  classes?: Record<string, true>;
  closed: boolean;
  at: number;
}

export interface Vote {
  /** The options picked (indexes). */
  c: number[];
  t: string;
  at: number;
}

export const MAX_OPTIONS = 8;

const parsePoll = (id: string, v: Partial<Poll> & {options?: unknown}): Poll | null =>
  typeof v?.q === 'string'
    ? {
        id,
        q: v.q,
        options: (Array.isArray(v.options) ? v.options : Object.values(v.options ?? {})).filter((o): o is string => typeof o === 'string'),
        multi: v.multi === true,
        comment: v.comment === true,
        classes: v.classes && typeof v.classes === 'object' ? v.classes : undefined,
        closed: v.closed === true,
        at: Number(v.at) || 0,
      }
    : null;

export const parseVote = (v: unknown): Vote | null => {
  const x = v as {c?: Record<string, unknown>; t?: unknown; at?: unknown} | null;
  if (!x || typeof x !== 'object') return null;
  // (The database gives {1: true} back as [null, true]: only the ones set count.)
  return {
    c: Object.entries(x.c ?? {})
      .filter(([, on]) => on === true)
      .map(([i]) => Number(i))
      .filter((i) => Number.isInteger(i))
      .sort((a, b) => a - b),
    t: typeof x.t === 'string' ? x.t : '',
    at: Number(x.at) || 0,
  };
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

export function createPoll(p: {q: string; options: string[]; multi: boolean; comment: boolean; classes?: Record<string, true>}) {
  const options = p.options.map((o) => o.trim().slice(0, 120)).filter(Boolean).slice(0, MAX_OPTIONS);
  return set(push(ref(db, 'polls')), {
    q: p.q.trim().slice(0, 300),
    ...(options.length ? {options} : {}),
    multi: options.length > 1 && p.multi,
    // With no options, a written answer is the answer.
    comment: !options.length || p.comment,
    classes: p.classes && Object.keys(p.classes).length ? p.classes : null,
    at: serverTimestamp(),
  });
}

export const closePoll = (id: string, closed: boolean) => set(ref(db, `polls/${id}/closed`), closed || null);

/** The poll and everyone's answers. */
export const deletePoll = (id: string) => update(ref(db), {[`polls/${id}`]: null, [`pollVotes/${id}`]: null});

/** The student's answer (replacing the one before). */
export function vote(id: string, picked: number[], text: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Нэвтэрнэ үү'));
  const t = text.trim().slice(0, 500);
  return set(ref(db, `pollVotes/${id}/${uid}`), {
    ...(picked.length ? {c: Object.fromEntries(picked.map((i) => [String(i), true]))} : {}),
    ...(t ? {t} : {}),
    at: serverTimestamp(),
  });
}
