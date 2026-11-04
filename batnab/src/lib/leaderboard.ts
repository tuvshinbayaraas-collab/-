// The weekly leaderboard: leaderboard/{weekStart}/{testId}/{uid} = each student's best attempt at a test this week.
// A student adds their own score after handing in a test (the rules tie it to one of their results from this week);
// the teacher's dashboard recomputes every entry from the results and the key, so a wrong score doesn't last.
// When a week is over the dashboard turns its top 3 into medals, then its entries go: each test's top 3 get the week's
// animal medals (medals/{uid}/{weekStart}_{test}, with `round`: the week's number from 31 October 2026, which gives its
// animal), the top 3 of "Шилдэг оноогоор" (every test's best added up) the «Шилдэг» orders (medals/{uid}/{weekStart},
// `top`). Older medals at medals/{uid}/{weekStart} without `top` were for the week's best single score.
// pub/{uid}/photo carries the photo (or ready-made picture) of students on the leaderboard, so the podium can show it.
import {get, onValue, ref, serverTimestamp, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {TESTS} from '../tests';
import {auth, db} from './firebase';
import {percent, type Grade} from './keys';
import type {Profile} from './session';
import {photosAllowed} from './settings';
import {serverNow} from './time';
import {weekNo, weekStart} from './week';

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
  /** «Шилдэг оноогоор»: the tests added up (`test` is then ''). */
  tests?: string[];
}

export interface Medal {
  /** Its key under medals/{uid}: the week's start, and for a test's medal "_" and the test. */
  key: string;
  /** Start of the week it was won in. */
  week: number;
  place: 1 | 2 | 3;
  /** The test it was won in ('' for a «Шилдэг» order). */
  test: string;
  score: number;
  total: number;
  /** The week's number (its animal); none from before the animals. */
  round?: number;
  /** A «Шилдэг оноогоор» order: `tests` tests' scores added up. */
  top?: boolean;
  tests?: number;
}

/**
 * Each week has its animal, the twelve of the Mongolian year in turn from the Horse (2026's), on the tests' gold, silver
 * and bronze: «Морины алт», «Хонины мөнгө»… so every week's medals are its own.
 */
export const ANIMALS: [name: string, of: string, sign: string][] = [
  ['Морь', 'Морины', '🐴'],
  ['Хонь', 'Хонины', '🐑'],
  ['Бич', 'Бичний', '🐵'],
  ['Тахиа', 'Тахианы', '🐔'],
  ['Нохой', 'Нохойн', '🐶'],
  ['Гахай', 'Гахайн', '🐷'],
  ['Хулгана', 'Хулганы', '🐭'],
  ['Үхэр', 'Үхрийн', '🐮'],
  ['Бар', 'Барын', '🐯'],
  ['Туулай', 'Туулайн', '🐰'],
  ['Луу', 'Луугийн', '🐲'],
  ['Могой', 'Могойн', '🐍'],
];
export const animalOf = (round: number) => ANIMALS[(Math.max(1, round) - 1) % ANIMALS.length];

/** The weeks over by `now`, oldest first: each with its number, each test's ranking and the «Шилдэг оноогоор» one. */
export function finishedWeeks(tree: Record<string, Record<string, Record<string, Partial<Entry>>>> | null, now = serverNow()) {
  const thisWeek = weekStart(now);
  return Object.keys(tree ?? {})
    .map(Number)
    .filter((w) => w < thisWeek)
    .sort((a, b) => a - b)
    .map((week) => {
      const byTest = parseWeek(tree![week]);
      return {week, no: weekNo(week), byTest: Object.fromEntries(Object.entries(byTest).map(([t, list]) => [t, ranking(list)])), sum: overall(byTest)};
    });
}

/** A finished week's medals: the top 3 of each test and of the sum, among the students `counts` keeps. */
export function weekMedals(w: ReturnType<typeof finishedWeeks>[number], counts: (uid: string) => boolean = () => true) {
  const out: {uid: string; m: Medal}[] = [];
  const top3 = (list: Entry[]) => list.filter((e) => counts(e.uid)).slice(0, 3);
  for (const [test, list] of Object.entries(w.byTest))
    top3(list).forEach((e, i) =>
      out.push({uid: e.uid, m: {key: `${w.week}_${test}`, week: w.week, place: (i + 1) as 1 | 2 | 3, test, score: e.score, total: e.total, ...(w.no ? {round: w.no} : {})}}),
    );
  top3(w.sum).forEach((e, i) =>
    out.push({uid: e.uid, m: {key: String(w.week), week: w.week, place: (i + 1) as 1 | 2 | 3, test: '', score: e.score, total: e.total, top: true, tests: e.tests?.length ?? 1}}),
  );
  return out;
}

/** What is stored for a medal (database.rules.json: medals). */
export const medalData = (m: Medal) =>
  m.top ? {place: m.place, score: m.score, total: m.total, top: true, tests: m.tests ?? 1} : {place: m.place, test: m.test, score: m.score, total: m.total, ...(m.round ? {round: m.round} : {})};

export const weekKey = (now = serverNow()) => String(weekStart(now));

const pct = (e: {score: number; total: number}) => e.score / e.total;

/** Leaderboard order: higher percentage, then more right answers; on a tie, whoever got the score first. */
export const compare = (a: Entry, b: Entry) => pct(b) - pct(a) || b.score - a.score || a.at - b.at;
/** «Шилдэг оноогоор» order: more points in all, then fewer wrong (a higher percentage); on a tie, whoever got there first. */
export const compareSum = (a: Entry, b: Entry) => b.score - a.score || pct(b) - pct(a) || a.at - b.at;

/** The name classmates see: the nickname, or else the login name — never the real name. */
export const publicName = (p: Pick<Profile, 'nickname' | 'username'>) => p.nickname?.trim() || `@${p.username}`;

const parse = (test: string, tree: Record<string, Partial<Entry>> | null): Entry[] =>
  Object.entries(tree ?? {}).flatMap(([uid, e]) =>
    typeof e?.score === 'number' && typeof e.total === 'number' && e.total > 0
      ? [{uid, test, score: e.score, total: e.total, seconds: Number(e.seconds) || 0, name: String(e.name ?? ''), rid: String(e.rid ?? ''), at: Number(e.at) || 0}]
      : [],
  );

/** Every entry of one week, by test. */
export const parseWeek = (tree: Record<string, Record<string, Partial<Entry>>> | null) => Object.fromEntries(Object.entries(tree ?? {}).map(([test, t]) => [test, parse(test, t)]));

/** One test's ranking. A score of 0 doesn't place (it would "win" an empty board). */
export const ranking = (entries: Entry[]) => entries.filter((e) => e.score > 0).sort(compare);

/** «Шилдэг оноогоор»: each student once, with their best score in every test they took this week added up. */
export function overall(byTest: Record<string, Entry[]>) {
  const sum = new Map<string, Entry>();
  for (const e of Object.values(byTest).flat()) {
    if (e.score <= 0) continue;
    const s = sum.get(e.uid);
    sum.set(
      e.uid,
      s
        ? {...s, score: s.score + e.score, total: s.total + e.total, seconds: s.seconds + e.seconds, at: Math.max(s.at, e.at), name: e.at > s.at ? e.name : s.name, tests: [...(s.tests ?? []), e.test]}
        : {...e, test: '', rid: '', tests: [e.test]},
    );
  }
  return [...sum.values()].sort(compareSum);
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

/** What classmates may see of a student's picture: a ready-made one always, a photo only while photos are allowed. */
export const pubOf = (photo: string | null | undefined, photos = photosAllowed()) => (photo && (photo.startsWith('avatar:') || photos) ? {photo} : null);

/**
 * Puts a handed-in test on the leaderboard, if it beats the student's entry for that test this week.
 * `seconds` must be the stored result's (the rules compare them).
 */
export async function submitScore(test: string, g: Grade, seconds: number, rid: string, profile: Profile) {
  const uid = auth.currentUser?.uid;
  if (!uid || !g.score) return;
  const path = `leaderboard/${weekKey()}/${test}/${uid}`;
  const old = parse(test, {[uid]: (await get(ref(db, path))).val()})[0];
  const mine: Entry = {uid, test, score: g.score, total: g.total, seconds, name: publicName(profile), rid, at: serverNow()};
  if (old && compare(old, mine) <= 0 && old.name === mine.name) return;
  const keep = old && compare(old, mine) <= 0 ? old : mine;
  await update(ref(db), {
    [path]: {score: keep.score, total: keep.total, seconds: keep.seconds, name: mine.name, rid: keep.rid, at: keep === mine ? serverTimestamp() : keep.at},
    [`pub/${uid}`]: pubOf(profile.photo),
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
  const tests = Object.entries(tree ?? {})
    .filter(([, t]) => t?.[uid])
    .map(([test]) => test);
  if (!tests.length) return;
  await update(ref(db), {
    ...Object.fromEntries(tests.map((t) => [`leaderboard/${week}/${t}/${uid}/name`, publicName(profile)])),
    [`pub/${uid}`]: pubOf(profile.photo),
  });
}

/** The student's medals, newest first: the ones awarded, plus finished weeks the teacher's dashboard hasn't turned into medals yet. */
export function useMedals(uid: string | undefined, enabled: boolean) {
  const [awarded, setAwarded] = useState<Medal[] | null>(null);
  const [pending, setPending] = useState<Medal[]>([]);
  useEffect(() => {
    if (!uid || !enabled) return;
    const stopAwarded = onValue(
      ref(db, `medals/${uid}`),
      (s) =>
        setAwarded(
          Object.entries((s.val() ?? {}) as Record<string, Partial<Medal>>).flatMap(([key, m]) =>
            m && [1, 2, 3].includes(Number(m.place))
              ? [
                  {
                    key,
                    week: Number(key.split('_')[0]),
                    place: Number(m.place) as 1 | 2 | 3,
                    test: m.top === true ? '' : String(m.test ?? key.split('_')[1] ?? ''),
                    score: Number(m.score),
                    total: Number(m.total),
                    ...(Number(m.round) > 0 ? {round: Number(m.round)} : {}),
                    ...(m.top === true ? {top: true, tests: Number(m.tests) || 1} : {}),
                  },
                ]
              : [],
          ),
        ),
      () => setAwarded([]),
    );
    const stopPending = onValue(
      ref(db, 'leaderboard'),
      (s) => setPending(finishedWeeks(s.val()).flatMap((w) => weekMedals(w).flatMap((x) => (x.uid === uid ? [x.m] : [])))),
      () => setPending([]),
    );
    return () => {
      stopAwarded();
      stopPending();
    };
  }, [uid, enabled]);
  if (!awarded) return null;
  const have = new Set(awarded.map((m) => m.key));
  return [...awarded, ...pending.filter((m) => !have.has(m.key))].sort((a, b) => b.week - a.week || Number(!!b.top) - Number(!!a.top) || a.place - b.place || a.test.localeCompare(b.test));
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

/** The «Шилдэг оноогоор» orders' names. */
export const ORDERS = {1: 'Алтан одон', 2: 'Мөнгөн одон', 3: 'Хүрэл одон'} as const;

/** A medal's name: «Алтан одон» for «Шилдэг»'s, «Морины алт» with its week's animal, «Алт» from before the animals. */
export const medalName = (m: Pick<Medal, 'place' | 'round' | 'top'>) => (m.top ? ORDERS[m.place] : m.round ? `${animalOf(m.round)[1]} ${PLACES[m.place].name.toLowerCase()}` : PLACES[m.place].name);

export const percentOf = (e: {score: number; total: number}) => percent({score: e.score, total: e.total, count: e.total});
