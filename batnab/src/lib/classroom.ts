// What the teacher sends a class, and what students ask back:
//   assignments/{id}         {kind: 'topic' | 'test', ref, due, createdAt, classes?}   "do this by then"
//   announcements/{id}       {text, at, classes?}                                     a note on the home page
//   questions/{uid}/{id}     {text, at, ctx: {s, t, q, label}, reply?: {text, at}, seen?, help?: class, peer?}   a
//                            student's question; `help`: shown to the class leader too (lib/lead), `peer`: their answer
//                            the teacher let through
import {get, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {helpPaths} from './lead';
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
  /** Shown to the class leader too (this class), without who asked. */
  help?: string;
  /** The class leader's answer, let through by the teacher. */
  peer?: {text: string; name: string; at: number};
}

const pick = (classes?: Record<string, true>) => (classes && Object.keys(classes).length ? classes : null);

export const useAssignments = () =>
  useLive('assignments', (v) => entries<Omit<Assignment, 'id'>>(v).filter((a) => (a.kind === 'topic' || a.kind === 'test') && typeof a.due === 'number').sort((a, b) => a.due - b.due));

/**
 * Gives an assignment. `open` (a topic's): the classes its topic is open to from now on (null: every class), so the
 * classes it is given to can see the topic; set in the same write. Undefined: the topic stays as it is.
 */
export function createAssignment(a: Pick<Assignment, 'kind' | 'ref' | 'due' | 'classes'>, open?: Record<string, true> | null) {
  const id = push(ref(db, 'assignments')).key!;
  return update(ref(db), {
    [`assignments/${id}`]: {kind: a.kind, ref: a.ref, due: a.due, classes: pick(a.classes), createdAt: serverTimestamp()},
    ...(a.kind === 'topic' && open !== undefined ? {[`topics/${a.ref}/classes`]: pick(open ?? undefined)} : {}),
  });
}

/** Opens a topic to these classes too (null: to every class). */
export const openTopicTo = (tid: string, classes: Record<string, true> | null) => set(ref(db, `topics/${tid}/classes`), pick(classes ?? undefined));

/**
 * The classes an assignment is given to that can't see its topic (the topic is open to other classes only): their
 * names, and the classes the topic should be open to for them to see it (null: every class). None: nothing to do.
 */
export function topicGap(classes: Record<string, true> | undefined, topic: {classes?: Record<string, true>}, all: {id: string; name: string}[]) {
  const open = topic.classes && Object.keys(topic.classes).length ? topic.classes : null;
  if (!open) return null;
  const to = pick(classes);
  const shut = to ? Object.keys(to).filter((id) => !open[id]) : all.map((c) => c.id).filter((id) => !open[id]);
  if (!shut.length) return null;
  return {names: shut.map((id) => all.find((c) => c.id === id)?.name ?? '').filter(Boolean), open: to ? {...open, ...to} : null};
}

/** An assignment gone, with what the class leaders had for it (counts, reminders) and everyone's «done» mark of it. */
export async function deleteAssignment(id: string) {
  const read = async (path: string) => ((await get(ref(db, path)).catch(() => null))?.val() ?? {}) as Record<string, Record<string, unknown>>;
  const [reminders, done] = await Promise.all([read('classReminders'), read('doneBy')]);
  return update(ref(db), {
    [`assignments/${id}`]: null,
    [`doneCount/${id}`]: null,
    ...Object.fromEntries(Object.entries(reminders).flatMap(([cls, byA]) => (byA?.[id] !== undefined ? [[`classReminders/${cls}/${id}`, null]] : []))),
    ...Object.fromEntries(Object.entries(done).flatMap(([uid, byA]) => (byA?.[id] !== undefined ? [[`doneBy/${uid}/${id}`, null]] : []))),
  });
}

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
export const useAllQuestions = (on = true) =>
  useLive(on ? 'questions' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, unknown>)
      .flatMap(([uid, qs]) => parseQuestions(uid, qs))
      .sort((a, b) => Number(!!a.reply) - Number(!!b.reply) || b.at - a.at),
  );

/** Asks the teacher; `help` (the student's class): the class leader may answer too (they see it without who asked). */
export function askQuestion(ctx: Question['ctx'], text: string, help?: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  const label = ctx.label.slice(0, 120);
  const t = text.trim().slice(0, 600);
  const id = push(ref(db, `questions/${uid}`)).key!;
  return update(ref(db), {
    [`questions/${uid}/${id}`]: {text: t, at: serverTimestamp(), ctx: {...ctx, label}, ...(help ? {help} : {})},
    ...(help ? {[`helpQueue/${help}/${id}`]: {text: t, label, at: serverTimestamp()}} : {}),
  });
}

/** The teacher's answer (and the leader's copy, answered now, gone). */
export const replyQuestion = (q: Pick<Question, 'uid' | 'id' | 'help'>, text: string) =>
  update(ref(db), {[`questions/${q.uid}/${q.id}/reply`]: {text: text.trim().slice(0, 1000), at: serverTimestamp()}, [`questions/${q.uid}/${q.id}/seen`]: null, ...helpPaths(q, true)});
/** One answer to several questions (students asking about the same problem), in one write. */
export const replyQuestions = (qs: Pick<Question, 'uid' | 'id' | 'help'>[], text: string) =>
  update(
    ref(db),
    Object.fromEntries(qs.flatMap((q) => [[`questions/${q.uid}/${q.id}/reply`, {text: text.trim().slice(0, 1000), at: serverTimestamp()}], [`questions/${q.uid}/${q.id}/seen`, null], ...Object.entries(helpPaths(q, true))])),
  );
/** Several questions deleted in one write. */
export const deleteQuestions = (qs: Pick<Question, 'uid' | 'id' | 'help'>[]) => update(ref(db), Object.fromEntries(qs.flatMap((q) => [[`questions/${q.uid}/${q.id}`, null], ...Object.entries(helpPaths(q, true))])));
export const markSeen = (uid: string, id: string) => set(ref(db, `questions/${uid}/${id}/seen`), true);
/** A question gone (by its asker, or the teacher: `teacher`), with the class leader's copy. */
export const deleteQuestion = (q: Pick<Question, 'uid' | 'id' | 'help'>, teacher = false) => update(ref(db), {[`questions/${q.uid}/${q.id}`]: null, ...helpPaths(q, teacher)});
