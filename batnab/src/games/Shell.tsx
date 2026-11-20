import {ArrowLeft, CalendarCheck, Crown, Flame, Loader2, Play as PlayIcon, RotateCcw, Timer, Trash2, Trophy, Volume2, VolumeX} from 'lucide-react';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import MathText from '../components/MathText';
import {useClasses} from '../lib/classes';
import {
  bestHere,
  classTotals,
  dailyRng,
  finishTry,
  liveStreak,
  removeScore,
  saveScore,
  startTry,
  thisRound,
  useDailyBoard,
  useGameBoard,
  useGameStats,
  useStreak,
  useTry,
  untilMedals,
  type GameInfo,
  type Score,
} from '../lib/games';
import type {Rng} from '../lib/rand';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {setSoundOn, sfx, soundOn, unlock} from '../lib/sfx';

/** A slip, for the review at the end. */
export interface Miss {
  /** The problem, as text or with $…$ (MathText). */
  q: string;
  /** What was answered, if anything. */
  your?: string;
  /** The right answer. */
  right: string;
  /** The quick way, or the rule it breaks. */
  why?: string;
  /** A picture to go with it (the graph). */
  fig?: ReactNode;
}

/** What a game is given while it is played. */
export interface Play {
  /** Points for a right answer (shown flying up). */
  add: (points: number) => void;
  /** Seconds off the clock for a wrong one. */
  penalty: (seconds: number) => void;
  /** A slip, for the review. */
  miss: (m: Miss) => void;
  /** The day's challenge: the source of the i-th problem, the same for everyone (and levels go by count, not ladder). */
  rngAt?: (i: number) => Rng;
  /** Where the game's ladder starts (games/adapt). */
  start: number;
  /** The highest level reached so far: the next game starts a level below it. */
  reached: (level: number) => void;
  /** Called as the time runs out (24: the four on the table go into the review with a way). */
  onEnd: (f: () => void) => void;
}

type Phase = 'ready' | 'prep' | 'count' | 'play' | 'done';

/**
 * Around every game: how it is played and the bests before it starts, a 3-2-1, the clock and the score while it runs
 * (a wrong answer takes seconds off), and at the end the score with the slips and their right answers, saved as the
 * student's best this week (on the class board unless they keep scores off boards) or, in the day's challenge (`day`),
 * as the day's one try. The teacher plays without saving. The game itself is `children`, made anew for each go.
 */
export default function GameShell({game, day, children}: {game: GameInfo; day?: number; children: (play: Play) => ReactNode}) {
  const session = useSession();
  const uid = session.user?.uid;
  const admin = session.admin;
  const daily = day !== undefined;
  const student = !!session.profile && !admin;
  const stats = useGameStats(student ? uid : undefined, game.id);
  const weekBoard = useGameBoard(game.id, !!uid && !daily);
  const dayBoard = useDailyBoard(day ?? 0, game.id, !!uid && daily);
  const board = daily ? dayBoard : weekBoard;
  const tried = useTry(daily && student ? uid : undefined, day ?? 0);
  const streak = useStreak(daily && student ? uid : undefined);
  const lbOff = !!session.profile?.prefs?.lbOff;

  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(3);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [end, setEnd] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [go, setGo] = useState(0);
  const [flash, setFlash] = useState<{text: string; good: boolean; n: number} | null>(null);
  const [result, setResult] = useState<{saved: boolean; record?: boolean; error?: string} | null>(null);
  const [counted, setCounted] = useState(false);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [beat, setBeat] = useState(false);
  const [sound, setSound] = useState(soundOn);
  const missesRef = useRef<Miss[]>([]);
  const endHooks = useRef<(() => void)[]>([]);
  const topRef = useRef(1);
  const bestRef = useRef(0);
  const beatRef = useRef(false);

  const mine = board?.find((e) => e.uid === uid)?.s ?? 0;
  const best = Math.max(stats?.best ?? 0, bestHere(game.id));
  const startLevel = daily ? 1 : (stats?.lv ?? 1);
  const left = Math.max(0, end - now);
  // A student's numbers come before the start: where the ladder begins, whether today's try is taken.
  const loading = student && (stats === null || (daily && (tried === null || streak === null)));
  const counts = daily && student && tried === false;

  const finish = () => {
    for (const f of endHooks.current) f();
    setMisses([...missesRef.current]);
    setPhase('done');
    sfx.end();
    const s = scoreRef.current;
    setResult(null);
    if (!session.profile || admin) return setResult({saved: false});
    if (daily) {
      if (!counted) return setResult({saved: false});
      return void finishTry(day!, game.id, s, session.profile, streak).then(
        () => setResult({saved: true}),
        (e) => setResult({saved: false, error: (e as Error).message}),
      );
    }
    saveScore(game.id, s, session.profile, mine, {lv: Math.max(1, topRef.current - 1), best}).then(
      (record) => setResult({saved: true, record}),
      (e) => setResult({saved: false, error: (e as Error).message}),
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
  // 3, 2, 1: then the clock starts.
  useEffect(() => {
    if (phase !== 'count') return;
    const t = setTimeout(() => {
      if (count > 1) {
        setCount(count - 1);
        sfx.tick();
        return;
      }
      sfx.go();
      const t0 = Date.now();
      setNow(t0);
      setEnd(t0 + game.seconds * 1000);
      setGo((n) => n + 1);
      setPhase('play');
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, count, game.seconds]);

  const start = async () => {
    unlock();
    scoreRef.current = 0;
    setScore(0);
    setFlash(null);
    setResult(null);
    setBeat(false);
    beatRef.current = false;
    missesRef.current = [];
    endHooks.current = [];
    topRef.current = startLevel;
    bestRef.current = best;
    let yes = false;
    if (counts) {
      setPhase('prep');
      yes = await Promise.race([startTry(day!, game.id), new Promise<boolean>((r) => setTimeout(() => r(false), 8000))]);
    }
    setCounted(yes);
    setCount(3);
    setPhase('count');
    sfx.tick();
  };

  const play: Play = {
    add: (points) => {
      scoreRef.current += points;
      setScore(scoreRef.current);
      setFlash({text: `+${points}`, good: true, n: Date.now()});
      if (!daily && bestRef.current > 0 && scoreRef.current > bestRef.current && !beatRef.current) {
        beatRef.current = true;
        setBeat(true);
        sfx.record();
      } else sfx.right();
    },
    penalty: (seconds) => {
      setEnd((e) => e - seconds * 1000);
      setFlash({text: `−${seconds} с`, good: false, n: Date.now()});
      sfx.wrong();
    },
    miss: (m) => {
      if (missesRef.current.length < 40) missesRef.current.push(m);
    },
    rngAt: daily ? dailyRng(day!, game.id) : undefined,
    start: startLevel,
    reached: (level) => {
      topRef.current = Math.max(topRef.current, level);
    },
    onEnd: (f) => {
      endHooks.current.push(f);
    },
  };
  const toggleSound = () => {
    setSoundOn(!sound);
    setSound(!sound);
    if (!sound) unlock();
  };
  const personal = phase === 'done' && !daily && student && score > bestRef.current && bestRef.current > 0;
  const shownBest = Math.max(best, phase === 'done' && student && !daily ? score : 0);

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-6" data-game={game.id}>
      <div className="flex items-center gap-2">
        <Link href="/games" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft size={16} /> Тоглоомууд
        </Link>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label="Дуу, чичиргээ"
          title={sound ? 'Дуу, чичиргээг унтраах' : 'Дуу, чичиргээг асаах'}
          className="ml-auto rounded-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
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
                <span key={flash.n} className={`pointer-events-none absolute -top-5 right-0 animate-[pop-in_.5s_ease-out] text-sm font-semibold ${flash.good ? 'text-green-300' : 'text-red-300'}`}>
                  {flash.text}
                </span>
              )}
            </span>
          </div>
          {!daily && bestRef.current > 0 && (
            <p className={`mt-1 text-right text-xs ${beat ? 'font-semibold text-amber-300' : 'text-neutral-500'}`} data-goal>
              {beat ? 'Рекордоо эвдлээ!' : `Рекорд: ${bestRef.current}`}
            </p>
          )}
          <div className="mt-4" key={go}>
            {children(play)}
          </div>
        </>
      ) : phase === 'count' || phase === 'prep' ? (
        <section className="mt-3 flex h-64 flex-col items-center justify-center rounded-2xl bg-neutral-900" aria-live="assertive" data-countdown>
          <p className="text-sm text-neutral-400">{game.title}</p>
          {phase === 'prep' ? (
            <p className="mt-3 flex items-center gap-2 text-neutral-300">
              <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> Бэлдэж байна…
            </p>
          ) : (
            <p key={count} className="text-8xl font-extrabold tabular-nums motion-safe:animate-[pop-in_.4s_ease-out]">
              {count}
            </p>
          )}
        </section>
      ) : (
        <section className="mt-3 rounded-2xl bg-neutral-900 p-5 text-center">
          <span className="text-5xl" aria-hidden>
            {game.sign}
          </span>
          {daily && <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-amber-300">Өнөөдрийн сорил</p>}
          <h1 className="mt-1 text-2xl font-bold">{game.title}</h1>
          {phase === 'done' ? (
            <>
              <p className="mt-3 text-sm text-neutral-400">Таны оноо</p>
              <p className="text-5xl font-extrabold tabular-nums" data-final-score>
                {score}
              </p>
              {(personal || result?.record) && (
                <p className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-200" data-record>
                  <Crown size={15} /> {personal ? 'Хувийн шинэ рекорд!' : '14 хоногийн шинэ рекорд!'}
                </p>
              )}
              {daily && student && (
                <p className="mt-3 text-sm text-neutral-300" data-daily-note>
                  {counted ? (
                    <>
                      Өнөөдрийн оролдлого тоологдлоо.{' '}
                      {result?.saved && (
                        <span className="inline-flex items-center gap-1 font-semibold text-orange-300">
                          <Flame size={14} /> {liveStreak(streak, day) || 1} өдөр дараалан
                        </span>
                      )}
                    </>
                  ) : (
                    'Энэ удаагийнх дасгал байсан тул тоологдохгүй.'
                  )}
                </p>
              )}
              {student && lbOff && (!daily || counted) && (
                <p className="mt-3 text-sm text-neutral-400">
                  Та оноогоо жагсаалтад харуулахгүй гэж{' '}
                  <Link href="/settings" className="text-blue-400 hover:underline">
                    тохируулсан
                  </Link>
                  .
                </p>
              )}
              {result?.error && <p className="mt-3 text-sm text-red-400">Оноог хадгалж чадсангүй: {result.error}</p>}
              {admin && <p className="mt-3 text-sm text-neutral-400">Багшийн оноо жагсаалтад орохгүй.</p>}
              {!misses.length && score > 0 && <p className="mt-3 text-sm text-green-300">Нэг ч алдаагүй!</p>}
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
                {daily && (
                  <li className="flex gap-2">
                    <span className="text-amber-300" aria-hidden>
                      •
                    </span>
                    Өнөөдөр бүх хүнд ижил бодлогууд гарна. Зөвхөн эхний оролдлого тоологдоно.
                  </li>
                )}
              </ul>
            </>
          )}
          {daily ? (
            student &&
            tried &&
            phase === 'ready' && (
              <p className="mt-4 text-sm text-neutral-400" data-tried>
                <CalendarCheck size={14} className="-mt-0.5 mr-1 inline text-green-400" />
                {tried.s !== undefined ? `Өнөөдөр ${tried.s} оноо авсан.` : 'Өнөөдрийн оролдлогоо эхлүүлсэн.'} Дахин тоглож болно, тоологдохгүй.
              </p>
            )
          ) : (
            <p className="mt-4 text-sm text-neutral-400">
              Энэ 14 хоногт: <b className="text-neutral-100">{Math.max(mine, phase === 'done' && result?.saved && !lbOff ? score : 0)}</b>
              {shownBest > 0 && ` · Рекорд: ${shownBest}`}
            </p>
          )}
          <button
            type="button"
            onClick={() => void start()}
            disabled={loading}
            className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-blue-500 px-7 py-3 text-base font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
            autoFocus
          >
            {phase === 'done' ? <RotateCcw size={18} /> : <PlayIcon size={18} />} {phase === 'done' ? 'Дахин тоглох' : counts ? 'Эхлэх' : daily && student ? 'Дасгал хийх' : 'Эхлэх'}
          </button>
        </section>
      )}

      {phase === 'done' && <Review items={misses} />}
      {(phase === 'ready' || phase === 'done') && (
        <Board
          board={board}
          me={uid}
          myClass={admin ? undefined : session.profile?.class}
          title={daily ? 'Өнөөдрийн шилдэг' : 'Энэ 14 хоногийн шилдэг'}
          note={daily ? 'Маргааш шинэ сорил гарна' : `Эхний гурав медаль авна. Медаль олгоход ${untilMedals()} үлдлээ`}
          remove={admin ? (e) => removeScore(daily ? `gameDaily/${day}/${e.uid}` : `gameScores/${thisRound()}/${game.id}/${e.uid}`) : undefined}
        />
      )}
    </div>
  );
}

/** The slips of the game just played, each with its right answer and how to get there. */
function Review({items}: {items: Miss[]}) {
  if (!items.length) return null;
  return (
    <details className="mt-4 rounded-2xl bg-neutral-900 p-4" open={items.length <= 6} data-review>
      <summary className="cursor-pointer font-semibold">Алдсан бодлогууд ({items.length})</summary>
      <ul className="mt-3 space-y-2.5">
        {items.map((m, i) => (
          <li key={i} className="rounded-xl bg-neutral-800/60 p-3">
            <div className="text-base">
              <MathText text={m.q} />
            </div>
            {m.fig && <div className="mt-2 flex justify-center text-neutral-200">{m.fig}</div>}
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              {m.your !== undefined && (
                <span className="text-red-300">
                  Таны хариу: <MathText text={m.your} />
                </span>
              )}
              <span className="text-green-300">
                Зөв нь: <MathText text={m.right} />
              </span>
            </p>
            {m.why && (
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                <MathText text={m.why} />
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

type View = 'class' | 'all' | 'classes';

/**
 * The best in the game: the student's class, everyone, or the classes by their ten best; the student's own place under
 * the list when not near the top. The teacher can take a score off.
 */
function Board({board, me, myClass, title, note, remove}: {board: Score[] | null; me?: string; myClass?: string; title: string; note: string; remove?: (e: Score) => Promise<unknown>}) {
  const classes = useClasses();
  const [view, setView] = useState<View>(myClass ? 'class' : 'all');
  const [busy, setBusy] = useState<string | null>(null);
  const list = (board ?? []).filter((e) => view !== 'class' || e.cls === myClass);
  const top = list.slice(0, 10);
  const mine = list.findIndex((e) => e.uid === me);
  const className = (id?: string) => classes?.find((c) => c.id === id)?.name ?? '';
  const tabs: [View, string][] = [...(myClass ? ([['class', 'Миний анги']] as [View, string][]) : []), ['all', 'Бүгд'], ['classes', 'Ангиуд']];
  const row = (e: Score, i: number) => (
    <li key={e.uid} className={`flex items-center gap-3 px-4 py-2.5 ${e.uid === me ? 'bg-blue-500/10' : ''}`}>
      <span className={`w-6 text-center font-bold tabular-nums ${i === 0 ? 'text-amber-300' : i < 3 ? 'text-neutral-200' : 'text-neutral-500'}`}>{i + 1}</span>
      <span className="min-w-0 flex-1 truncate">
        {e.name}
        {e.uid === me && <span className="ml-1.5 rounded-full bg-blue-500/20 px-1.5 py-px text-[10px] font-semibold text-blue-200">Та</span>}
        {view === 'all' && e.cls && <span className="ml-1.5 text-xs text-neutral-500">{className(e.cls)}</span>}
      </span>
      <span className="font-semibold tabular-nums">{e.s}</span>
      {remove && (
        <button
          type="button"
          disabled={busy === e.uid}
          onClick={() => {
            if (!confirm(`${e.name}-ийн оноог жагсаалтаас устгах уу?`)) return;
            setBusy(e.uid);
            remove(e)
              .catch((err) => alert((err as Error).message))
              .finally(() => setBusy(null));
          }}
          aria-label={`${e.name}-ийн оноог устгах`}
          className="-mr-1 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
        >
          <Trash2 size={15} />
        </button>
      )}
    </li>
  );
  const totals = view === 'classes' ? classTotals(board ?? []) : [];
  return (
    <section className="mt-4 overflow-hidden rounded-2xl bg-neutral-900" data-game-board>
      <h2 className="flex items-center gap-2 px-4 pt-4 font-semibold">
        <Trophy size={17} className="text-amber-300" /> {title}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-1">
        <p className="text-xs text-neutral-500">{note}</p>
        <div className={`grid rounded-full bg-neutral-800/70 p-0.5 text-xs font-medium ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} role="tablist" aria-label="Хэнийг харах">
          {tabs.map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 ${view === v ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {board === null ? (
        <p className="px-4 py-4 text-sm text-neutral-400">Ачаалж байна…</p>
      ) : view === 'classes' ? (
        totals.length ? (
          <>
            <ol className="mt-2 divide-y divide-neutral-800" data-class-board>
              {totals.map((c, i) => (
                <li key={c.cls} className={`flex items-center gap-3 px-4 py-2.5 ${c.cls === myClass ? 'bg-blue-500/10' : ''}`}>
                  <span className={`w-6 text-center font-bold tabular-nums ${i === 0 ? 'text-amber-300' : 'text-neutral-500'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {className(c.cls) || 'Анги'}
                    <span className="ml-1.5 text-xs text-neutral-500">{c.players} хүн</span>
                  </span>
                  <span className="font-semibold tabular-nums">{c.total}</span>
                </li>
              ))}
            </ol>
            <p className="px-4 pb-3 pt-1 text-xs text-neutral-500">Анги бүрийн шилдэг 10 хүний оноог нэмж тооцно.</p>
          </>
        ) : (
          <p className="px-4 py-4 text-sm text-neutral-400">Одоогоор тоглосон анги алга байна.</p>
        )
      ) : top.length ? (
        <ol className="mt-2 divide-y divide-neutral-800">
          {top.map(row)}
          {mine >= 10 && row(list[mine], mine)}
        </ol>
      ) : (
        <p className="px-4 py-4 text-sm text-neutral-400">Одоогоор хэн ч тоглоогүй байна.</p>
      )}
    </section>
  );
}
