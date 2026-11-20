// The math games (src/games): a minute or so of play, and the week's best in the class.
//   gameScores/{week}/{game}/{uid} = {s, at, name, cls}   a student's best this week: the rules take it only for the
//                        current week (the same Saturday reset as the leaderboard, lib/week), only higher than (or as
//                        high as) before, within each game's ceiling, with the name the leaderboard shows (nickname or
//                        @login) and the student's class. The student may take it off (the leaderboard switched off).
//   gameTries/{uid}/{day} = {g, at, s?}   the day's challenge: one try a day, set down as it starts (so a peek at the
//                        problems is the try); its score added once, within the game's time. Only they (and the
//                        teacher) read it.
//   gameDaily/{day}/{uid} = {s, at, name, cls, g}   the day's board: the score of that try, nothing else.
//   stats/{uid}/games/{game} = {lv, best}   where the next game starts (games/adapt) and the best ever;
//   stats/{uid}/gameStreak, gameBestStreak, gameLast (the day number)   days of challenges in a row.
// {day} is the day in Ulaanbaatar counted from 1 January 1970: the same for everyone, and what the rules work out.
import {ref, serverTimestamp, update} from 'firebase/database';
import {auth, db} from './firebase';
import {publicName} from './leaderboard';
import {useLive} from './live';
import {seeded, seedOf, type Rng} from './rand';
import type {Profile} from './session';
import {serverNow} from './time';
import {weekStart} from './week';

export type GameId = 'sprint' | 'g24' | 'graph' | 'tf' | 'ees';

export interface GameInfo {
  id: GameId;
  title: string;
  /** One line on the hub. */
  short: string;
  /** How it is played, before the start. */
  rules: string[];
  /** Seconds of play. */
  seconds: number;
  /** The top of its ladder (games/adapt). */
  levels: number;
  /** Tailwind classes for its tile. */
  tone: string;
  sign: string;
}

export const GAMES: GameInfo[] = [
  {
    id: 'sprint',
    title: 'Хурдан тооцоо',
    short: 'Нэг минутад аль болох олныг бод',
    rules: ['Хариугаа бичнэ. Зөв бол дараагийн бодлого шууд гарна.', 'Зөв бодох тусам бодлого хүндэрч, оноо нь өснө. OK дараад алдвал 3 секунд хасагдана.'],
    seconds: 60,
    levels: 5,
    tone: 'from-blue-600/30 to-cyan-500/10 text-cyan-200',
    sign: '⚡',
  },
  {
    id: 'g24',
    title: '24 тоглоом',
    short: 'Дөрвөн тооноос 24 гарга',
    rules: ['Тоо, үйлдэл, дараа нь нөгөө тоогоо дарна. Хоёр тоо нийлээд нэг болно. Эцэст нь 24 үлдвэл оноо авна.', 'Хэцүү тоонууд илүү оноотой. Хугацаа 3 минут, алгасвал 10 секунд хасагдана.'],
    seconds: 180,
    levels: 3,
    tone: 'from-amber-600/30 to-orange-500/10 text-amber-200',
    sign: '🃏',
  },
  {
    id: 'graph',
    title: 'График таах',
    short: 'Графикаар нь тэгшитгэлийг ол',
    rules: [
      'Дөрвөн тэгшитгэлээс графикт таарахыг нь сонгоно.',
      'Шулуун, парабол, модулиас эхлээд илтгэгч, логарифм, sin, cos функц хүртэл гарна. Хүнд график илүү оноотой.',
      'Хугацаа 90 секунд. Алдвал 5 секунд хасагдана.',
    ],
    seconds: 90,
    levels: 5,
    tone: 'from-violet-600/30 to-fuchsia-500/10 text-violet-200',
    sign: '📈',
  },
  {
    id: 'tf',
    title: 'Зөв үү, буруу юу?',
    short: 'Тэгшитгэл зөв үү гэдгийг хурдан хэл',
    rules: ['Тэгшитгэл зөв бол «Зөв», буруу бол «Буруу» дарна.', 'Таваас дээш дараалан зөв хариулбал оноо хоёр дахин өснө. Хугацаа 60 секунд, алдвал 2 секунд хасагдана.'],
    seconds: 60,
    levels: 5,
    tone: 'from-emerald-600/30 to-teal-500/10 text-emerald-200',
    sign: '✅',
  },
  {
    id: 'ees',
    title: 'ЭЕШ сорил',
    short: 'Таван хариултаас зөвийг нь сонго',
    rules: ['ЭЕШ шиг бодлого бүрт А–Д таван хариулт байна. Зөвийг нь дарна.', 'Хүнд бодлого илүү оноотой. Хугацаа 2 минут, алдвал 4 секунд хасагдана.'],
    seconds: 120,
    levels: 5,
    tone: 'from-rose-600/30 to-pink-500/10 text-rose-200',
    sign: '🎯',
  },
];

export const gameOf = (id: string | undefined) => GAMES.find((g) => g.id === id) ?? null;

export interface Score {
  uid: string;
  s: number;
  at: number;
  name: string;
  cls?: string;
}

/** This week's key (as the rules work it out). */
export const thisWeek = () => String(weekStart(serverNow()));

const DAY = 86_400_000;
/** The day in Ulaanbaatar, counted from 1 January 1970 (what the rules work out from `now`). */
export const ubDay = (at = serverNow()) => Math.floor((at + 8 * 3600_000) / DAY);

/** The games of the day's challenge, one after another. */
const DAILY: GameId[] = ['sprint', 'g24', 'graph', 'tf', 'ees'];
export const dailyGame = (day = ubDay()) => gameOf(DAILY[day % DAILY.length])!;
/** The source of the day's i-th problem: the same on every phone. */
export const dailyRng = (day: number, game: GameId) => (i: number): Rng => seeded(seedOf('batnab', day, game, i));

const board = (v: unknown, game?: GameId) =>
  Object.entries((v ?? {}) as Record<string, Partial<Score> & {g?: string}>)
    .flatMap(([uid, x]) =>
      typeof x?.s === 'number' && x.s > 0 && (!game || x.g === game) ? [{uid, s: x.s, at: Number(x.at) || 0, name: String(x.name ?? ''), cls: typeof x.cls === 'string' ? x.cls : undefined}] : [],
    )
    .sort((a, b) => b.s - a.s || a.at - b.at);

/** This week's scores in a game, best first (null while loading). */
export const useGameBoard = (game: GameId, on = true) => useLive(on ? `gameScores/${thisWeek()}/${game}` : null, (v) => board(v));

/** The day's challenge scores, best first. */
export const useDailyBoard = (day: number, game: GameId, on = true) => useLive(on ? `gameDaily/${day}` : null, (v) => board(v, game));

/** The classes by the sum of their ten best (so a big class doesn't win by numbers alone), with how many played. */
export function classTotals(list: Score[]) {
  const by = new Map<string, number[]>();
  for (const e of list) if (e.cls) by.set(e.cls, [...(by.get(e.cls) ?? []), e.s]);
  return [...by.entries()]
    .map(([cls, ss]) => ({cls, total: [...ss].sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0), players: ss.length}))
    .sort((a, b) => b.total - a.total || b.players - a.players);
}

export interface GameStats {
  lv: number;
  best: number;
}

/** Where the student's next game starts, and their best ever (null while loading; nothing for the teacher). */
export const useGameStats = (uid: string | undefined, game: GameId) =>
  useLive(uid ? `stats/${uid}/games/${game}` : null, (v): GameStats => {
    const x = (v ?? {}) as Partial<GameStats>;
    return {lv: Number(x.lv) || 1, best: Number(x.best) || 0};
  });

/** The student's best ever on this phone (games played while the week's board was elsewhere count too). */
export function bestHere(game: GameId) {
  try {
    return Number(localStorage.getItem(`batnab.game.${game}`) || 0);
  } catch {
    return 0;
  }
}
function keepBest(game: GameId, s: number) {
  try {
    if (s > bestHere(game)) localStorage.setItem(`batnab.game.${game}`, String(s));
  } catch {
    // no storage: only the database keeps it
  }
}

/**
 * A finished game: kept as the best on this phone and in the student's stats (with where the next one starts), and on
 * the week's board when it beats (or equals, to bring the name up to date) this week's best, unless they keep their
 * scores off boards. Resolves whether it is the week's new best.
 */
export async function saveScore(game: GameId, s: number, profile: Profile, weekBest: number, next: GameStats) {
  keepBest(game, s);
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const writes: Record<string, unknown> = {[`stats/${uid}/games/${game}`]: {lv: next.lv, best: Math.max(next.best, s)}};
  const onBoard = !profile.prefs?.lbOff && s >= 1 && s >= weekBest;
  if (onBoard) writes[`gameScores/${thisWeek()}/${game}/${uid}`] = {s, at: serverTimestamp(), name: publicName(profile), cls: profile.class ?? null};
  await update(ref(db), writes);
  return onBoard && s > weekBest;
}

export interface Try {
  g: GameId;
  at: number;
  s?: number;
}

/** The student's try at the day's challenge (false: none yet; null while loading). */
export const useTry = (uid: string | undefined, day: number) =>
  useLive(uid ? `gameTries/${uid}/${day}` : null, (v): Try | false => {
    const x = v as Partial<Try> | null;
    return x && typeof x.at === 'number' ? {g: x.g as GameId, at: x.at, s: typeof x.s === 'number' ? x.s : undefined} : false;
  });

/** The day's try begins (the rules let it only once a day). Resolves false when it was taken already. */
export async function startTry(day: number, game: GameId) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  return update(ref(db, `gameTries/${uid}/${day}`), {g: game, at: serverTimestamp()}).then(
    () => true,
    () => false,
  );
}

export interface Streak {
  n: number;
  best: number;
  last?: number;
}

export const useStreak = (uid: string | undefined) =>
  useLive(uid ? `stats/${uid}` : null, (v): Streak => {
    const x = (v ?? {}) as Record<string, unknown>;
    return {n: Number(x.gameStreak) || 0, best: Number(x.gameBestStreak) || 0, last: typeof x.gameLast === 'number' ? x.gameLast : undefined};
  });

/** The streak as it stands today: gone if yesterday was missed. */
export const liveStreak = (s: Streak | null, day = ubDay()) => (s && s.last !== undefined && s.last >= day - 1 ? s.n : 0);

/**
 * The day's try is over: its score, on the day's board (unless the student keeps scores off boards), and the days in
 * a row one more (or one again).
 */
export async function finishTry(day: number, game: GameId, s: number, profile: Profile, streak: Streak | null) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const n = streak?.last === day ? streak.n : streak?.last === day - 1 ? streak.n + 1 : 1;
  const writes: Record<string, unknown> = {
    [`gameTries/${uid}/${day}/s`]: s,
    [`stats/${uid}/gameStreak`]: n,
    [`stats/${uid}/gameBestStreak`]: Math.max(streak?.best ?? 0, n),
    [`stats/${uid}/gameLast`]: day,
  };
  if (!profile.prefs?.lbOff && s >= 1) writes[`gameDaily/${day}/${uid}`] = {s, at: serverTimestamp(), name: publicName(profile), cls: profile.class ?? null, g: game};
  await update(ref(db), writes);
}

/** Off the boards: this week's games and today's challenge (the leaderboard switched off). */
export async function withdrawGames() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await update(ref(db), {...Object.fromEntries(GAMES.map((g) => [`gameScores/${thisWeek()}/${g.id}/${uid}`, null])), [`gameDaily/${ubDay()}/${uid}`]: null});
}

/** The teacher takes a score off a board. */
export const removeScore = (path: string) => update(ref(db), {[path]: null});
