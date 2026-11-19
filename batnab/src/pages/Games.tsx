import {ChevronRight, Gamepad2} from 'lucide-react';
import Loading from '../components/Loading';
import {CenterNote, InactiveNote, LockedNote} from '../components/Notices';
import {GAMES, useGameBoard, type GameInfo} from '../lib/games';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';

/** /games — «Тоглоом»: the four math games, each with the student's best this week and who leads their class. */
export default function Games() {
  const session = useSession();
  const settings = useSettings();
  const allowed = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  if (session.ready && !session.user) return <LockedNote text="Тоглоом тоглохын тулд нэвтэрнэ үү." />;
  if (session.ready && !allowed) return <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!allowed || !settings) return <Loading />;
  if (!settings.games && !session.admin) return <GamesClosed />;

  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-6">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
          <Gamepad2 size={18} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Тоглоом</h1>
          <p className="text-sm text-neutral-400">Хэдхэн минутын математик тоглоом</p>
        </div>
      </header>
      {session.admin && !settings.games && (
        <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Сурагчдад хаалттай байна. Багшийн самбарын Тохиргоо хэсгээс нээнэ.
        </p>
      )}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Tile key={g.id} game={g} />
        ))}
      </ul>
    </div>
  );
}

function Tile({game}: {game: GameInfo}) {
  const session = useSession();
  const board = useGameBoard(game.id);
  const myClass = session.profile?.class;
  const mine = board?.find((e) => e.uid === session.user?.uid)?.s;
  const lead = board?.find((e) => !myClass || session.admin || e.cls === myClass);
  return (
    <li>
      <Link href={`/games/${game.id}`} className={`flex h-full items-center gap-3 rounded-2xl bg-gradient-to-br p-4 hover:brightness-110 ${game.tone}`} data-game-tile={game.id}>
        <span className="text-4xl" aria-hidden>
          {game.sign}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-neutral-50">{game.title}</span>
          <span className="block text-sm text-neutral-300">{game.short}</span>
          <span className="mt-1 block text-xs text-neutral-300">
            {mine ? `Таны рекорд: ${mine} · ` : ''}
            {lead ? `${session.admin || !myClass ? 'Тэргүүлж буй' : 'Ангидаа тэргүүлж буй'}: ${lead.name} (${lead.s})` : 'Энэ долоо хоногт тоглосон хүн алга'}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-neutral-400" />
      </Link>
    </li>
  );
}

export function GamesClosed() {
  return (
    <CenterNote icon={<Gamepad2 size={28} />} title="Тоглоом түр хаалттай">
      <p className="text-sm text-neutral-400">Багш нээхээр тоглож болно.</p>
      <Link href="/" className="mt-3 inline-block text-blue-400 hover:underline">
        Нүүр хуудас руу
      </Link>
    </CenterNote>
  );
}
