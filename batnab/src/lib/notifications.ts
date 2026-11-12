// Notifications ("Мэдэгдэл"): made from what is already there, nothing extra is stored for them. A student gets a new
// assignment, one due within a day, the teacher's notes, an exam scheduled or starting, the teacher's check of an
// answer, a reply to a question, a medal, a live quiz starting; the teacher gets new questions and answers waiting to
// be checked. What came after the last look at the list (kept on this device) counts as new. A student may clear the
// list (users/{uid}/prefs/notesCleared: everything up to then) or take one note off it (prefs/notesHidden/{id}: the
// note's time — it comes back only if it changes, as a newer check of the same answer); both follow the account.
import {ref, serverTimestamp, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {assignmentFor, assignmentState, assignmentTitle} from '../components/Today';
import {testInfo} from '../tests';
import {useAllQuestions, useAnnouncements, useAssignments, useMyQuestions} from './classroom';
import {useExams} from './exams';
import {medalName, useMedals} from './leaderboard';
import {WEEK} from './week';
import {liveOn, useLiveQuiz} from './liveQuiz';
import {NOTE_DAYS, useAllHelpAnswers, useAllReports, useClassNotes, useHelpQueue, useReminders} from './lead';
import {usePolls} from './polls';
import {forClass, useLive} from './live';
import {useMyResults} from './results';
import {auth, db} from './firebase';
import {navigate} from './router';
import {useSession} from './session';
import {clock, dayLabel, serverNow, useNow} from './time';
import {problemNo, useAllMarks, useAllProgress, useAllTopicKeys, useMarks, useProgress, useTopics, verdict} from './topics';

export type NoteKind = 'task' | 'due' | 'news' | 'exam' | 'mark' | 'reply' | 'medal' | 'live' | 'question' | 'check';

export interface Note {
  id: string;
  kind: NoteKind;
  at: number;
  text: string;
  href: string;
  /** Right or wrong, for a teacher's check. */
  ok?: boolean;
}

const DAY = 86_400_000;
/** Older than this, a note isn't listed any more. */
const KEEP = 30 * DAY;
const PLACES = ['', '🥇', '🥈', '🥉'];

const seenKey = (uid: string) => `batnab.notes.seen.${uid}`;
function readSeen(uid: string) {
  try {
    const v = Number(localStorage.getItem(seenKey(uid)));
    if (v) return v;
    // First time on this device: only the last few days' are new.
    const start = Date.now() - 3 * DAY;
    localStorage.setItem(seenKey(uid), String(start));
    return start;
  } catch {
    return Date.now() - 3 * DAY;
  }
}

/** When the list was last looked at, and marking everything up to now seen. */
export function useSeen(uid: string | undefined) {
  const [seen, setSeen] = useState(() => (uid ? readSeen(uid) : 0));
  useEffect(() => setSeen(uid ? readSeen(uid) : 0), [uid]);
  const markAll = () => {
    if (!uid) return;
    // The server's time, as the notes have (a phone's clock running fast would hide the next ones).
    const now = serverNow();
    try {
      localStorage.setItem(seenKey(uid), String(now));
    } catch {
      // private window: only for this visit
    }
    setSeen(now);
  };
  return [seen, markAll] as const;
}

/** The signed-in student's notes, newest first (null while loading). */
function useStudentNotes(uid: string | undefined, classId: string | undefined, on: boolean, lead = false): Note[] | null {
  const now = useNow(60_000);
  // The class leader's reminders and notes; for the leader, classmates' questions they may answer.
  const reminders = useReminders(classId, on);
  const classNotes = useClassNotes(classId, on);
  const helpQueue = useHelpQueue(classId, on && lead);
  const assignments = useAssignments();
  const announcements = useAnnouncements();
  const polls = usePolls(on);
  const exams = useExams();
  const topics = useTopics();
  const progress = useProgress(on ? uid : undefined);
  const marks = useMarks(on ? uid : undefined);
  const results = useMyResults();
  const questions = useMyQuestions(on ? uid : undefined);
  const medals = useMedals(on ? uid : undefined, on);
  const live = useLiveQuiz(on);
  if (!on || !uid) return [];
  if (!assignments || !announcements || !exams || !results || !topics || !progress || !marks || !questions) return null;
  const notes: Note[] = [];
  // Not one whose topic is gone or closed to them (it can't be opened; its title would read «Устгагдсан сэдэв»).
  for (const a of assignments.filter((x) => assignmentFor(x, topics, classId))) {
    const title = assignmentTitle(a, topics);
    const href = a.kind === 'topic' ? `/topics/${a.ref}` : `/test/${a.ref}`;
    const due = `${dayLabel(a.due)} ${clock(a.due)} хүртэл`;
    notes.push({id: `a:${a.id}`, kind: 'task', at: a.createdAt, text: `Шинэ даалгавар: ${title} · ${due}`, href});
    const state = assignmentState(a, topics, progress, results ?? []);
    if (!state.done && now >= a.due - DAY && now < a.due) notes.push({id: `d:${a.id}`, kind: 'due', at: a.due - DAY, text: `Маргаашаас өмнө дуусгах: ${title} · ${due}`, href});
  }
  for (const n of announcements.filter((x) => forClass(x.classes, classId))) notes.push({id: `n:${n.id}`, kind: 'news', at: n.at, text: `Багшийн мэдээ: ${n.text}`, href: '/'});
  // The leader's «Сануулга»: only to those not done yet (their own page knows it), while it is still to do.
  for (const a of assignments.filter((x) => assignmentFor(x, topics, classId))) {
    const r = reminders?.[a.id];
    if (!r || r.by === uid || now > a.due || assignmentState(a, topics, progress, results ?? []).done) continue;
    notes.push({id: `cr:${a.id}:${r.at}`, kind: 'due', at: r.at, text: `Ангийн дарга сануулж байна: ${assignmentTitle(a, topics)} · ${dayLabel(a.due)} ${clock(a.due)} хүртэл`, href: a.kind === 'topic' ? `/topics/${a.ref}` : `/test/${a.ref}`});
  }
  for (const n of classNotes ?? []) if (n.by !== uid && n.at > now - NOTE_DAYS * DAY) notes.push({id: `cn:${n.nid}:${n.at}`, kind: 'news', at: n.at, text: `Ангийн дарга ${n.name}: ${n.text}`, href: '/'});
  for (const h of helpQueue ?? []) notes.push({id: `hq:${h.qid}`, kind: 'question', at: h.at, text: `Ангийн сурагч асуулт асуулаа: ${h.label}`, href: '/lead'});
  for (const p of (polls ?? []).filter((x) => !x.closed && forClass(x.classes, classId))) notes.push({id: `p:${p.id}`, kind: 'news', at: p.at, text: `Санал асуулга: ${p.q}`, href: '/'});
  for (const [test, e] of Object.entries(exams ?? {})) {
    const title = testInfo(test)?.title ?? test;
    if (now <= e.end)
      notes.push({id: `e:${test}:${e.start}`, kind: 'exam', at: e.createdAt || e.start - DAY, text: `Шалгалт товлогдлоо: ${title} · ${dayLabel(e.start)} ${clock(e.start)}`, href: `/test/${test}`});
    if (now >= e.start && now <= e.end) notes.push({id: `s:${test}:${e.start}`, kind: 'exam', at: e.start, text: `Шалгалт эхэллээ: ${title}`, href: `/test/${test}`});
  }
  for (const [tid, byPid] of Object.entries(marks)) {
    const t = topics.find((x) => x.id === tid);
    if (!t) continue;
    for (const [pid, m] of Object.entries(byPid ?? {})) {
      const i = t.problems.findIndex((p) => p.id === pid);
      if (i < 0 || typeof m?.at !== 'number') continue;
      notes.push({
        id: `m:${tid}/${pid}`,
        kind: 'mark',
        at: m.at,
        ok: m.ok,
        text: `Багш шалгалаа: ${t.title} · ${problemNo(t.problems[i], i)}-р бодлого — ${m.ok ? 'зөв' : 'буруу'}${m.note ? `: «${m.note}»` : ''}`,
        href: `/topics/${tid}`,
      });
    }
  }
  for (const q of questions) if (q.reply) notes.push({id: `r:${q.id}`, kind: 'reply', at: q.reply.at, text: `Багш асуултад тань хариуллаа: ${q.ctx.label}`, href: '/questions'});
  for (const q of questions) if (q.peer) notes.push({id: `pa:${q.id}`, kind: 'reply', at: q.peer.at, text: `Ангийн дарга асуултад тань тайлбар бичлээ (багш зөвшөөрсөн): ${q.ctx.label}`, href: '/questions'});
  for (const m of medals ?? [])
    notes.push({
      id: `md:${m.key}`,
      kind: 'medal',
      at: m.week + WEEK,
      text: m.top
        ? `${PLACES[m.place]} ${medalName(m)} — «Шилдэг оноогоор» ${m.place}-р байр (${m.score} оноо, ${m.tests ?? 1} тест)`
        : `${PLACES[m.place]} ${m.round ? `${medalName(m)} —` : ''} ${m.place}-р байр: ${testInfo(m.test)?.title ?? m.test} (${m.score}/${m.total})`.replace(/\s+/g, ' '),
      href: '/profile',
    });
  if (liveOn(live, now) && forClass(live.classes, classId))
    notes.push({id: `l:${live.startedAt}`, kind: 'live', at: live.startedAt, text: `Шууд тэмцээн эхэллээ: ${live.title}. Нэгдээрэй!`, href: '/live'});
  return notes.filter((n) => n.at > now - KEEP && n.at <= now + 60_000).sort((a, b) => b.at - a.at);
}

/** The teacher's: questions not answered yet, and each topic's answers waiting to be checked. */
function useTeacherNotes(on: boolean): Note[] | null {
  const questions = useAllQuestions(on);
  const topics = useTopics();
  const progress = useAllProgress(on);
  const marks = useAllMarks(on);
  const keys = useAllTopicKeys(on);
  const users = useLive(on ? 'users' : null, (v) => (v ?? {}) as Record<string, {name?: string; disabled?: boolean}>);
  const help = useAllHelpAnswers(on);
  const reports = useAllReports(on);
  if (!on) return [];
  if (!questions || !topics || !progress || !marks || !keys || !users) return null;
  const notes: Note[] = [];
  // Not a deleted student's (their question can't be answered from the dashboard any more).
  for (const q of questions)
    if (!q.reply && users[q.uid] && !users[q.uid].disabled)
      notes.push({id: `q:${q.uid}/${q.id}`, kind: 'question', at: q.at, text: `Шинэ асуулт: ${users[q.uid]?.name ?? 'Сурагч'} — ${q.ctx.label}`, href: '/admin?tab=questions'});
  for (const t of topics) {
    let n = 0;
    let last = 0;
    for (const [uid, mine] of Object.entries(progress)) {
      if (!users[uid] || users[uid].disabled) continue;
      for (const p of t.problems) {
        const a = mine?.[t.id]?.[p.id];
        if (a && verdict(a.a, keys[t.id]?.[p.id], marks[uid]?.[t.id]?.[p.id]) === null) {
          n++;
          last = Math.max(last, a.at);
        }
      }
    }
    if (n) notes.push({id: `c:${t.id}`, kind: 'check', at: last, text: `${n} хариулт шалгахыг хүлээж байна: ${t.title}`, href: `/admin/topic/${t.id}?check`});
  }
  // The class leaders': answers waiting for the teacher's «yes», mistakes reported.
  for (const byQ of Object.values(help ?? {}))
    for (const a of Object.values(byQ)) notes.push({id: `ha:${a.qid}:${a.at}`, kind: 'question', at: a.at, text: `Ангийн дарга ${a.name} тайлбар бичлээ, зөвшөөрөл хүлээж байна`, href: '/admin?tab=tasks'});
  for (const r of reports ?? []) if (!r.done) notes.push({id: `rp:${r.uid}/${r.rid}`, kind: 'check', at: r.at, text: `Бодлогын алдаа мэдээлсэн: ${r.label}`, href: '/admin?tab=tasks'});
  return notes.sort((a, b) => b.at - a.at);
}

/** The signed-in user's notes (student or teacher) and how many are new. */
export function useNotes() {
  const session = useSession();
  const uid = session.user?.uid;
  const student = !!session.profile && !session.profile.disabled && !session.admin;
  const studentNotes = useStudentNotes(uid, session.profile?.class, student, session.profile?.lead === true);
  const teacherNotes = useTeacherNotes(session.admin);
  // What the student cleared off the list.
  const cleared = Number(session.profile?.prefs?.notesCleared) || 0;
  const hidden = session.profile?.prefs?.notesHidden ?? {};
  const shown = (studentNotes ?? null) && studentNotes!.filter((n) => n.at > cleared && !(Number(hidden[noteKey(n.id)]) >= n.at));
  const notes = session.admin ? teacherNotes : student ? shown : [];
  const [seen, markAll] = useSeen(uid);
  const fresh = (notes ?? []).filter((n) => n.at > seen).length;
  return {notes, seen, fresh, markAll, canClear: student, hide: (n: Note) => hideNote(n, hidden)};
}

/** A note's id as a database key (no '/', '.', '#', '$', '[', ']'). */
const noteKey = (id: string) => id.replace(/[./#$[\]%]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);

/** Clears the student's whole list (what comes later shows). */
export function clearNotes() {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Нэвтэрнэ үү'));
  return update(ref(db, `users/${uid}/prefs`), {notesCleared: serverTimestamp(), notesHidden: null});
}

/** Takes one note off the list (those older than the list keeps go from the record too). */
function hideNote(n: Note, hidden: Record<string, number>) {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Нэвтэрнэ үү'));
  const old = Object.entries(hidden).filter(([, at]) => !(Number(at) > serverNow() - KEEP)).map(([k]) => [`notesHidden/${k}`, null]);
  return update(ref(db, `users/${uid}/prefs`), {...Object.fromEntries(old), [`notesHidden/${noteKey(n.id)}`]: n.at});
}

// ---- on the phone's or computer's own notification list (while the site is open in another tab or app) ----

export const canNotify = () => typeof Notification === 'function';

/** Shows a new note as the device's own notification when the site isn't the page being looked at. */
export function showSystemNote(n: Note) {
  if (!canNotify() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  const options = {body: n.text, tag: n.id, icon: '/icons/icon-192.png', data: {href: n.href}};
  const sw = navigator.serviceWorker?.controller ? navigator.serviceWorker.ready : null;
  if (sw) sw.then((r) => r.showNotification('Batnab', options)).catch(() => {});
  else
    try {
      const x = new Notification('Batnab', options);
      x.onclick = () => {
        window.focus();
        navigate(n.href);
      };
    } catch {
      // some phones only allow it from the service worker
    }
}

// A notification tapped while the site is open: the service worker asks this page to go there (within the site, so an
// exam in progress is asked about first and nothing unsaved is lost to a reload).
navigator.serviceWorker?.addEventListener('message', (e) => {
  const d = e.data as {type?: string; href?: unknown} | null;
  if (d?.type === 'batnab-open' && typeof d.href === 'string' && d.href.startsWith('/')) navigate(d.href);
});
