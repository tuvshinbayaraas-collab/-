import {CalendarDays, ChevronRight, Flame, Gamepad2, Medal} from 'lucide-react';
import Loading from '../components/Loading';
import {CenterNote, InactiveNote, LockedNote} from '../components/Notices';
import {classTotals, dailyGame, GAMES, liveStreak, ubDay, untilMedals, useDailyBoard, useGameBoard, useStreak, useTry, type GameInfo} from '../lib/games';
import {useClasses} from '../lib/classes';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';

/** /games — «Тоглоом»: the day's challenge, the medals every 14 days, then the five games, each with the student's best this round and who leads. */
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
        <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Сурагчдад хаалттай байна. Багшийн самбарын Тохиргоо хэсгээс нээнэ.</p>
      )}
      <Daily />
      <p className="mt-3 flex items-start gap-2 text-sm text-neutral-300" data-medal-info>
        <Medal size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
        <span>
          Тоглоом бүрийн эхний гурав 14 хоног тутам медаль авна. Медаль олгоход <b className="whitespace-nowrap text-neutral-100">{untilMedals()}</b> үлдлээ.
        </span>
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Tile key={g.id} game={g} />
        ))}
      </ul>
    </div>
  );
}

/** The day's challenge: today's game, the student's days in a row, and how today went if it's done. */
function Daily() {
  const session = useSession();
  const uid = session.user?.uid;
  const student = !!session.profile && !session.admin;
  const day = ubDay();
  const game = dailyGame(day);
  const tried = useTry(student ? uid : undefined, day);
  const streak = useStreak(student ? uid : undefined);
  const board = useDailyBoard(day, game.id);
  const place = board ? board.findIndex((e) => e.uid === uid) + 1 : 0;
  const days = liveStreak(streak, day);
  return (
    <Link
      href="/games/daily"
      className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-transparent p-4 hover:brightness-110"
      data-daily-card
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-3xl" aria-hidden>
        {game.sign}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <CalendarDays size={13} /> Өнөөдрийн сорил
        </span>
        <span className="block text-lg font-bold text-neutral-50">{game.title}</span>
        <span className="block text-sm text-neutral-300">
          {tried && tried.s !== undefined
            ? `Таны оноо: ${tried.s}${place ? ` · ${place}-р байр` : ''}`
            : tried
              ? 'Өнөөдрийн оролдлогоо хийсэн'
              : 'Өнөөдөр бүгдэд ижил бодлого гарна. Нэг л оролдлого тоологдоно.'}
        </span>
      </span>
      {days > 0 && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-sm font-bold text-orange-300" title="Өдөр дараалан" data-streak>
          <Flame size={15} /> {days}
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-neutral-400" />
    </Link>
  );
}

function Tile({game}: {game: GameInfo}) {
  const session = useSession();
  const classes = useClasses();
  const board = useGameBoard(game.id);
  const myClass = session.profile?.class;
  const mine = board?.find((e) => e.uid === session.user?.uid)?.s;
  const lead = board?.find((e) => !myClass || session.admin || e.cls === myClass);
  const topClass = board ? classTotals(board)[0] : undefined;
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
            {mine ? `Энэ 14 хоногт: ${mine} · ` : ''}
            {lead ? `${session.admin || !myClass ? 'Тэргүүлж буй' : 'Ангидаа тэргүүлж буй'}: ${lead.name} (${lead.s})` : 'Энэ 14 хоногт тоглосон хүн алга'}
          </span>
          {topClass && <span className="block text-xs text-neutral-400">Тэргүүлж буй анги: {classes?.find((c) => c.id === topClass.cls)?.name ?? '…'}</span>}
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
