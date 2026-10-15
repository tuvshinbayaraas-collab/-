// The weekly leaderboard: leaderboard/{weekStart}/{testId}/{uid} = each student's best attempt at a test this week.
// A student adds their own score after handing in a test (the rules tie it to one of their results from this week);
// the teacher's dashboard recomputes every entry from the results and the key, so a wrong score doesn't last.
// When a week is over the dashboard turns its top 3 into medals (medals/{uid}/{weekStart}).
// pub/{uid}/photo carries the photo of students on the leaderboard, so the podium can show it.
import {get, onValue, ref, serverTimestamp, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {TESTS} from '../tests';
import {auth, db} from './firebase';
import {percent, type Grade} from './keys';
import {shownName, type Profile} from './session';
import {serverNow} from './time';
import {weekStart} from './week';

export interface Entry {
  uid: string;
  test: string;
  score: number;
  total: number;
  seconds: number;
  name: string;
  /** The result it comes from. */
  rid: string;
  at: number;
}

export interface Medal {
  /** Start of the week it was won in. */
  week: number;
  place: 1 | 2 | 3;
  test: string;
  score: number;
  total: number;
}

export const weekKey = (now = serverNow()) => String(weekStart(now));

const pct = (e: {score: number; total: number}) => e.score / e.total;

/** Leaderboard order: higher percentage, then more right answers, then faster, then earlier. */
export const compare = (a: Entry, b: Entry) => pct(b) - pct(a) || b.score - a.score || a.seconds - b.seconds || a.at - b.at;

const parse = (test: string, tree: Record<string, Partial<Entry>> | null): Entry[] =>
  Object.entries(tree ?? {}).flatMap(([uid, e]) =>
    typeof e?.score === 'number' && typeof e.total === 'number' && e.total > 0
      ? [{uid, test, score: e.score, total: e.total, seconds: Number(e.seconds) || 0, name: String(e.name ?? ''), rid: String(e.rid ?? ''), at: Number(e.at) || 0}]
      : [],
  );

/** Every entry of one week, by test. */
export const parseWeek = (tree: Record<string, Record<string, Partial<Entry>>> | null) =>
  Object.fromEntries(Object.entries(tree ?? {}).map(([test, t]) => [test, parse(test, t)]));

/** One test's ranking. */
export const ranking = (entries: Entry[]) => [...entries].sort(compare);

/** "Хамгийн өндөр оноо": each student once, with their best score in any test. */
export function overall(byTest: Record<string, Entry[]>) {
  const best = new Map<string, Entry>();
  for (const e of Object.values(byTest).flat()) {
    const b = best.get(e.uid);
    if (!b || compare(e, b) < 0) best.set(e.uid, e);
  }
  return ranking([...best.values()]);
}

/** This week's leaderboard, by test: null while loading. */
export function useWeekBoard(enabled = true) {
  const [board, setBoard] = useState<{week: string; byTest: Record<string, Entry[]>} | null>(null);
  const week = weekKey();
  useEffect(() => {
    if (!enabled) return;
    return onValue(
      ref(db, `leaderboard/${week}`),
      (s) => setBoard({week, byTest: parseWeek(s.val())}),
      () => setBoard({week, byTest: {}}),
    );
  }, [week, enabled]);
  return board?.week === week ? board.byTest : null;
}

/** Photos of the students shown (null entries while loading or without a photo). */
export function usePhotos(uids: string[]) {
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const sig = uids.join(',');
  useEffect(() => {
    const stops = sig
      .split(',')
      .filter(Boolean)
      .map((uid) =>
        onValue(
          ref(db, `pub/${uid}/photo`),
          (s) => setPhotos((p) => ({...p, [uid]: typeof s.val() === 'string' ? s.val() : null})),
          () => setPhotos((p) => ({...p, [uid]: null})),
        ),
      );
    return () => stops.forEach((f) => f());
  }, [sig]);
  return photos;
}

/**
 * Puts a handed-in test on the leaderboard, if it beats the student's entry for that test this week.
 * `seconds` must be the stored result's (the rules compare them).
 */
export async function submitScore(test: string, g: Grade, seconds: number, rid: string, profile: Profile) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const path = `leaderboard/${weekKey()}/${test}/${uid}`;
  const old = parse(test, {[uid]: (await get(ref(db, path))).val()})[0];
  const mine: Entry = {uid, test, score: g.score, total: g.total, seconds, name: shownName(profile), rid, at: serverNow()};
  if (old && compare(old, mine) <= 0 && old.name === mine.name) return;
  const keep = old && compare(old, mine) <= 0 ? old : mine;
  await update(ref(db), {
    [path]: {score: keep.score, total: keep.total, seconds: keep.seconds, name: mine.name, rid: keep.rid, at: keep === mine ? serverTimestamp() : keep.at},
    [`pub/${uid}`]: profile.photo ? {photo: profile.photo} : null,
  });
}

/** Takes the student off this week's leaderboard (the "don't show my score" setting). */
export async function withdraw() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const week = weekKey();
  await update(ref(db), Object.fromEntries([...TESTS.map((t) => [`leaderboard/${week}/${t.id}/${uid}`, null]), [`pub/${uid}`, null]]));
}

/** After a nickname or photo change: the student's entries this week show the new name and photo. */
export async function refreshMine(profile: Profile) {
  const uid = auth.currentUser?.uid;
  if (!uid || profile.prefs?.lbOff) return;
  const week = weekKey();
  const tree = (await get(ref(db, `leaderboard/${week}`)).catch(() => null))?.val() as Record<string, Record<string, unknown>> | null;
  const tests = Object.entries(tree ?? {}).filter(([, t]) => t?.[uid]).map(([test]) => test);
  if (!tests.length) return;
  await update(ref(db), {
    ...Object.fromEntries(tests.map((t) => [`leaderboard/${week}/${t}/${uid}/name`, shownName(profile)])),
    [`pub/${uid}`]: profile.photo ? {photo: profile.photo} : null,
  });
}

/** The student's medals: the ones already awarded, plus finished weeks the teacher's dashboard hasn't turned into medals yet. */
export function useMedals(uid: string | undefined, enabled: boolean) {
  const [awarded, setAwarded] = useState<Medal[] | null>(null);
  const [pending, setPending] = useState<Medal[]>([]);
  useEffect(() => {
    if (!uid || !enabled) return;
    const stopAwarded = onValue(
      ref(db, `medals/${uid}`),
      (s) =>
        setAwarded(
          Object.entries((s.val() ?? {}) as Record<string, Partial<Medal>>).flatMap(([week, m]) =>
            m && [1, 2, 3].includes(Number(m.place)) ? [{week: Number(week), place: Number(m.place) as 1 | 2 | 3, test: String(m.test), score: Number(m.score), total: Number(m.total)}] : [],
          ),
        ),
      () => setAwarded([]),
    );
    const stopPending = onValue(
      ref(db, 'leaderboard'),
      (s) => {
        const now = weekKey();
        const out: Medal[] = [];
        for (const [week, tree] of Object.entries((s.val() ?? {}) as Record<string, Record<string, Record<string, Partial<Entry>>>>)) {
          if (week >= now) continue;
          const top = overall(parseWeek(tree)).slice(0, 3);
          const i = top.findIndex((e) => e.uid === uid);
          if (i >= 0) out.push({week: Number(week), place: (i + 1) as 1 | 2 | 3, test: top[i].test, score: top[i].score, total: top[i].total});
        }
        setPending(out);
      },
      () => setPending([]),
    );
    return () => {
      stopAwarded();
      stopPending();
    };
  }, [uid, enabled]);
  if (!awarded) return null;
  const weeks = new Set(awarded.map((m) => m.week));
  return [...awarded, ...pending.filter((m) => !weeks.has(m.week))].sort((a, b) => b.week - a.week);
}

const pad = (n: number) => String(n).padStart(2, '0');
// Weeks run Saturday to Friday in Ulaanbaatar time (UTC+8), whatever the device's time zone.
const day = (ts: number) => {
  const d = new Date(ts + 8 * 3600000);
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
};
/** "10.10–10.16" (Saturday to Friday). */
export const weekLabel = (start: number) => `${day(start)}–${day(start + 6 * 86400000)}`;

export const PLACES = {
  1: {name: 'Алт', ring: 'ring-amber-400', badge: 'bg-amber-400 text-black', text: 'text-amber-300', block: 'bg-amber-400/15'},
  2: {name: 'Мөнгө', ring: 'ring-slate-300', badge: 'bg-slate-300 text-black', text: 'text-slate-200', block: 'bg-slate-300/10'},
  3: {name: 'Хүрэл', ring: 'ring-orange-600', badge: 'bg-orange-600 text-white', text: 'text-orange-300', block: 'bg-orange-600/15'},
} as const;

export const percentOf = (e: {score: number; total: number}) => percent({score: e.score, total: e.total, count: e.total});
