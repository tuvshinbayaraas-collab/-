import {lazy, Suspense, useEffect} from 'react';
import Loading from '../components/Loading';
import {CenterNote, InactiveNote, LockedNote} from '../components/Notices';
import GameShell from '../games/Shell';
import {gameOf, type GameId} from '../lib/games';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {GamesClosed} from './Games';

const LOAD = {
  sprint: () => import('../games/Sprint'),
  g24: () => import('../games/Make24'),
  graph: () => import('../games/GraphGuess'),
  tf: () => import('../games/TrueFalse'),
} satisfies Record<GameId, unknown>;
const GAME = {sprint: lazy(LOAD.sprint), g24: lazy(LOAD.g24), graph: lazy(LOAD.graph), tf: lazy(LOAD.tf)};

/** /games/{id}: one of the games (src/games), in its shell (the clock, the score, the week's board). */
export default function GamePage({id}: {id: string}) {
  const session = useSession();
  const settings = useSettings();
  const game = gameOf(id);
  // The game's code comes down while its rules are read, so the clock doesn't run while it loads.
  useEffect(() => {
    if (game) LOAD[game.id]().catch(() => {});
  }, [game]);
  const allowed = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  if (session.ready && !session.user) return <LockedNote text="Тоглоом тоглохын тулд нэвтэрнэ үү." />;
  if (session.ready && !allowed) return <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!game)
    return (
      <CenterNote title="Ийм тоглоом алга">
        <Link href="/games" className="text-blue-400 hover:underline">
          Тоглоомууд
        </Link>
      </CenterNote>
    );
  if (!allowed || !settings) return <Loading />;
  if (!settings.games && !session.admin) return <GamesClosed />;
  const Game = GAME[game.id];
  return (
    <GameShell game={game}>
      {(play) => (
        <Suspense fallback={<Loading small />}>
          <Game play={play} />
        </Suspense>
      )}
    </GameShell>
  );
}
