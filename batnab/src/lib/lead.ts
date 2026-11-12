// «Ангийн дарга»: the students the teacher marks (users/{uid}/lead) help run their class, each power the teacher's to
// switch off (settings/leadRemind, leadNotes, leadReports, leadHelp). They never see a classmate's name, answer or score:
//   doneBy/{uid}/{assignment} = class          a student's own «done», with the class it was counted in (by their own
//                                              page; taken back if it is no longer done, e.g. the teacher cleared it)
//   doneCount/{assignment}/{class} = n         how many of the class are done: one more or one less with each «done»
//                                              above, in the same write (the rules hold it): a count, never who
//   classes/{id}/n                             how many students the class has (kept by the teacher's page)
//   classReminders/{class}/{assignment} = {by, at}   the leader's «Сануулга»: the bell of each classmate not done yet
//                                              (their own page knows it) says so; once in 3 hours
//   classNotes/{class}/{uid}{1–3} = {by, name, text, at}   the leader's notes on the class's home page (three at most)
//   reports/{uid}/{id} = {kind, ref, q, label, text, at, done?}   a mistake in a test or topic problem, to the teacher
//   helpQueue/{class}/{question} = {text, label, at, ctx}   a classmate's question to the teacher, shown to the leader
//                                              too if they let it (without who asked); made with the question, gone
//                                              with it
//   helpAnswers/{class}/{question} = {by, name, text, at}   the leader's answer, waiting for the teacher: let through,
//                                              it goes to the asker as questions/{uid}/{id}/peer
import {get, increment, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {useLive} from './live';
import type {Question} from './classroom';
import {clip} from './polls';

const me = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  return uid;
};

// ---- assignments done, counted

/** The student's own «done» marks: assignment id → the class it was counted in. */
export const useMyDone = (uid: string | undefined) =>
  useLive(uid ? `doneBy/${uid}` : null, (v) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).filter(([, c]) => typeof c === 'string')) as Record<string, string>);

/** How many of the class are done with an assignment (the class leader); null while loading. */
export const useDoneCount = (aid: string, cls: string | undefined) => useLive(cls ? `doneCount/${aid}/${cls}` : null, (v) => (typeof v === 'number' ? v : 0));

// Tried once a visit for each assignment (done or not), so a refusal can't make it try again and again.
const tried = new Set<string>();
/**
 * Marks the student done with an assignment and counts them in, once (their «done» and the count go in one write; if
 * another classmate's came in between, read again and retry).
 */
export async function markDone(aid: string, cls: string) {
  return count(aid, cls, 1);
}

/** Takes the «done» back (no longer done: the teacher cleared the answers, the week's results went), the count with it. */
export function unmarkDone(aid: string, cls: string) {
  return count(aid, cls, -1);
}

async function count(aid: string, cls: string, by: 1 | -1) {
  const uid = me();
  const key = `${uid}/${aid}/${by}`;
  if (tried.has(key)) return;
  tried.add(key);
  tried.delete(`${uid}/${aid}/${-by}`);
  for (let i = 0; i < 6; i++) {
    const n = (await get(ref(db, `doneCount/${aid}/${cls}`))).val();
    const now = typeof n === 'number' ? n : 0;
    if (by < 0 && now < 1) return;
    try {
      await update(ref(db), {[`doneBy/${uid}/${aid}`]: by > 0 ? cls : null, [`doneCount/${aid}/${cls}`]: now + by});
      return;
    } catch {
      // Someone else was counted at the same moment (read again), or it is as wanted already (stop).
      const mark = (await get(ref(db, `doneBy/${uid}/${aid}`)).catch(() => null))?.val();
      if (by > 0 ? typeof mark === 'string' : mark == null) return;
    }
  }
}

// ---- reminders

export interface Reminder {
  by: string;
  at: number;
}
/** Once in this long per assignment. */
export const REMIND_GAP = 3 * 3_600_000;

/** The class's reminders: assignment id → the last one. */
export const useReminders = (cls: string | undefined, on = true) =>
  useLive(on && cls ? `classReminders/${cls}` : null, (v) =>
    Object.fromEntries(Object.entries((v ?? {}) as Record<string, Partial<Reminder>>).flatMap(([aid, r]) => (r && typeof r.at === 'number' && typeof r.by === 'string' ? [[aid, {by: r.by, at: r.at}]] : []))) as Record<string, Reminder>,
  );

export const remind = (cls: string, aid: string) => set(ref(db, `classReminders/${cls}/${aid}`), {by: me(), at: serverTimestamp()});

// ---- the leader's notes

export interface ClassNote {
  nid: string;
  by: string;
  name: string;
  text: string;
  at: number;
}
export const NOTES_EACH = 3;
/** Older than this, a note leaves the home page. */
export const NOTE_DAYS = 7;

const parseNotes = (v: unknown) =>
  Object.entries((v ?? {}) as Record<string, Partial<ClassNote>>)
    .flatMap(([nid, n]) => (n && typeof n.text === 'string' && typeof n.by === 'string' ? [{nid, by: n.by, name: typeof n.name === 'string' ? n.name : '', text: n.text, at: Number(n.at) || 0}] : []))
    .sort((a, b) => b.at - a.at);

export const useClassNotes = (cls: string | undefined, on = true) => useLive(on && cls ? `classNotes/${cls}` : null, parseNotes);

/** Every class's notes (the teacher): class → notes. */
export const useAllClassNotes = (on = true) =>
  useLive(on ? 'classNotes' : null, (v) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).map(([cls, x]) => [cls, parseNotes(x)])) as Record<string, ClassNote[]>);

/** Puts a note up in a free place of the leader's three; false when all three are used. */
export async function postClassNote(cls: string, name: string, text: string, notes: ClassNote[]) {
  const uid = me();
  const slot = ['1', '2', '3'].find((s) => !notes.some((n) => n.nid === uid + s));
  const t = clip(text.trim(), 300);
  if (!slot || !t) return false;
  await set(ref(db, `classNotes/${cls}/${uid}${slot}`), {by: uid, name, text: t, at: serverTimestamp()});
  return true;
}

export const deleteClassNote = (cls: string, nid: string) => set(ref(db, `classNotes/${cls}/${nid}`), null);

// ---- reports of a mistake in a problem

export interface Report {
  uid: string;
  rid: string;
  kind: 'test' | 'topic';
  ref: string;
  q: string;
  label: string;
  text: string;
  at: number;
  /** When the teacher marked it set right. */
  done: number;
}

const parseReports = (uid: string, v: unknown): Report[] =>
  Object.entries((v ?? {}) as Record<string, Partial<Report>>).flatMap(([rid, r]) =>
    r && (r.kind === 'test' || r.kind === 'topic') && typeof r.text === 'string'
      ? [{uid, rid, kind: r.kind, ref: String(r.ref ?? ''), q: String(r.q ?? ''), label: String(r.label ?? ''), text: r.text, at: Number(r.at) || 0, done: Number(r.done) || 0}]
      : [],
  );

export const useMyReports = (uid: string | undefined) => useLive(uid ? `reports/${uid}` : null, (v) => parseReports(uid!, v).sort((a, b) => b.at - a.at));

/** Every report (the teacher): not set right yet first, newest first. */
export const useAllReports = (on = true) =>
  useLive(on ? 'reports' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, unknown>)
      .flatMap(([uid, x]) => parseReports(uid, x))
      .sort((a, b) => Number(!!a.done) - Number(!!b.done) || b.at - a.at),
  );

export function sendReport(r: Pick<Report, 'kind' | 'ref' | 'q' | 'label' | 'text'>) {
  const uid = me();
  return set(push(ref(db, `reports/${uid}`)), {kind: r.kind, ref: r.ref, q: r.q, label: clip(r.label, 120), text: clip(r.text.trim(), 500), at: serverTimestamp()});
}

export const withdrawReport = (rid: string) => set(ref(db, `reports/${me()}/${rid}`), null);
export const markReport = (r: Report, done: boolean) => set(ref(db, `reports/${r.uid}/${r.rid}/done`), done ? serverTimestamp() : null);
export const deleteReport = (r: Report) => set(ref(db, `reports/${r.uid}/${r.rid}`), null);

// ---- helping classmates with their questions

export interface HelpItem {
  qid: string;
  text: string;
  label: string;
  at: number;
  /** The problem it is about (as the question's), to show it in full; not on copies made before it was kept. */
  ctx?: {s: 'p' | 't'; t: string; q?: string};
}

const parseCtx = (c: unknown): HelpItem['ctx'] => {
  const x = c as {s?: unknown; t?: unknown; q?: unknown} | null;
  return x && (x.s === 'p' || x.s === 't') && typeof x.t === 'string' ? {s: x.s, t: x.t, ...(typeof x.q === 'string' ? {q: x.q} : {})} : undefined;
};
export interface HelpAnswer {
  qid: string;
  by: string;
  name: string;
  text: string;
  at: number;
}

export const useHelpQueue = (cls: string | undefined, on = true) =>
  useLive(on && cls ? `helpQueue/${cls}` : null, (v) =>
    Object.entries((v ?? {}) as Record<string, Partial<HelpItem>>)
      .flatMap(([qid, x]) => (x && typeof x.text === 'string' ? [{qid, text: x.text, label: String(x.label ?? ''), at: Number(x.at) || 0, ctx: parseCtx(x.ctx)}] : []))
      .sort((a, b) => b.at - a.at),
  );

const parseAnswers = (v: unknown) =>
  Object.fromEntries(
    Object.entries((v ?? {}) as Record<string, Partial<HelpAnswer>>).flatMap(([qid, x]) =>
      x && typeof x.text === 'string' && typeof x.by === 'string' ? [[qid, {qid, by: x.by, name: String(x.name ?? ''), text: x.text, at: Number(x.at) || 0}]] : [],
    ),
  ) as Record<string, HelpAnswer>;

export const useHelpAnswers = (cls: string | undefined, on = true) => useLive(on && cls ? `helpAnswers/${cls}` : null, parseAnswers);

/** Every class's answers waiting (the teacher): class → question id → answer. */
export const useAllHelpAnswers = (on = true) =>
  useLive(on ? 'helpAnswers' : null, (v) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).map(([cls, x]) => [cls, parseAnswers(x)])) as Record<string, Record<string, HelpAnswer>>);

export const answerHelp = (cls: string, qid: string, name: string, text: string) => set(ref(db, `helpAnswers/${cls}/${qid}`), {by: me(), name, text: clip(text.trim(), 1000), at: serverTimestamp()});
export const withdrawHelp = (cls: string, qid: string) => set(ref(db, `helpAnswers/${cls}/${qid}`), null);

/** The teacher lets the leader's answer through: the asker gets it (as the leader's, the teacher's «yes» on it). */
export const approveHelp = (q: Question, a: HelpAnswer) =>
  update(ref(db), {
    [`questions/${q.uid}/${q.id}/peer`]: {text: a.text, name: a.name, at: serverTimestamp()},
    [`questions/${q.uid}/${q.id}/seen`]: null,
    [`helpAnswers/${q.help}/${q.id}`]: null,
    [`helpQueue/${q.help}/${q.id}`]: null,
  });

export const rejectHelp = (cls: string, qid: string) => set(ref(db, `helpAnswers/${cls}/${qid}`), null);

/**
 * For the teacher taking a student out of their class (moved to another, or deleted): their «done» marks go, each out of
 * its class's count too (one less, on the server, so a classmate counted at the same moment isn't lost). In a new
 * class their own page marks them again.
 */
export async function outOfCounts(uid: string) {
  const read = async (path: string) => (await get(ref(db, path)).catch(() => null))?.val() ?? null;
  const marks = ((await read(`doneBy/${uid}`)) ?? {}) as Record<string, unknown>;
  const paths: Record<string, unknown> = {[`doneBy/${uid}`]: null};
  await Promise.all(
    Object.entries(marks).map(async ([aid, cls]) => {
      if (typeof cls !== 'string') return;
      const n = await read(`doneCount/${aid}/${cls}`);
      if (typeof n === 'number' && n > 0) paths[`doneCount/${aid}/${cls}`] = increment(-1);
    }),
  );
  return paths;
}

/** For deleting a student (their «done» marks: outOfCounts): their reports, notes (as a leader), answers (as a leader), and the copies of
 * their questions shown to a leader. */
export function leadPathsOf(uid: string, notes: unknown, answers: unknown, questions: unknown) {
  const paths: Record<string, null> = {[`reports/${uid}`]: null};
  for (const [cls, byN] of Object.entries((notes ?? {}) as Record<string, Record<string, {by?: string}>>))
    for (const [nid, n] of Object.entries(byN ?? {})) if (n?.by === uid) paths[`classNotes/${cls}/${nid}`] = null;
  for (const [cls, byQ] of Object.entries((answers ?? {}) as Record<string, Record<string, {by?: string}>>))
    for (const [qid, a] of Object.entries(byQ ?? {})) if (a?.by === uid) paths[`helpAnswers/${cls}/${qid}`] = null;
  for (const [qid, q] of Object.entries((questions ?? {}) as Record<string, {help?: unknown}>))
    if (typeof q?.help === 'string') Object.assign(paths, helpPaths({id: qid, help: q.help}, true));
  return paths;
}

/**
 * A question's copy for the leader (when it was shown to them), to go with it: the asker takes the copy away; the
 * teacher (answering or deleting it) the leader's answer waiting on it too.
 */
export const helpPaths = (q: {id: string; help?: string}, teacher = false): Record<string, null> =>
  q.help ? {[`helpQueue/${q.help}/${q.id}`]: null, ...(teacher ? {[`helpAnswers/${q.help}/${q.id}`]: null} : {})} : {};
