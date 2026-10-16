// Everything the teacher's dashboard shows, read live from the database (admins may read users, results and keys).
import {onValue, ref, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {parseExamAnswer, type Exam, type ExamAnswer} from '../../lib/exams';
import {db} from '../../lib/firebase';
import {choiceAt, grade, percent, type Grade} from '../../lib/keys';
import {compare, overall, parseWeek, publicName, pubOf, weekKey, type Entry} from '../../lib/leaderboard';
import {clearOld, flatten, type Result} from '../../lib/results';
import type {Profile} from '../../lib/session';
import {useSettings} from '../../lib/settings';
import {inThisWeek, weekStart} from '../../lib/week';
import {TESTS, testInfo, type TestInfo} from '../../tests';

export interface Student {
  uid: string;
  profile: Profile;
}

export interface AdminData {
  students: Student[];
  /** Every student's results, newest first. */
  results: Result[];
  keys: Record<string, string>;
  /** Scheduled exams by test id. */
  exams: Record<string, Exam>;
  /** Exam answers by test id, then student uid. */
  examAnswers: Record<string, Record<string, ExamAnswer>>;
}

export function useAdminData() {
  const [raw, setRaw] = useState<{
    users?: Record<string, Profile>;
    admins?: Record<string, boolean>;
    results?: Record<string, Record<string, unknown>>;
    keys?: Record<string, string>;
    exams?: Record<string, Partial<Exam>>;
    examAnswers?: Record<string, Record<string, Partial<ExamAnswer>>>;
    leaderboard?: Record<string, Record<string, Record<string, Partial<Entry>>>>;
    pub?: Record<string, {photo?: string}>;
    error?: string;
  }>({});
  const settings = useSettings();
  // Last week's results are cleared by whoever opens the site first after the reset; the teacher clears everyone's,
  // along with results of deleted accounts and leftovers in an older format.
  useEffect(() => {
    if (!raw.results || !raw.users || raw.error) return;
    const gone: Record<string, null> = {};
    for (const [uid, tree] of Object.entries(raw.results)) {
      if (!raw.users[uid]) gone[`results/${uid}`] = null;
      else for (const key of Object.keys(tree ?? {})) if (!/^[0-9]{1,2}[AB]$/.test(key)) gone[`results/${uid}/${key}`] = null;
    }
    // Exams that ended before this week's reset go too, with their answers.
    for (const [test, e] of Object.entries(raw.exams ?? {})) {
      if (typeof e?.end === 'number' && e.end < weekStart()) {
        gone[`exams/${test}`] = null;
        gone[`examAnswers/${test}`] = null;
      }
    }
    if (Object.keys(gone).length) update(ref(db), gone).catch(() => {});
    clearOld(Object.entries(raw.results).flatMap(([uid, tree]) => (raw.users![uid] ? flatten(uid, tree) : [])));
  }, [raw.results, raw.users, raw.exams, raw.error]);
  // The leaderboard stays right: this week's entries are worked out again from the results and keys (what a student
  // sent is trusted only until then), and a finished week's top 3 become medals.
  useEffect(() => {
    const {users, admins, results, keys, leaderboard, pub, error} = raw;
    if (!users || !admins || !results || !keys || !leaderboard || !pub || error || !settings?.leaderboard) return;
    const fixes = leaderboardFixes(users, admins, results, keys, leaderboard, pub, settings.photos);
    if (Object.keys(fixes).length) update(ref(db), fixes).catch(() => {});
  }, [raw, settings?.leaderboard, settings?.photos]);
  useEffect(() => {
    const stops = (['users', 'admins', 'results', 'keys', 'exams', 'examAnswers', 'leaderboard', 'pub'] as const).map((path) =>
      onValue(
        ref(db, path),
        (s) => setRaw((r) => ({...r, [path]: s.val() ?? {}})),
        (e) => setRaw((r) => ({...r, [path]: {}, error: e.message})),
      ),
    );
    return () => stops.forEach((f) => f());
  }, []);

  if (!raw.users || !raw.admins || !raw.results || !raw.keys || !raw.exams || !raw.examAnswers) return {data: null, error: raw.error};
  const students = Object.entries(raw.users)
    .filter(([uid, p]) => !raw.admins![uid] && p && typeof p.username === 'string')
    .map(([uid, profile]) => ({uid, profile}))
    .sort((a, b) => a.profile.name.localeCompare(b.profile.name, 'mn'));
  const known = new Set(students.map((s) => s.uid));
  const results = Object.entries(raw.results)
    .filter(([uid]) => known.has(uid))
    .flatMap(([uid, tree]) => flatten(uid, tree).filter((r) => inThisWeek(r.at)))
    .sort((a, b) => b.at - a.at);
  const keys = Object.fromEntries(Object.entries(raw.keys).filter(([, k]) => typeof k === 'string'));
  const exams = Object.fromEntries(
    Object.entries(raw.exams).flatMap(([test, e]) => (testInfo(test) && typeof e?.start === 'number' && typeof e?.end === 'number' ? [[test, {start: e.start, end: e.end}]] : [])),
  );
  const examAnswers = Object.fromEntries(
    Object.entries(raw.examAnswers).map(([test, byUid]) => [
      test,
      Object.fromEntries(Object.entries(byUid ?? {}).flatMap(([uid, a]) => (known.has(uid) && parseExamAnswer(a as ExamAnswer) ? [[uid, parseExamAnswer(a as ExamAnswer)!]] : []))),
    ]),
  );
  return {data: {students, results, keys, exams, examAnswers} as AdminData, error: raw.error};
}

/** The writes that bring the leaderboard in line with the results (see the effect in useAdminData). */
export function leaderboardFixes(
  users: Record<string, Profile>,
  admins: Record<string, boolean>,
  results: Record<string, Record<string, unknown>>,
  keys: Record<string, string>,
  leaderboard: Record<string, Record<string, Record<string, Partial<Entry>>>>,
  pub: Record<string, {photo?: string}>,
  photos = true,
) {
  const ops: Record<string, unknown> = {};
  const week = weekKey();
  const start = Number(week);
  // Each taking part student's best attempt at each test this week.
  const want: Record<string, Record<string, Entry>> = {};
  for (const [uid, p] of Object.entries(users)) {
    if (admins[uid] || typeof p?.username !== 'string' || p.disabled || p.prefs?.lbOff) continue;
    for (const r of flatten(uid, (results[uid] ?? null) as Parameters<typeof flatten>[1])) {
      const g = r.at >= start ? grade(r.answers, keys[r.test], testInfo(r.test)!.count) : null;
      if (!g?.score) continue;
      const e: Entry = {uid, test: r.test, score: g.score, total: g.total, seconds: r.seconds, name: publicName(p), rid: r.id, at: r.at};
      const b = want[r.test]?.[uid];
      if (!b || compare(e, b) < 0) (want[r.test] ??= {})[uid] = e;
    }
  }
  const current = parseWeek(leaderboard[week] ?? null);
  for (const test of new Set([...Object.keys(current), ...Object.keys(want)])) {
    const have = new Map((current[test] ?? []).map((e) => [e.uid, e]));
    for (const [uid, e] of Object.entries(want[test] ?? {})) {
      const h = have.get(uid);
      have.delete(uid);
      if (h && h.score === e.score && h.total === e.total && h.seconds === e.seconds && h.rid === e.rid && h.name === e.name) continue;
      ops[`leaderboard/${week}/${test}/${uid}`] = {score: e.score, total: e.total, seconds: e.seconds, name: e.name, rid: e.rid, at: h?.rid === e.rid && h.at ? h.at : e.at};
    }
    for (const uid of have.keys()) ops[`leaderboard/${week}/${test}/${uid}`] = null;
  }
  // Photos for the podium: only of students on the leaderboard (and while photos are off, only ready-made pictures).
  const shown = new Set(Object.values(want).flatMap((t) => Object.keys(t)));
  for (const uid of new Set([...shown, ...Object.keys(pub)])) {
    const photo = shown.has(uid) ? (pubOf(users[uid]?.photo, photos)?.photo ?? null) : null;
    if ((pub[uid]?.photo ?? null) !== photo) ops[`pub/${uid}`] = photo ? {photo} : null;
  }
  // Finished weeks: medals for the top 3 of "Хамгийн өндөр оноо", then the week's entries go.
  for (const [w, tree] of Object.entries(leaderboard)) {
    if (w >= week) continue;
    overall(parseWeek(tree))
      .filter((e) => users[e.uid])
      .slice(0, 3)
      .forEach((e, i) => (ops[`medals/${e.uid}/${w}`] = {place: i + 1, test: e.test, score: e.score, total: e.total}));
    ops[`leaderboard/${w}`] = null;
  }
  return ops;
}

export const gradeOf = (r: Result, keys: Record<string, string>) => grade(r.answers, keys[r.test], testInfo(r.test)!.count);

export interface StudentTest {
  student: Student;
  /** Oldest first. */
  attempts: Result[];
  first: Grade | null;
  best: Grade | null;
}

export interface QuestionStat {
  /** Index in book order. */
  i: number;
  /** Key choice, or null when the teacher hasn't set it. */
  key: number | null;
  answered: number;
  correct: number;
  /** How many picked А…Д. */
  picks: number[];
  /** The wrong choice picked most often (null if none). */
  topWrong: number | null;
}

export interface TestReport {
  info: TestInfo;
  key: string | undefined;
  rows: StudentTest[];
  missing: Student[];
  /** First-attempt percentages of graded students. */
  firstPercents: number[];
  questions: QuestionStat[];
  avgSeconds: number | null;
}

const best = (gs: (Grade | null)[]) => gs.reduce<Grade | null>((b, g) => (g && (!b || percent(g) > percent(b)) ? g : b), null);
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** One test across the class. Question statistics use each student's first attempt, before they saw the answers. */
export function testReport(info: TestInfo, data: AdminData): TestReport {
  const key = data.keys[info.id];
  const mine = data.results.filter((r) => r.test === info.id);
  const rows: StudentTest[] = [];
  const missing: Student[] = [];
  for (const student of data.students) {
    const attempts = mine.filter((r) => r.uid === student.uid).sort((a, b) => a.at - b.at);
    if (!attempts.length) {
      if (!student.profile.disabled) missing.push(student);
      continue;
    }
    const grades = attempts.map((r) => grade(r.answers, key, info.count));
    rows.push({student, attempts, first: grades[0], best: best(grades)});
  }
  const firsts = rows.map((r) => r.attempts[0]);
  const questions = Array.from({length: info.count}, (_, i): QuestionStat => {
    const picks = [0, 0, 0, 0, 0];
    for (const r of firsts) {
      const c = choiceAt(r.answers, i);
      if (c !== null) picks[c]++;
    }
    const k = choiceAt(key, i);
    const wrong = picks.map((n, c) => (c === k ? -1 : n));
    const top = Math.max(...wrong);
    return {i, key: k, answered: picks.reduce((a, b) => a + b, 0), correct: k === null ? 0 : picks[k], picks, topWrong: top > 0 ? wrong.indexOf(top) : null};
  });
  return {
    info,
    key,
    rows,
    missing,
    firstPercents: rows.flatMap((r) => (r.first ? [percent(r.first)] : [])),
    questions,
    avgSeconds: mean(firsts.map((r) => r.seconds)),
  };
}

export const reports = (data: AdminData) => TESTS.map((t) => testReport(t, data));

/** Spreadsheet of every attempt (opens in Excel thanks to the BOM). */
export function resultsCsv(data: AdminData) {
  const byUid = new Map(data.students.map((s) => [s.uid, s.profile]));
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Нэр', 'Nickname', 'Нэвтрэх нэр', 'Тест', 'Огноо', 'Хугацаа (мин)', 'Оноо', 'Тооцсон бодлого', 'Хувь', 'Хуудаснаас гарсан', 'Хариултууд']];
  for (const r of [...data.results].sort((a, b) => a.at - b.at)) {
    const p = byUid.get(r.uid)!;
    const g = gradeOf(r, data.keys);
    const d = new Date(r.at);
    const pad = (n: number) => String(n).padStart(2, '0');
    rows.push([
      p.name,
      p.nickname ?? '',
      p.username,
      testInfo(r.test)!.title,
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      (r.seconds / 60).toFixed(1),
      g ? String(g.score) : '',
      g ? String(g.total) : '',
      g ? String(percent(g)) : '',
      String(r.leaves ?? 0),
      r.answers.replace(/[A-E]/g, (c) => 'АБВГД'['ABCDE'.indexOf(c)]),
    ]);
  }
  return '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}

export function download(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const timeAgo = (ts: number) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'дөнгөж сая';
  if (s < 3600) return `${Math.floor(s / 60)} мин өмнө`;
  if (s < 86400) return `${Math.floor(s / 3600)} цагийн өмнө`;
  return `${Math.floor(s / 86400)} өдрийн өмнө`;
};
