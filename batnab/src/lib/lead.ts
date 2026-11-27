// «Ангийн дарга»: the students the teacher marks (users/{uid}/lead) help run their class, each power the teacher's to
// switch off (settings/leadRemind, leadNotes, leadReports, leadHelp):
//   classWork/{class}/{assignment}/{uid} = 'started' | 'done'   how far each classmate is (their own page keeps it: a
//                                              topic with a problem answered is started, every one answered done; a
//                                              test handed in done; taken back if it no longer is)
//   classRoster/{class}/{uid} = name           the class's students (kept by the teacher's page): with the above, the
//                                              leader sees who hasn't started yet
//   classReminders/{class}/{assignment} = {by, at}   the leader's «Сануулга» to the class: the bell of each classmate
//                                              not done yet (their own page knows it) says so; once in 3 hours
//   classNudges/{class}/{uid}/{assignment} = {by, name, at}   the leader's reminder to one classmate who hasn't started:
//                                              in their bell; once in 3 hours each
//   classNotes/{class}/{uid}{1–3} = {by, name, text, at}   the leader's notes on the class's home page (three at most)
//   reports/{uid}/{id} = {kind, ref, q, label, text, at, done?}   a mistake in a test or topic problem, to the teacher
//   helpQueue/{class}/{question} = {uid, name, text, label, at, ctx, ans?}   a classmate's question to the teacher,
//                                              shown to the class's leaders too if they let it (with who asked); made
//                                              with the question, gone with it. ans = {by, name, text, at}: a leader's
//                                              explanation, which goes straight to the asker too, as
//                                              questions/{uid}/{id}/peer
import {get, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {useLive} from './live';
import {clip} from './polls';

const me = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  return uid;
};

// ---- how far each classmate is with an assignment

export type Work = 'started' | 'done';
const parseWork = (v: unknown) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).filter(([, w]) => w === 'started' || w === 'done')) as Record<string, Work>;

/** How far the class is with an assignment (the leader): uid → started or done; null while loading. */
export const useClassWork = (cls: string | undefined, aid: string, on = true) => useLive(on && cls ? `classWork/${cls}/${aid}` : null, parseWork);

/** The student's own mark for an assignment: '' none yet; null while loading. */
export const useMyWork = (cls: string | undefined, aid: string, uid: string | undefined) =>
  useLive(cls && uid ? `classWork/${cls}/${aid}/${uid}` : null, (v) => (v === 'started' || v === 'done' ? v : '') as Work | '');

// Tried once a visit for each change, so a refusal can't make it try again and again.
const tried = new Set<string>();
/** Puts down how far the student is (null: not started, e.g. their answers were cleared). */
export function setMyWork(cls: string, aid: string, w: Work | null) {
  const uid = me();
  const key = `${cls}/${aid}/${uid}/${w}`;
  if (tried.has(key)) return Promise.resolve();
  tried.add(key);
  return set(ref(db, `classWork/${cls}/${aid}/${uid}`), w);
}

/** The class's students, uid → name (the leader; kept by the teacher's page); null while loading. */
export const useRoster = (cls: string | undefined, on = true) =>
  useLive(on && cls ? `classRoster/${cls}` : null, (v) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).filter(([, n]) => typeof n === 'string')) as Record<string, string>);

/**
 * For the teacher taking a student out of a class (moved to another, or deleted): how far they were with its
 * assignments, the reminders to them and their place on its list go (in a new class their own page marks them again).
 */
export async function outOfClass(uid: string, cls: string | null | undefined): Promise<Record<string, null>> {
  if (!cls) return {};
  const work = ((await get(ref(db, `classWork/${cls}`)).catch(() => null))?.val() ?? {}) as Record<string, Record<string, unknown>>;
  return {
    ...Object.fromEntries(Object.entries(work).flatMap(([aid, byU]) => (byU?.[uid] !== undefined ? [[`classWork/${cls}/${aid}/${uid}`, null]] : []))),
    [`classNudges/${cls}/${uid}`]: null,
    [`classRoster/${cls}/${uid}`]: null,
  };
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

export interface Nudge {
  by: string;
  name: string;
  at: number;
}
const parseNudges = (v: unknown) =>
  Object.fromEntries(
    Object.entries((v ?? {}) as Record<string, Partial<Nudge>>).flatMap(([aid, n]) => (n && typeof n.at === 'number' && typeof n.by === 'string' ? [[aid, {by: n.by, name: String(n.name ?? ''), at: n.at}]] : [])),
  ) as Record<string, Nudge>;

/** The leader's reminders to one classmate each (the leader): uid → assignment id → the last one. */
export const useClassNudges = (cls: string | undefined, on = true) =>
  useLive(on && cls ? `classNudges/${cls}` : null, (v) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).map(([uid, x]) => [uid, parseNudges(x)])) as Record<string, Record<string, Nudge>>);

/** The reminders the leader sent this student: assignment id → the last one. */
export const useMyNudges = (cls: string | undefined, uid: string | undefined, on = true) => useLive(on && cls && uid ? `classNudges/${cls}/${uid}` : null, parseNudges);

/** A reminder to one classmate who hasn't started an assignment (in their bell, with the leader's name). */
export const nudge = (cls: string, uid: string, aid: string, name: string) => set(ref(db, `classNudges/${cls}/${uid}/${aid}`), {by: me(), name, at: serverTimestamp()});

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

export interface HelpAnswer {
  by: string;
  name: string;
  text: string;
  at: number;
}
export interface HelpItem {
  qid: string;
  /** Who asked (not on copies made before it was kept: those can't be answered). */
  uid?: string;
  name: string;
  text: string;
  label: string;
  at: number;
  /** The problem it is about (as the question's), to show it in full; not on copies made before it was kept. */
  ctx?: {s: 'p' | 't'; t: string; q?: string};
  /** A leader's explanation (it is on the asker's question too). */
  ans?: HelpAnswer;
}

const parseCtx = (c: unknown): HelpItem['ctx'] => {
  const x = c as {s?: unknown; t?: unknown; q?: unknown} | null;
  return x && (x.s === 'p' || x.s === 't') && typeof x.t === 'string' ? {s: x.s, t: x.t, ...(typeof x.q === 'string' ? {q: x.q} : {})} : undefined;
};
const parseAnswer = (a: unknown): HelpAnswer | undefined => {
  const x = a as Partial<HelpAnswer> | null;
  return x && typeof x.text === 'string' && typeof x.by === 'string' ? {by: x.by, name: String(x.name ?? ''), text: x.text, at: Number(x.at) || 0} : undefined;
};

/** The class's questions the leaders may explain: not explained yet first, then newest. */
export const useHelpQueue = (cls: string | undefined, on = true) =>
  useLive(on && cls ? `helpQueue/${cls}` : null, (v) =>
    Object.entries((v ?? {}) as Record<string, Record<string, unknown>>)
      .flatMap(([qid, x]) =>
        x && typeof x.text === 'string'
          ? [
              {
                qid,
                uid: typeof x.uid === 'string' ? x.uid : undefined,
                name: typeof x.name === 'string' ? x.name : '',
                text: x.text,
                label: String(x.label ?? ''),
                at: Number(x.at) || 0,
                ctx: parseCtx(x.ctx),
                ans: parseAnswer(x.ans),
              } as HelpItem,
            ]
          : [],
      )
      .sort((a, b) => Number(!!a.ans) - Number(!!b.ans) || b.at - a.at),
  );

/** A question waits for a leader's explanation this long (an older one has had its answer, or no longer needs it). */
export const HELP_DAYS = 7;

/** The classmates' questions waiting for an explanation (not one's own, not explained, not older than HELP_DAYS). */
export const waitingHelp = (queue: HelpItem[] | null | undefined, uid: string, now: number) =>
  (queue ?? []).filter((h) => !h.ans && h.uid !== uid && h.at > now - HELP_DAYS * 86_400_000);

/** A leader's explanation: straight to the asker (on their question, as new) and on the copy, for the other leaders. */
export function answerHelp(cls: string, item: HelpItem, name: string, text: string) {
  const a = {by: me(), name, text: clip(text.trim(), 1000), at: serverTimestamp()};
  return update(ref(db), {[`helpQueue/${cls}/${item.qid}/ans`]: a, [`questions/${item.uid}/${item.qid}/peer`]: a, [`questions/${item.uid}/${item.qid}/seen`]: null});
}

/** The leader takes their explanation back (from the asker's question too). */
export const withdrawHelp = (cls: string, item: HelpItem) => update(ref(db), {[`helpQueue/${cls}/${item.qid}/ans`]: null, [`questions/${item.uid}/${item.qid}/peer`]: null});

/**
 * For deleting a student: their reports and notes (as a leader); their explanations (as a leader: on the copies and on
 * the askers' questions); the copies of their own questions.
 */
export function leadPathsOf(uid: string, notes: unknown, queue: unknown, questions: unknown) {
  const paths: Record<string, null> = {[`reports/${uid}`]: null};
  for (const [cls, byN] of Object.entries((notes ?? {}) as Record<string, Record<string, {by?: string}>>))
    for (const [nid, n] of Object.entries(byN ?? {})) if (n?.by === uid) paths[`classNotes/${cls}/${nid}`] = null;
  for (const [cls, byQ] of Object.entries((queue ?? {}) as Record<string, Record<string, {uid?: string; ans?: {by?: string}}>>))
    for (const [qid, h] of Object.entries(byQ ?? {}))
      if (h?.ans?.by === uid) {
        paths[`helpQueue/${cls}/${qid}/ans`] = null;
        if (typeof h.uid === 'string' && h.uid !== uid) paths[`questions/${h.uid}/${qid}/peer`] = null;
      }
  for (const [qid, q] of Object.entries((questions ?? {}) as Record<string, {help?: unknown}>)) if (typeof q?.help === 'string') Object.assign(paths, helpPaths({id: qid, help: q.help}));
  return paths;
}

/** A question's copy for the leaders (when it was shown to them), to go when the question goes. */
export const helpPaths = (q: {id: string; help?: string}): Record<string, null> => (q.help ? {[`helpQueue/${q.help}/${q.id}`]: null} : {});
