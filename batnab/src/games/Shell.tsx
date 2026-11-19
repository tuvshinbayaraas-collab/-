import {ArrowLeft, Crown, Play, RotateCcw, Timer, Trophy} from 'lucide-react';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useClasses} from '../lib/classes';
import {bestHere, saveScore, useGameBoard, type GameInfo, type Score} from '../lib/games';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {untilReset} from '../lib/week';

/** What a game is given while it is played. */
export interface Play {
  /** Points for a right answer (shown flying up). */
  add: (points: number) => void;
  /** Seconds off the clock for a wrong one. */
  penalty: (seconds: number) => void;
}

type Phase = 'ready' | 'play' | 'done';

/**
 * Around every game: how it is played and the week's best before it starts, the clock and the score while it runs (a
 * wrong answer takes seconds off), and at the end the score, saved to the week's board when it is the student's best
 * this week (the teacher plays without saving). The game itself is `children`, made anew for each go.
 */
export default function GameShell({game, children}: {game: GameInfo; children: (play: Play) => ReactNode}) {
  const session = useSession();
  const uid = session.user?.uid;
  const board = useGameBoard(game.id, !!uid);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [end, setEnd] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [go, setGo] = useState(0);
  const [flash, setFlash] = useState<{text: string; good: boolean; n: number} | null>(null);
  const [result, setResult] = useState<{record: boolean; saved: boolean; error?: string} | null>(null);
  const mine = board?.find((e) => e.uid === uid)?.s ?? 0;
  const left = Math.max(0, end - now);

  const finish = () => {
    setPhase('done');
    const s = scoreRef.current;
    setResult(null);
    if (!session.profile || session.admin) return setResult({record: false, saved: false});
    saveScore(game.id, s, session.profile, mine).then(
      (record) => setResult({record, saved: true}),
      (e) => setResult({record: false, saved: false, error: (e as Error).message}),
    );
  };

  useEffect(() => {
    if (phase !== 'play') return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === 'play' && now >= end) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, end, phase]);

  const start = () => {
    scoreRef.current = 0;
    setScore(0);
    setFlash(null);
    setResult(null);
    const t = Date.now();
    setNow(t);
    setEnd(t + game.seconds * 1000);
    setGo((n) => n + 1);
    setPhase('play');
  };
  const play: Play = {
    add: (points) => {
      scoreRef.current += points;
      setScore(scoreRef.current);
      setFlash({text: `+${points}`, good: true, n: Date.now()});
    },
    penalty: (seconds) => {
      setEnd((e) => e - seconds * 1000);
      setFlash({text: `−${seconds} с`, good: false, n: Date.now()});
    },
  };

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-6" data-game={game.id}>
      <div className="flex items-center gap-2">
        <Link href="/games" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft size={16} /> Тоглоомууд
        </Link>
      </div>

      {phase === 'play' ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-lg font-bold tabular-nums" aria-label="Үлдсэн хугацаа">
              <Timer size={18} className={left < 10_000 ? 'text-red-400' : 'text-neutral-400'} />
              {Math.ceil(left / 1000)}
            </span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-800" aria-hidden>
              <span className={`block h-full rounded-full ${left < 10_000 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${(left / (game.seconds * 1000)) * 100}%`}} />
            </span>
            <span className="relative min-w-16 text-right text-lg font-bold tabular-nums" data-game-score>
              {score}
              {flash && (
                <span key={flash.n} className={`pointer-events-none absolute -top-5 right-0 animate-[pop-in_.5s_ease-out] text-sm font-semibold ${flash.good ? 'text-green-400' : 'text-red-400'}`}>
                  {flash.text}
                </span>
              )}
            </span>
          </div>
          <div className="mt-4" key={go}>
            {children(play)}
          </div>
        </>
      ) : (
        <section className="mt-3 rounded-2xl bg-neutral-900 p-5 text-center">
          <span className="text-5xl" aria-hidden>
            {game.sign}
          </span>
          <h1 className="mt-2 text-2xl font-bold">{game.title}</h1>
          {phase === 'done' ? (
            <>
              <p className="mt-3 text-sm text-neutral-400">Таны оноо</p>
              <p className="text-5xl font-extrabold tabular-nums" data-final-score>
                {score}
              </p>
              <p className="text-sm text-neutral-400">{game.unit}</p>
              {result?.record && (
                <p className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-200">
                  <Crown size={15} /> Долоо хоногийн шинэ рекорд!
                </p>
              )}
              {result?.error && <p className="mt-3 text-sm text-red-400">Оноог хадгалж чадсангүй: {result.error}</p>}
              {session.admin && <p className="mt-3 text-sm text-neutral-400">Багшийн оноо жагсаалтад орохгүй.</p>}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-neutral-400">{game.short}</p>
              <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm text-neutral-300">
                {game.rules.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="text-blue-300" aria-hidden>
                      •
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-4 text-sm text-neutral-400">
            Энэ долоо хоногт: <b className="text-neutral-100">{Math.max(mine, phase === 'done' && result?.saved ? score : 0)}</b>
            {bestHere(game.id) > 0 && ` · Хамгийн өндөр: ${bestHere(game.id)}`}
          </p>
          <button
            type="button"
            onClick={start}
            className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-blue-500 px-7 py-3 text-base font-semibold text-black hover:bg-blue-400"
            autoFocus
          >
            {phase === 'done' ? <RotateCcw size={18} /> : <Play size={18} />} {phase === 'done' ? 'Дахин тоглох' : 'Эхлэх'}
          </button>
        </section>
      )}

      {phase !== 'play' && <Board board={board} me={uid} myClass={session.admin ? undefined : session.profile?.class} />}
    </div>
  );
}

/** The week's best in the game: the student's class, or everyone; the student's own place under it when not near the top. */
function Board({board, me, myClass}: {board: Score[] | null; me?: string; myClass?: string}) {
  const classes = useClasses();
  const [all, setAll] = useState(!myClass);
  const list = (board ?? []).filter((e) => all || e.cls === myClass);
  const top = list.slice(0, 10);
  const mine = list.findIndex((e) => e.uid === me);
  const row = (e: Score, i: number) => (
    <li key={e.uid} className={`flex items-center gap-3 px-4 py-2.5 ${e.uid === me ? 'bg-blue-500/10' : ''}`}>
      <span className={`w-6 text-center font-bold tabular-nums ${i === 0 ? 'text-amber-300' : i < 3 ? 'text-neutral-200' : 'text-neutral-500'}`}>{i + 1}</span>
      <span className="min-w-0 flex-1 truncate">
        {e.name}
        {e.uid === me && <span className="ml-1.5 rounded-full bg-blue-500/20 px-1.5 py-px text-[10px] font-semibold text-blue-200">Та</span>}
        {all && e.cls && <span className="ml-1.5 text-xs text-neutral-500">{classes?.find((c) => c.id === e.cls)?.name}</span>}
      </span>
      <span className="font-semibold tabular-nums">{e.s}</span>
    </li>
  );
  return (
    <section className="mt-4 overflow-hidden rounded-2xl bg-neutral-900" data-game-board>
      <h2 className="flex items-center gap-2 px-4 pt-4 font-semibold">
        <Trophy size={17} className="text-amber-300" /> Энэ долоо хоногийн шилдэг
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-1">
        <p className="text-xs text-neutral-500">Шинэчлэгдэх хүртэл {untilReset()}</p>
        {myClass && (
          <div className="grid grid-cols-2 rounded-full bg-neutral-800/70 p-0.5 text-xs font-medium" role="tablist" aria-label="Хэнийг харах">
            {(
              [
                [false, 'Миний анги'],
                [true, 'Бүгд'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={all === v}
                onClick={() => setAll(v)}
                className={`rounded-full px-3 py-1 ${all === v ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {board === null ? (
        <p className="px-4 py-4 text-sm text-neutral-400">Ачаалж байна…</p>
      ) : top.length ? (
        <ol className="mt-2 divide-y divide-neutral-800">
          {top.map(row)}
          {mine >= 10 && row(list[mine], mine)}
        </ol>
      ) : (
        <p className="px-4 py-4 text-sm text-neutral-400">Энэ долоо хоногт одоогоор хэн ч тоглоогүй байна.</p>
      )}
    </section>
  );
}
