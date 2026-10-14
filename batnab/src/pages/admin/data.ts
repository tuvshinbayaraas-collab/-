// Everything the teacher's dashboard shows, read live from the database (admins may read users, results and keys).
import {onValue, ref} from 'firebase/database';
import {useEffect, useState} from 'react';
import {db} from '../../lib/firebase';
import {choiceAt, grade, percent, type Grade} from '../../lib/keys';
import {flatten, type Result} from '../../lib/results';
import type {Profile} from '../../lib/session';
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
}

export function useAdminData() {
  const [raw, setRaw] = useState<{users?: Record<string, Profile>; admins?: Record<string, boolean>; results?: Record<string, never>; keys?: Record<string, string>; error?: string}>({});
  useEffect(() => {
    const stops = (['users', 'admins', 'results', 'keys'] as const).map((path) =>
      onValue(
        ref(db, path),
        (s) => setRaw((r) => ({...r, [path]: s.val() ?? {}})),
        (e) => setRaw((r) => ({...r, [path]: {}, error: e.message})),
      ),
    );
    return () => stops.forEach((f) => f());
  }, []);

  if (!raw.users || !raw.admins || !raw.results || !raw.keys) return {data: null, error: raw.error};
  const students = Object.entries(raw.users)
    .filter(([uid, p]) => !raw.admins![uid] && p && typeof p.username === 'string')
    .map(([uid, profile]) => ({uid, profile}))
    .sort((a, b) => a.profile.name.localeCompare(b.profile.name, 'mn'));
  const known = new Set(students.map((s) => s.uid));
  const results = Object.entries(raw.results)
    .filter(([uid]) => known.has(uid))
    .flatMap(([uid, tree]) => flatten(uid, tree))
    .sort((a, b) => b.at - a.at);
  const keys = Object.fromEntries(Object.entries(raw.keys).filter(([, k]) => typeof k === 'string'));
  return {data: {students, results, keys} as AdminData, error: raw.error};
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
  const rows = [['Нэр', 'Хоч', 'Нэвтрэх нэр', 'Тест', 'Огноо', 'Хугацаа (мин)', 'Оноо', 'Тооцсон бодлого', 'Хувь', 'Хариултууд']];
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
