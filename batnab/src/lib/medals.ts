// All of a student's medals in one list, newest first: the tests' (each week, lib/leaderboard) and the games' (every
// 14 days, lib/games), each with what was given and what is due but not given yet.
import {gameOf, useGameMedals} from './games';
import {medalEnd, useMedals as useTestMedals, type Medal} from './leaderboard';

/**
 * The medals of `uid`: the tests' while `tests` (the leaderboard on, for someone else's), the games' while `games` (the
 * games on). Null while loading.
 */
export function useMedals(uid: string | undefined, tests: boolean, games = tests): Medal[] | null {
  const fromTests = useTestMedals(uid, tests);
  const fromGames = useGameMedals(uid, games);
  if (!uid || (tests && !fromTests) || !fromGames) return uid ? null : [];
  const all: Medal[] = [
    ...(tests ? fromTests! : []),
    ...fromGames.map((m): Medal => ({key: m.key, week: m.round, place: m.place, test: '', score: m.score, total: 0, game: m.game})),
  ];
  return all.sort((a, b) => medalEnd(b) - medalEnd(a) || Number(!!b.top) - Number(!!a.top) || a.place - b.place || a.key.localeCompare(b.key));
}

/** What a medal was for, in a few words: «Тест 3.А · 22/30», «Хурдан тооцоо · 186 оноо», «80 оноо · 3 тест». */
export function medalFor(m: Medal, testTitle: (id: string) => string) {
  if (m.game) return `${gameOf(m.game)?.title ?? m.game} · ${m.score} оноо`;
  if (m.top) return `${m.score} оноо · ${m.tests ?? 1} тест`;
  return `${testTitle(m.test)} · ${m.score}/${m.total}`;
}

/** The kind of a medal, for the medal case's filter. */
export type MedalKind = 'test' | 'order' | 'game';
export const kindOf = (m: Medal): MedalKind => (m.game ? 'game' : m.top ? 'order' : 'test');
