// The math games (src/games): a minute or so of play, and the week's best in the class. A student's best this week is
// gameScores/{week}/{game}/{uid} = {s, at, name, cls}; the rules take it only for the current week (the same Saturday
// reset as the leaderboard, lib/week), only higher than (or as high as) before, within each game's ceiling, with the
// name the leaderboard shows (nickname or @login) and the student's class.
import {ref, serverTimestamp, update} from 'firebase/database';
import {auth, db} from './firebase';
import {publicName} from './leaderboard';
import {useLive} from './live';
import type {Profile} from './session';
import {serverNow} from './time';
import {weekStart} from './week';

export type GameId = 'sprint' | 'g24' | 'graph' | 'tf';

export interface GameInfo {
  id: GameId;
  title: string;
  /** One line on the hub. */
  short: string;
  /** How it is played, before the start. */
  rules: string[];
  /** Seconds of play. */
  seconds: number;
  /** What the score counts. */
  unit: string;
  /** Tailwind classes for its tile. */
  tone: string;
  sign: string;
}

export const GAMES: GameInfo[] = [
  {
    id: 'sprint',
    title: 'Хурдан тооцоо',
    short: 'Нэг минутад аль болох олныг бод',
    rules: ['Хариугаа бичээд OK дарна.', 'Зөв бодох тусам бодлого хүндэрч, оноо нь өснө.', 'Алдвал 3 секунд хасагдана.'],
    seconds: 60,
    unit: 'оноо',
    tone: 'from-blue-600/30 to-cyan-500/10 text-cyan-200',
    sign: '⚡',
  },
  {
    id: 'g24',
    title: '24 тоглоом',
    short: 'Дөрвөн тооноос 24 гарга',
    rules: ['Тоо, үйлдэл, дараа нь нөгөө тоогоо дарна. Хоёр тоо нийлээд нэг болно.', 'Эцэст нь 24 үлдвэл оноо авна.', 'Хугацаа 3 минут. Алгасвал 10 секунд хасагдана.'],
    seconds: 180,
    unit: 'оньсого',
    tone: 'from-amber-600/30 to-orange-500/10 text-amber-200',
    sign: '🃏',
  },
  {
    id: 'graph',
    title: 'График таах',
    short: 'Графикаар нь тэгшитгэлийг ол',
    rules: ['Дөрвөн тэгшитгэлээс графикт таарахыг нь сонгоно. Шулуун, парабол, модультай функц гарна.', 'Хугацаа 90 секунд. Алдвал 5 секунд хасагдана.'],
    seconds: 90,
    unit: 'зөв',
    tone: 'from-violet-600/30 to-fuchsia-500/10 text-violet-200',
    sign: '📈',
  },
  {
    id: 'tf',
    title: 'Зөв үү, буруу юу?',
    short: 'Тэгшитгэл зөв үү гэдгийг хурдан хэл',
    rules: ['Тэгшитгэл зөв бол «Зөв», буруу бол «Буруу» дарна.', 'Дараалан олон зөв хариулбал оноо нь хэд дахин өснө.', 'Хугацаа 60 секунд. Алдвал 2 секунд хасагдана.'],
    seconds: 60,
    unit: 'оноо',
    tone: 'from-emerald-600/30 to-teal-500/10 text-emerald-200',
    sign: '✅',
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

/** This week's scores in a game, best first (null while loading). */
export const useGameBoard = (game: GameId, on = true) =>
  useLive(on ? `gameScores/${thisWeek()}/${game}` : null, (v) =>
    Object.entries((v ?? {}) as Record<string, Partial<Score>>)
      .flatMap(([uid, x]) => (typeof x?.s === 'number' && x.s > 0 ? [{uid, s: x.s, at: Number(x.at) || 0, name: String(x.name ?? ''), cls: typeof x.cls === 'string' ? x.cls : undefined}] : []))
      .sort((a, b) => b.s - a.s || a.at - b.at),
  );

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
    // no storage: only the week's board keeps it
  }
}

/**
 * A finished game: kept as the best on this phone, and on the week's board when it beats (or equals, to bring the name
 * up to date) this week's best. Resolves whether it is the week's new best.
 */
export async function saveScore(game: GameId, s: number, profile: Profile, weekBest: number) {
  keepBest(game, s);
  const uid = auth.currentUser?.uid;
  if (!uid || s < 1 || s < weekBest) return false;
  await update(ref(db, `gameScores/${thisWeek()}/${game}/${uid}`), {s, at: serverTimestamp(), name: publicName(profile), cls: profile.class ?? null});
  return s > weekBest;
}
