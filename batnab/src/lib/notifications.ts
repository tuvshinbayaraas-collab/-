// Notifications ("Мэдэгдэл"): made from what is already there, nothing extra is stored for them. A student gets a new
// assignment, one due within a day, the teacher's notes, an exam scheduled or starting, the teacher's check of an
// answer, a reply to a question, a medal, a live quiz starting; the teacher gets new questions and answers waiting to
// be checked. What came after the last look at the list (kept on this device) counts as new.
import {useEffect, useState} from 'react';
import {assignmentState, assignmentTitle} from '../components/Today';
import {testInfo} from '../tests';
import {useAllQuestions, useAnnouncements, useAssignments, useMyQuestions} from './classroom';
import {useExams} from './exams';
import {useMedals} from './leaderboard';
import {useLiveQuiz} from './liveQuiz';
import {forClass, useLive} from './live';
import {useMyResults} from './results';
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
    const now = Math.max(Date.now(), serverNow());
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
function useStudentNotes(uid: string | undefined, classId: string | undefined, on: boolean): Note[] | null {
  const now = useNow(60_000);
  const assignments = useAssignments();
  const announcements = useAnnouncements();
  const exams = useExams();
  const topics = useTopics();
  const progress = useProgress(on ? uid : undefined);
  const marks = useMarks(on ? uid : undefined);
  const results = useMyResults();
  const questions = useMyQuestions(on ? uid : undefined);
  const medals = useMedals(on ? uid : undefined, on);
  const live = useLiveQuiz(on);
  if (!on || !uid) return [];
  if (!assignments || !announcements || !topics || !progress || !marks || !questions) return null;
  const notes: Note[] = [];
  for (const a of assignments.filter((x) => forClass(x.classes, classId))) {
    const title = assignmentTitle(a, topics);
    const href = a.kind === 'topic' ? `/topics/${a.ref}` : `/test/${a.ref}`;
    const due = `${dayLabel(a.due)} ${clock(a.due)} хүртэл`;
    notes.push({id: `a:${a.id}`, kind: 'task', at: a.createdAt, text: `Шинэ даалгавар: ${title} · ${due}`, href});
    const state = assignmentState(a, topics, progress, results ?? []);
    if (!state.done && now >= a.due - DAY && now < a.due) notes.push({id: `d:${a.id}`, kind: 'due', at: a.due - DAY, text: `Маргаашаас өмнө дуусгах: ${title} · ${due}`, href});
  }
  for (const n of announcements.filter((x) => forClass(x.classes, classId))) notes.push({id: `n:${n.id}`, kind: 'news', at: n.at, text: `Багшийн мэдээ: ${n.text}`, href: '/'});
  for (const [test, e] of Object.entries(exams ?? {})) {
    const title = testInfo(test)?.title ?? test;
    if (now <= e.end) notes.push({id: `e:${test}:${e.start}`, kind: 'exam', at: e.createdAt || e.start - DAY, text: `Шалгалт товлогдлоо: ${title} · ${dayLabel(e.start)} ${clock(e.start)}`, href: `/test/${test}`});
    if (now >= e.start && now <= e.end) notes.push({id: `s:${test}:${e.start}`, kind: 'exam', at: e.start, text: `Шалгалт эхэллээ: ${title}`, href: `/test/${test}`});
  }
  for (const [tid, byPid] of Object.entries(marks)) {
    const t = topics.find((x) => x.id === tid);
    if (!t) continue;
    for (const [pid, m] of Object.entries(byPid ?? {})) {
      const i = t.problems.findIndex((p) => p.id === pid);
      if (i < 0 || typeof m?.at !== 'number') continue;
      notes.push({id: `m:${tid}/${pid}`, kind: 'mark', at: m.at, ok: m.ok, text: `Багш шалгалаа: ${t.title} · ${problemNo(t.problems[i], i)}-р бодлого — ${m.ok ? 'зөв' : 'буруу'}${m.note ? `: «${m.note}»` : ''}`, href: `/topics/${tid}`});
    }
  }
  for (const q of questions) if (q.reply) notes.push({id: `r:${q.id}`, kind: 'reply', at: q.reply.at, text: `Багш асуултад тань хариуллаа: ${q.ctx.label}`, href: '/questions'});
  for (const m of medals ?? []) notes.push({id: `md:${m.week}`, kind: 'medal', at: m.week + 7 * DAY, text: `${PLACES[m.place]} ${m.place}-р байр: ${testInfo(m.test)?.title ?? m.test} (${m.score}/${m.total})`, href: '/profile'});
  if (live && live.state !== 'done' && forClass(live.classes, classId)) notes.push({id: `l:${live.startedAt}`, kind: 'live', at: live.startedAt, text: `Шууд тэмцээн эхэллээ: ${live.title}. Нэгдээрэй!`, href: '/live'});
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
  if (!on) return [];
  if (!questions || !topics || !progress || !marks || !keys || !users) return null;
  const notes: Note[] = [];
  for (const q of questions) if (!q.reply) notes.push({id: `q:${q.uid}/${q.id}`, kind: 'question', at: q.at, text: `Шинэ асуулт: ${users[q.uid]?.name ?? 'Сурагч'} — ${q.ctx.label}`, href: '/admin?tab=questions'});
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
  return notes.sort((a, b) => b.at - a.at);
}

/** The signed-in user's notes (student or teacher) and how many are new. */
export function useNotes() {
  const session = useSession();
  const uid = session.user?.uid;
  const student = !!session.profile && !session.profile.disabled && !session.admin;
  const studentNotes = useStudentNotes(uid, session.profile?.class, student);
  const teacherNotes = useTeacherNotes(session.admin);
  const notes = session.admin ? teacherNotes : student ? studentNotes : [];
  const [seen, markAll] = useSeen(uid);
  const fresh = (notes ?? []).filter((n) => n.at > seen).length;
  return {notes, seen, fresh, markAll};
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
        location.assign(n.href);
      };
    } catch {
      // some phones only allow it from the service worker
    }
}
