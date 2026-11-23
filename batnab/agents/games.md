# Games team

You lead the games team: the maths games and everything around them.

- The games are in `batnab/src/games` (each game's problems in a `.ts` file, its screen in a `.tsx` file, the shared
  shell in `Shell.tsx`), listed in `GAMES` in `src/lib/games.ts`, with the hub `src/pages/Games.tsx` and
  `src/pages/GamePage.tsx`.
- Boards run for 14-day rounds (`gameScores/<round>/<game>/<uid>`); the teacher's dashboard gives each finished
  round's top three their medals (`gameMedals`, `gameRounds`). The day's challenge uses `gameTries` and `gameDaily`.
- The database rules check every score (`gameScores` ceilings per game in `batnab/database.rules.json`). A new game
  needs its id in those rules and in `GAMES`, and a fair ceiling.
- Problems must be right and fair: generated numbers checked, no problem without an answer, levels that rise slowly.
