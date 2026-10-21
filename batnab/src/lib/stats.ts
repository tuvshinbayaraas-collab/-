// A student's daily practice streak and counters: stats/{uid} = {streak, best, last (the last day practised,
// Ulaanbaatar date), learned (problems learned in the mistakes notebook), days: {date: problems done}}.
import {ref, update} from 'firebase/database';
import {auth, db} from './firebase';
import {useLive} from './live';
import {serverNow} from './time';

export interface Stats {
  streak: number;
  best: number;
  last?: string;
  learned: number;
  days: Record<string, number>;
}

const DAY = 86_400_000;
/** The date in Ulaanbaatar (UTC+8), as "2026-10-19". */
export const dayKey = (at = serverNow()) => new Date(at + 8 * 3600_000).toISOString().slice(0, 10);

export const useStats = (uid: string | undefined) =>
  useLive(uid ? `stats/${uid}` : null, (v): Stats => {
    const s = (v ?? {}) as Partial<Stats>;
    return {streak: Number(s.streak) || 0, best: Number(s.best) || 0, last: typeof s.last === 'string' ? s.last : undefined, learned: Number(s.learned) || 0, days: s.days ?? {}};
  });

/** The streak as it stands today: it's gone if yesterday was missed. */
export const liveStreak = (s: Stats | null) => (s && (s.last === dayKey() || s.last === dayKey(serverNow() - DAY)) ? s.streak : 0);
export const doneToday = (s: Stats | null) => !!s && s.last === dayKey();

/** Today's practice is finished: the streak grows by one (or starts again at 1). */
export async function practised(s: Stats, count: number) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const today = dayKey();
  if (s.last === today) return;
  const streak = s.last === dayKey(serverNow() - DAY) ? s.streak + 1 : 1;
  await update(ref(db, `stats/${uid}`), {streak, best: Math.max(s.best, streak), last: today, [`days/${today}`]: count});
}

export async function learnedOne(s: Stats | null) {
  const uid = auth.currentUser?.uid;
  if (uid) await update(ref(db, `stats/${uid}`), {learned: (s?.learned ?? 0) + 1});
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  hint: string;
  earned: boolean;
}

/** Everything the badges look at. */
export interface BadgeFacts {
  tests: number;
  perfect: boolean;
  topicsDone: number;
  topicMaster: boolean;
  bestStreak: number;
  learned: number;
  medals: number;
  asked: boolean;
  weeks: number;
}

export function badges(f: BadgeFacts): Badge[] {
  return [
    {id: 'first', icon: '🚀', name: 'Анхны алхам', hint: 'Анхны тестээ өгөх', earned: f.tests > 0},
    {id: 'perfect', icon: '💯', name: 'Төгс оноо', hint: 'Тестэд бүх бодлогыг зөв бодох', earned: f.perfect},
    {id: 'topic', icon: '📘', name: 'Сэдэв дуусгагч', hint: 'Нэг сэдвийн бүх бодлогыг бодох', earned: f.topicsDone >= 1},
    {id: 'topics5', icon: '📚', name: '5 сэдэв', hint: '5 сэдвийг бүрэн бодох', earned: f.topicsDone >= 5},
    {id: 'master', icon: '🎯', name: 'Сэдвийн мастер', hint: 'Сэдвийн бүх бодлогыг эхний оролдлогоор зөв бодох', earned: f.topicMaster},
    {id: 'streak3', icon: '🔥', name: '3 өдөр', hint: '3 өдөр дараалан өдрийн дасгал хийх', earned: f.bestStreak >= 3},
    {id: 'streak7', icon: '⚡', name: '7 өдөр', hint: '7 өдөр дараалан өдрийн дасгал хийх', earned: f.bestStreak >= 7},
    {id: 'streak30', icon: '🌟', name: '30 өдөр', hint: '30 өдөр дараалан өдрийн дасгал хийх', earned: f.bestStreak >= 30},
    {id: 'fixer', icon: '🛠️', name: 'Алдаагаа засагч', hint: 'Алдааны дэвтрээс 10 бодлого сурах', earned: f.learned >= 10},
    {id: 'medal', icon: '🏅', name: 'Медальт', hint: 'Leaderboard-оос медаль авах', earned: f.medals > 0},
    {id: 'curious', icon: '💬', name: 'Сониуч', hint: 'Багшаас анхны асуултаа асуух', earned: f.asked},
    {id: 'regular', icon: '📅', name: 'Тогтмол', hint: '4 өөр долоо хоногт тест өгөх', earned: f.weeks >= 4},
  ];
}
