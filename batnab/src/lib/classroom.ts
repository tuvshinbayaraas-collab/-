// What the teacher sends a class, and what students ask back:
//   assignments/{id}         {kind: 'topic' | 'test', ref, due, createdAt, classes?}   "do this by then"
//   announcements/{id}       {text, at, classes?}                                     a note on the home page
//   questions/{uid}/{id}     {text, at, ctx: {s, t, q, label}, reply?: {text, at}, seen?}   a student's question
import {push, ref, serverTimestamp, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {entries, useLive} from './live';

export interface Assignment {
  id: string;
  kind: 'topic' | 'test';
  /** The topic id or the test id. */
  ref: string;
  due: number;
  createdAt: number;
  classes?: Record<string, true>;
}

export interface Announcement {
  id: string;
  text: string;
  at: number;
  classes?: Record<string, true>;
}

export interface Question {
  id: string;
  uid: string;
  text: string;
  at: number;
  /** What it is about: a topic problem (s 'p': topic t, problem q) or a test question (s 't': test t, question q). */
  ctx: {s: 'p' | 't'; t: string; q?: string; label: string};
  reply?: {text: string; at: number};
  seen?: boolean;
}

const pick = (classes?: Record<string, true>) => (classes && Object.keys(classes).length ? classes : null);

export const useAssignments = () =>
  useLive('assignments', (v) => entries<Omit<Assignment, 'id'>>(v).filter((a) => (a.kind === 'topic' || a.kind === 'test') && typeof a.due === 'number').sort((a, b) => a.due - b.due));

export const createAssignment = (a: Pick<Assignment, 'kind' | 'ref' | 'due' | 'classes'>) =>
  set(push(ref(db, 'assignments')), {kind: a.kind, ref: a.ref, due: a.due, classes: pick(a.classes), createdAt: serverTimestamp()});

export const deleteAssignment = (id: string) => set(ref(db, `assignments/${id}`), null);

export const useAnnouncements = () =>
  useLive('announcements', (v) => entries<Omit<Announcement, 'id'>>(v).filter((a) => typeof a.text === 'string').sort((a, b) => b.at - a.at));

export const postAnnouncement = (text: string, classes?: Record<string, true>) =>
  set(push(ref(db, 'announcements')), {text: text.trim().slice(0, 600), at: serverTimestamp(), classes: pick(classes)});

export const deleteAnnouncement = (id: string) => set(ref(db, `announcements/${id}`), null);

const parseQuestions = (uid: string, v: unknown) =>
  entries<Omit<Question, 'id' | 'uid'>>(v)
    .filter((q) => typeof q.text === 'string' && q.ctx)
    .map((q) => ({...q, uid}));

/** The student's own questions, newest first. */
export const useMyQuestions = (uid: string | undefined) => useLive(uid ? `questions/${uid}` : null, (v) => parseQuestions(uid!, v).sort((a, b) => b.at - a.at));

/** Every student's questions, for the teacher: unanswered first, then newest. */
export const useAllQuestions = () =>
  useLive('questions', (v) =>
    Object.entries((v ?? {}) as Record<string, unknown>)
      .flatMap(([uid, qs]) => parseQuestions(uid, qs))
      .sort((a, b) => Number(!!a.reply) - Number(!!b.reply) || b.at - a.at),
  );

export function askQuestion(ctx: Question['ctx'], text: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  const label = ctx.label.slice(0, 120);
  return set(push(ref(db, `questions/${uid}`)), {text: text.trim().slice(0, 600), at: serverTimestamp(), ctx: {...ctx, label}});
}

export const replyQuestion = (uid: string, id: string, text: string) => update(ref(db, `questions/${uid}/${id}`), {reply: {text: text.trim().slice(0, 1000), at: serverTimestamp()}, seen: null});
export const markSeen = (uid: string, id: string) => set(ref(db, `questions/${uid}/${id}/seen`), true);
export const deleteQuestion = (uid: string, id: string) => set(ref(db, `questions/${uid}/${id}`), null);
