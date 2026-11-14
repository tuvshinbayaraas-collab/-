import {Check, Crown, Play, Timer, Trophy, Users, X, Zap} from 'lucide-react';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {CenterNote, InactiveNote, LockedNote} from '../components/Notices';
import MathText from '../components/MathText';
import {Rich} from '../components/TopicParts';
import ZoomView from '../components/ZoomView';
import {useClasses} from '../lib/classes';
import {publicName} from '../lib/leaderboard';
import {forClass, useLive} from '../lib/live';
import {
  answerLive,
  closeLive,
  finishLive,
  joinLive,
  LIVE_COLORS,
  liveOn,
  openQuestion,
  quizzable,
  makeTeams,
  ranking,
  revealQuestion,
  setTeams,
  TEAM_COLORS,
  teamRanking,
  teamsFor,
  secondsLeft,
  startLive,
  useLiveAnswers,
  useLivePlayers,
  useLiveQuestion,
  useLiveQuizState,
  useLiveScores,
  useMyLiveAnswer,
  type LiveQuestion,
  type LiveQuiz,
} from '../lib/liveQuiz';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {useNow} from '../lib/time';
import {LETTER_CODES, LETTER_LABELS, normalize, problemNo, useTopics, type Letter} from '../lib/topics';
import Loading from '../components/Loading';

/** /live: the teacher runs the quiz (on the board), a student plays it on their phone. */
export default function Live() {
  const session = useSession();
  if (!session.ready) return <Loading />;
  if (!session.user) return <LockedNote text="Шууд тэмцээнд оролцохын тулд нэвтэрнэ үү." />;
  if (session.admin) return <Host />;
  if (!session.profile || session.profile.disabled) return <InactiveNote blocked={!!session.profile?.disabled} />;
  return <Player uid={session.user.uid} name={publicName(session.profile)} classId={session.profile.class} />;
}

const DURS = [20, 30, 45, 60, 90, 120, 180, 300];
const label = (l: string) => LETTER_LABELS[l as Letter] ?? l;

/** The question as on the board or the phone: its text and picture (a tap shows the picture full size). */
function Question({q, big}: {q: LiveQuestion; big?: boolean}) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="space-y-3">
      {q.text && <Rich text={q.text} className={big ? 'text-2xl sm:text-3xl' : 'text-lg'} />}
      {q.img && (
        <>
          <button type="button" onClick={() => setZoom(true)} className="block w-full overflow-hidden rounded-xl bg-white" aria-label="Зургийг томоор харах">
            <img src={q.img} alt="" className={`mx-auto w-auto max-w-full object-contain ${big ? 'max-h-[50vh]' : 'max-h-72'}`} />
          </button>
          {zoom && <ZoomView url={q.img} onClose={() => setZoom(false)} />}
        </>
      )}
    </div>
  );
}

const Countdown = ({left, dur, big}: {left: number; dur: number; big?: boolean}) => (
  <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-bold tabular-nums ${left <= 5 ? 'bg-red-500/20 text-red-300' : 'bg-neutral-800 text-neutral-100'} ${big ? 'text-2xl' : 'text-base'}`} aria-label={`${left} секунд үлдсэн`}>
    <Timer size={big ? 22 : 16} /> {left}
    <span className="sr-only"> / {dur}</span>
  </span>
);

// ---- the teacher ----

function Host() {
  const state = useLiveQuizState();
  const quiz = state?.q ?? null;
  if (!state) return <Loading />;
  if (!quiz) return <Setup />;
  return <Board quiz={quiz} />;
}

/** Picking the topic, its problems and the time for each, then opening the quiz for the students to join. */
function Setup() {
  const topics = useTopics();
  const classes = useClasses();
  const [tid, setTid] = useState(() => new URLSearchParams(location.search).get('topic') ?? '');
  const [off, setOff] = useState<Set<string>>(new Set());
  const [dur, setDur] = useState(60);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // Teams: none, so many of even size, or one per class.
  const [teamBy, setTeamBy] = useState<'none' | 'count' | 'class'>('none');
  const [teamCount, setTeamCount] = useState(2);
  // By class only while there are classes to make teams of (not one class alone).
  const byClass = (classes?.length ?? 0) > 1 && chosen.size !== 1;
  const teamMode = teamBy === 'class' && !byClass ? 'none' : teamBy;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!topics) return <Loading />;
  const usable = topics.filter((t) => quizzable(t).length > 0);
  const t = usable.find((x) => x.id === tid) ?? null;
  const problems = t ? quizzable(t) : [];
  const pids = problems.filter((p) => !off.has(p.id)).map((p) => p.id);
  const start = async () => {
    if (!t || !pids.length) return;
    setBusy(true);
    setError('');
    try {
      const teamClasses = (classes ?? []).filter((c) => !chosen.size || chosen.has(c.id));
      const teams = teamMode === 'none' ? undefined : {by: teamMode, list: makeTeams(teamMode, teamCount, teamClasses)};
      await startLive(t, pids, dur, chosen.size ? Object.fromEntries([...chosen].map((c) => [c, true as const])) : undefined, teams);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-5 py-4">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-300">
          <Zap size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Шууд тэмцээн</h1>
          <p className="text-sm text-neutral-400">Самбар дээр бодлогыг нэг нэгээр нь гаргаж, сурагчид утсаараа хариулна. Хурдан, зөв хариулсан нь илүү оноо авна.</p>
        </div>
      </header>
      {!usable.length ? (
        <p className="rounded-2xl bg-neutral-900 p-5 text-sm text-neutral-400">
          Зөв хариулттай бодлоготой сэдэв алга. Тэмцээн зөвхөн зөв хариулт нь тавигдсан бодлогоор явна.{' '}
          <Link href="/admin?tab=topics" className="text-blue-400 hover:underline">
            Сэдвүүд
          </Link>
        </p>
      ) : (
        <section className="space-y-4 rounded-2xl bg-neutral-900 p-5">
          <label className="block">
            <span className="text-sm font-medium">Сэдэв</span>
            <select
              value={t?.id ?? ''}
              onChange={(e) => {
                setTid(e.target.value);
                setOff(new Set());
              }}
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500"
            >
              <option value="">Сэдэв сонгох…</option>
              {usable.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title} ({quizzable(x).length} бодлого)
                </option>
              ))}
            </select>
          </label>
          {t && (
            <div>
              <p className="text-sm font-medium">
                Бодлого: {pids.length}/{problems.length}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {problems.map((p) => {
                  const on = !off.has(p.id);
                  const no = problemNo(p, t.problems.indexOf(p));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setOff((s) => {
                          const n = new Set(s);
                          if (!n.delete(p.id)) n.add(p.id);
                          return n;
                        })
                      }
                      className={`h-9 min-w-9 rounded-full px-2 text-sm font-semibold ${on ? 'bg-blue-500 text-black' : 'bg-neutral-800 text-neutral-500 line-through'}`}
                    >
                      {no}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-neutral-500">Зөв хариулт нь тавигдсан бодлогууд. Дарж хасна, дахин дарж нэмнэ.</p>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium">Бодлого бүрт хугацаа</span>
            <select value={dur} onChange={(e) => setDur(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500 sm:w-48">
              {DURS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} секунд` : `${d / 60} минут`}
                </option>
              ))}
            </select>
          </label>
          {!!classes?.length && (
            <div>
              <p className="text-sm font-medium">Анги</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setChosen(new Set())} aria-pressed={!chosen.size} className={`rounded-full px-3 py-1.5 text-sm ${!chosen.size ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-300'}`}>
                  Бүх анги
                </button>
                {classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={chosen.has(c.id)}
                    onClick={() =>
                      setChosen((s) => {
                        const n = new Set(s);
                        if (!n.delete(c.id)) n.add(c.id);
                        return n;
                      })
                    }
                    className={`rounded-full px-3 py-1.5 text-sm ${chosen.has(c.id) ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-300'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium">Баг</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(
                [
                  ['none', 'Ганцаараа'],
                  ['count', 'Багаар'],
                  ...(byClass ? [['class', 'Ангиар'] as const] : []),
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" aria-pressed={teamMode === v} onClick={() => setTeamBy(v)} className={`rounded-full px-3 py-1.5 text-sm ${teamMode === v ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-300'}`}>
                  {label}
                </button>
              ))}
              {teamMode === 'count' && (
                <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} aria-label="Багийн тоо" className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1 text-sm">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} баг
                    </option>
                  ))}
                </select>
              )}
            </div>
            {teamMode !== 'none' && <p className="mt-1 text-xs text-neutral-500">{teamMode === 'class' ? 'Анги бүр нэг баг.' : 'Нэгдэх дарааллаар тэнцүү хуваана.'} Багийн оноо нь гишүүдийн дундаж оноо (цөөн хүнтэй баг хохирохгүй).</p>}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={start} disabled={!t || !pids.length || busy} className="flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 font-semibold text-black hover:bg-pink-400 disabled:opacity-50">
            <Zap size={18} /> Тэмцээн нээх
          </button>
          <p className="text-xs text-neutral-500">Нээхэд сурагчдын нүүр хуудсанд «Шууд тэмцээн» гарч, тэд нэгдэнэ. Хүн бүр нэгдсэний дараа «Эхлэх» дарна.</p>
        </section>
      )}
    </div>
  );
}

/** The board: who has joined, the question and its time, the answers coming in, the right answer and the ranking. */
function Board({quiz}: {quiz: LiveQuiz}) {
  const topics = useTopics();
  const players = useLivePlayers() ?? [];
  const scores = useLiveScores() ?? {};
  const answers = useLiveAnswers(quiz.state === 'q' || quiz.state === 'reveal' ? quiz.cur : null) ?? {};
  const question = useLiveQuestion();
  const now = useNow(250);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = topics?.find((x) => x.id === quiz.tid);
  const left = quiz.state === 'q' ? secondsLeft(quiz, now) : 0;
  const answered = Object.keys(answers).length;
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await f();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // Time's up (and a moment for an answer sent in the last second to arrive), or everyone has answered: the answer
  // shows by itself. Tried again on the next change if it failed (the reveal can run twice safely).
  const revealed = useRef(-1);
  const over = quiz.state === 'q' && !!quiz.qStart && now >= quiz.qStart + quiz.dur * 1000 + 1500;
  useEffect(() => {
    if (quiz.state !== 'q' || revealed.current === quiz.cur || !quiz.qStart) return;
    if (over || (players.length > 0 && answered >= players.length)) {
      revealed.current = quiz.cur;
      void revealQuestion(quiz).catch((e) => {
        revealed.current = -1;
        setError((e as Error).message);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.state, quiz.cur, over, answered, players.length]);

  const next = () => (t ? run(() => openQuestion(t, quiz, quiz.state === 'lobby' ? 0 : quiz.cur + 1)) : setError('Сэдэв олдсонгүй (устгагдсан байж магадгүй).'));
  const last = quiz.cur + 1 >= quiz.pids.length;
  const ranked = ranking(players, scores);
  const teamRanks = teamRanking(players, scores, quiz.teams);
  const close = () => confirm('Тэмцээнийг хаах уу? Оноо, хариултууд устна.') && void run(closeLive);
  // Teams: whoever joins is put in one here (their class's, or the smallest), once.
  const users = useLive(quiz.teamBy === 'class' ? 'users' : null, (v) => (v ?? {}) as Record<string, {class?: string}>);
  const placing = useRef(new Set<string>());
  useEffect(() => {
    if (!quiz.teams || (quiz.teamBy === 'class' && !users)) return;
    const assign = Object.fromEntries(Object.entries(teamsFor(players, quiz.teams, (uid) => users?.[uid]?.class, quiz.teamBy)).filter(([uid]) => !placing.current.has(uid)));
    if (!Object.keys(assign).length) return;
    Object.keys(assign).forEach((uid) => placing.current.add(uid));
    setTeams(assign).catch((e) => {
      Object.keys(assign).forEach((uid) => placing.current.delete(uid));
      setError((e as Error).message);
    });
  }, [players, quiz.teams, quiz.teamBy, users]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 py-2">
      <header className="flex flex-wrap items-center gap-3">
        <Zap size={22} className="text-pink-300" />
        <h1 className="mr-auto text-xl font-bold">{quiz.title}</h1>
        {quiz.state !== 'lobby' && quiz.state !== 'done' && (
          <span className="rounded-full bg-neutral-800 px-3 py-1 text-sm font-semibold tabular-nums">
            {quiz.cur + 1}/{quiz.pids.length}
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1 text-sm">
          <Users size={15} /> {players.length}
        </span>
        <button onClick={close} disabled={busy} className="rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700">
          Хаах
        </button>
      </header>
      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {quiz.state === 'lobby' && (
        <section className="rounded-3xl bg-neutral-900 p-6 text-center sm:p-10">
          <p className="text-lg text-neutral-300">Сурагчид: сайтад нэвтэрч, нүүр хуудасны</p>
          <p className="mt-1 text-3xl font-extrabold text-pink-300 sm:text-4xl">«Шууд тэмцээн»</p>
          <p className="mt-1 text-lg text-neutral-300">дээр дарж нэгдээрэй.</p>
          <p className="mt-6 text-5xl font-extrabold tabular-nums">{players.length}</p>
          <p className="text-neutral-400">нэгдсэн</p>
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {!quiz.teams &&
              players.map((p) => (
                <li key={p.uid} className="animate-[pop-in_.35s_ease-out] rounded-full bg-neutral-800 px-3 py-1.5 font-medium">
                  {p.name}
                </li>
              ))}
          </ul>
          {quiz.teams && (
            <div className={`mx-auto mt-5 grid gap-3 text-left sm:grid-cols-2 ${Object.keys(quiz.teams).length > 2 ? 'lg:grid-cols-3' : 'max-w-2xl'}`}>
              {Object.entries(quiz.teams).map(([id, team]) => {
                const members = players.filter((p) => p.team === id);
                return (
                  <div key={id} className="rounded-2xl bg-neutral-800/50 p-3">
                    <p className="flex items-center gap-2 font-bold">
                      <span className={`h-3 w-3 rounded-full ${TEAM_COLORS[team.color]}`} /> {team.name} <span className="ml-auto text-sm font-normal text-neutral-400">{members.length}</span>
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {members.map((p) => (
                        <li key={p.uid} className="animate-[pop-in_.35s_ease-out] rounded-full bg-neutral-800 px-2.5 py-1 text-sm">
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={next} disabled={busy || !t} className="mt-8 inline-flex items-center gap-2 rounded-full bg-pink-500 px-8 py-3 text-lg font-bold text-black hover:bg-pink-400 disabled:opacity-50">
            <Play size={20} /> Эхлэх
          </button>
        </section>
      )}

      {(quiz.state === 'q' || quiz.state === 'reveal') && question && (
        <section className="space-y-5 rounded-3xl bg-neutral-900 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-lg font-semibold text-neutral-300">{question.no}-р бодлого</h2>
            {quiz.state === 'q' && (
              <span className="text-sm text-neutral-400">
                {answered}/{players.length} хариулсан
              </span>
            )}
            {quiz.state === 'q' && <Countdown left={left} dur={quiz.dur} big />}
          </div>
          <Question q={question} big />
          {question.kind === 'choice' ? (
            <Choices q={question} keyed={quiz.state === 'reveal' ? quiz.key : undefined} counts={quiz.state === 'reveal' ? countBy(answers) : undefined} big />
          ) : (
            quiz.state === 'reveal' && (
              <p className="text-2xl font-bold">
                Зөв хариулт: <span className="text-green-300">{quiz.key || '—'}</span>
                <span className="ml-3 text-base font-normal text-neutral-400">
                  {Object.values(scores).filter((s) => s.ok).length}/{answered} зөв
                </span>
              </p>
            )
          )}
          {quiz.state === 'q' ? (
            <button onClick={() => run(() => revealQuestion(quiz))} disabled={busy} className="rounded-full bg-neutral-800 px-5 py-2 text-sm font-medium hover:bg-neutral-700">
              Хариуг одоо харуулах
            </button>
          ) : (
            <div className="flex flex-wrap items-start gap-5">
              {teamRanks.length > 0 && <TeamBars teams={teamRanks} />}
              <Top ranked={ranked.slice(0, 5)} />
              <button onClick={last ? () => run(finishLive) : next} disabled={busy} className="ml-auto inline-flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 font-bold text-black hover:bg-pink-400 disabled:opacity-50">
                {last ? (
                  <>
                    <Trophy size={18} /> Үр дүн
                  </>
                ) : (
                  <>
                    <Play size={18} /> Дараагийн бодлого
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      )}

      {quiz.state === 'done' && (
        <section className="space-y-6 rounded-3xl bg-neutral-900 p-6 sm:p-10">
          {teamRanks.length > 0 && (
            <div className="mx-auto max-w-lg space-y-2 text-center">
              <p className="text-3xl font-extrabold">
                <Crown size={30} className="mr-2 inline text-amber-300" />
                {teamRanks.filter((x) => x.place === 1).map((x) => x.name).join(', ')} баг яллаа!
              </p>
              <TeamBars teams={teamRanks} />
            </div>
          )}
          <Podium ranked={ranked} />
          <ol className="mx-auto max-w-md divide-y divide-neutral-800 rounded-2xl bg-neutral-800/40">
            {ranked.map((r, i) => (
              <li key={r.uid} className="flex items-center gap-3 px-4 py-2">
                <span className="w-6 text-right font-semibold tabular-nums text-neutral-400">{r.place}.</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="font-semibold tabular-nums">{r.score}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => run(closeLive)} disabled={busy} className="rounded-full bg-pink-500 px-6 py-2.5 font-bold text-black hover:bg-pink-400">
              Тэмцээнийг хаах
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

const countBy = (answers: Record<string, {a: string}>) => {
  const n: Record<string, number> = {};
  for (const a of Object.values(answers)) n[a.a] = (n[a.a] ?? 0) + 1;
  return n;
};

/** А–Д as big coloured tiles; after the reveal, the right one marked and how many picked each. */
function Choices({q, keyed, counts, big, picked, onPick, disabled}: {q: LiveQuestion; keyed?: string; counts?: Record<string, number>; big?: boolean; picked?: string; onPick?: (l: Letter) => void; disabled?: boolean}) {
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {LETTER_CODES.map((l) => {
        const text = q.choices?.[l];
        const right = keyed === l;
        const dim = keyed !== undefined && !right;
        return (
          <button
            key={l}
            type="button"
            disabled={disabled || !onPick}
            onClick={() => onPick?.(l)}
            aria-pressed={picked === l}
            aria-label={`${LETTER_LABELS[l]}${text ? `: ${text}` : ''}`}
            className={`relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 text-left font-bold text-white transition-opacity ${LIVE_COLORS[l]} ${big ? 'min-h-20 text-2xl' : 'min-h-16 text-xl'} ${dim ? 'opacity-35' : ''} ${picked === l ? 'ring-4 ring-neutral-50' : ''} ${l === 'E' ? 'col-span-2' : ''}`}
          >
            <span className="shrink-0">{LETTER_LABELS[l]}</span>
            {text && (
              <span className="min-w-0 text-base font-semibold [overflow-wrap:anywhere]">
                <MathText text={text} />
              </span>
            )}
            {right && <Check size={big ? 28 : 22} className="ml-auto shrink-0" />}
            {counts && (
              <span className="ml-auto shrink-0 rounded-full bg-black/25 px-2.5 py-0.5 text-base tabular-nums">
                {counts[l] ?? 0}
                {total > 0 && <span className="ml-1 text-xs font-medium opacity-80">({Math.round(((counts[l] ?? 0) / total) * 100)}%)</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The teams' standings: average points as bars (each team's colour), members and place. */
function TeamBars({teams}: {teams: ReturnType<typeof teamRanking>}) {
  const max = Math.max(1, ...teams.map((t) => t.avg));
  return (
    <ol className="min-w-64 flex-1 space-y-2" aria-label="Багууд">
      {teams.map((t) => (
        <li key={t.id} className="flex items-center gap-3">
          <span className="w-5 text-right font-bold tabular-nums">{t.place}</span>
          <span className="w-24 truncate text-left font-semibold">{t.name}</span>
          <span className="h-5 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <span className={`block h-full rounded-full ${TEAM_COLORS[t.color]}`} style={{width: `${(t.avg / max) * 100}%`}} />
          </span>
          <span className="w-24 text-right text-sm tabular-nums" title={`${t.members} гишүүн, нийт ${t.total}`}>
            <b>{t.avg}</b> <span className="text-neutral-400">({t.members})</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Top({ranked}: {ranked: ReturnType<typeof ranking>}) {
  return (
    <ol className="min-w-64 flex-1 space-y-1.5">
      {ranked.map((r) => (
        <li key={r.uid} className="flex items-center gap-3 rounded-xl bg-neutral-800/60 px-3 py-2">
          <span className="w-6 text-right font-bold tabular-nums">{r.place}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
          {r.last > 0 && <span className="text-sm font-semibold text-green-300">+{r.last}</span>}
          <span className="w-16 text-right font-bold tabular-nums">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

function Podium({ranked}: {ranked: ReturnType<typeof ranking>}) {
  const [first, second, third] = ranked;
  // The same score shares a place (the step shows it), the first one in order stands highest.
  const step = (r: (typeof ranked)[number] | undefined, h: string, tone: string) =>
    r ? (
      <div className="flex w-28 flex-col items-center sm:w-36">
        {r.place === 1 && <Crown size={32} className="mb-1 text-amber-300" />}
        <p className="max-w-full truncate font-bold">{r.name}</p>
        <p className="text-sm tabular-nums text-neutral-400">{r.score}</p>
        <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-2 text-3xl font-extrabold text-black ${tone} ${h}`}>{r.place}</div>
      </div>
    ) : (
      <div className="w-28 sm:w-36" />
    );
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4">
      {step(second, 'h-24', 'bg-slate-300')}
      {step(first, 'h-36', 'bg-amber-400')}
      {step(third, 'h-16', 'bg-orange-400')}
    </div>
  );
}

// ---- the student ----

function Player({uid, name, classId}: {uid: string; name: string; classId?: string}) {
  const state = useLiveQuizState();
  const quiz = state?.q ?? null;
  const players = useLivePlayers(!!quiz) ?? [];
  const scores = useLiveScores(!!quiz) ?? {};
  const now = useNow(250);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const asking = !!quiz && (quiz.state === 'q' || quiz.state === 'reveal');
  const question = useLiveQuestion(asking);
  // The answer the server has from this student (on any of their devices): the rules take one only.
  const myAnswer = useMyLiveAnswer(asking ? quiz.cur : null, uid);
  const [sending, setSending] = useState<{i: number; a: string} | null>(null);
  // An answer refused (too late: the question had closed).
  const [refused, setRefused] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [quiz?.cur]);

  if (!state) return <Loading />;
  const me = quiz ? players.find((p) => p.uid === uid) : undefined;
  // Not for this class, or left open and forgotten (and not joined): nothing to join.
  if (!quiz || !forClass(quiz.classes, classId) || (!me && !liveOn(quiz, now)))
    return (
      <CenterNote icon={<Zap size={36} />} title="Одоогоор шууд тэмцээн алга">
        <p>Багш тэмцээн нээхэд энд болон нүүр хуудсанд гарна.</p>
      </CenterNote>
    );
  const ranked = ranking(players, scores);
  const place = ranked.find((r) => r.uid === uid)?.place ?? 0;
  const mine = scores[uid];
  // This question's result (the scores of the one before may still be showing for a moment).
  const result = mine && mine.q === quiz.cur ? mine : null;
  // A team quiz: the student's team (once the teacher's board has put them in one) and its place.
  const team = quiz.teams && me?.team ? quiz.teams[me.team] : null;
  const teamRanks = teamRanking(players, scores, quiz.teams);
  const teamPlace = me?.team ? teamRanks.find((x) => x.id === me.team)?.place : undefined;
  const teamLine = team && teamPlace ? (
    <p className="mt-1 text-neutral-300">
      Таны баг <b>{team.name}</b>: {teamPlace}-р байр ({teamRanks.length} багаас)
    </p>
  ) : null;

  const join = async () => {
    setJoining(true);
    setError('');
    try {
      await joinLive(name);
    } catch (e) {
      setError(/permission/i.test((e as Error).message) ? 'Нэгдэж чадсангүй: тэмцээн дууссан байж магадгүй.' : (e as Error).message);
    } finally {
      setJoining(false);
    }
  };
  const answer = async (a: string) => {
    if (!a || myAnswer !== null || sending) return;
    const i = quiz.cur;
    setSending({i, a});
    setError('');
    try {
      await answerLive(i, a);
    } catch (e) {
      // Too late (the question closed), or answered already from another device.
      if (/permission/i.test((e as Error).message)) setRefused(i);
      else setError((e as Error).message);
    } finally {
      setSending(null);
    }
  };

  if (!me && quiz.state !== 'done')
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-pink-500/15 text-pink-300">
          <Zap size={32} />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Шууд тэмцээн</h1>
        <p className="mt-1 text-neutral-300">{quiz.title}</p>
        <p className="mt-4 text-sm text-neutral-400">
          Таныг бусад <b className="text-neutral-200">{name}</b> гэж харна. {players.length} хүн нэгдсэн.
        </p>
        <button onClick={join} disabled={joining} className="mt-6 inline-flex items-center gap-2 rounded-full bg-pink-500 px-8 py-3 text-lg font-bold text-black hover:bg-pink-400 disabled:opacity-50">
          <Zap size={20} /> Нэгдэх
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    );

  const left = quiz.state === 'q' ? secondsLeft(quiz, now) : 0;
  const mineNow = myAnswer ?? (sending?.i === quiz.cur ? sending.a : null);
  return (
    <div className="mx-auto max-w-xl space-y-4 py-2">
      <header className="flex items-center gap-2">
        <Zap size={20} className="text-pink-300" />
        <h1 className="mr-auto min-w-0 truncate font-bold">{quiz.title}</h1>
        {quiz.state !== 'lobby' && quiz.state !== 'done' && (
          <span className="shrink-0 rounded-full bg-neutral-800 px-2.5 py-0.5 text-sm tabular-nums">
            {quiz.cur + 1}/{quiz.pids.length}
          </span>
        )}
        {team && (
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-800 px-2.5 py-0.5 text-sm font-semibold">
            <span className={`h-2.5 w-2.5 rounded-full ${TEAM_COLORS[team.color]}`} /> {team.name}
          </span>
        )}
        {mine && <span className="shrink-0 whitespace-nowrap rounded-full bg-neutral-800 px-2.5 py-0.5 text-sm font-semibold tabular-nums">{mine.score} оноо</span>}
      </header>

      {quiz.state === 'lobby' && (
        <div className="rounded-3xl bg-neutral-900 p-8 text-center">
          <p className="text-2xl font-bold">Нэгдлээ!</p>
          {quiz.teams &&
            (team ? (
              <p className="mt-3 flex items-center justify-center gap-2 text-lg">
                <span className={`h-4 w-4 rounded-full ${TEAM_COLORS[team.color]}`} /> Та <b>{team.name}</b> багт
              </p>
            ) : (
              <p className="mt-3 text-neutral-400">Баг хуваарилж байна…</p>
            ))}
          <p className="mt-2 text-neutral-400">Багш эхлүүлэхийг хүлээж байна… ({players.length} хүн)</p>
        </div>
      )}

      {quiz.state === 'q' && question && (
        <div className="space-y-4 rounded-3xl bg-neutral-900 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="mr-auto font-semibold text-neutral-300">{question.no}-р бодлого</span>
            <Countdown left={left} dur={quiz.dur} />
          </div>
          <Question q={question} />
          {mineNow !== null ? (
            <p className="rounded-2xl bg-neutral-800 p-4 text-center font-semibold">
              {myAnswer === null ? 'Илгээж байна' : 'Хариулт илгээгдлээ'}
              {question.kind === 'choice' ? `: ${label(mineNow)}` : `: ${mineNow}`}. {myAnswer !== null && 'Бусдыг хүлээж байна…'}
            </p>
          ) : left === 0 || refused === quiz.cur ? (
            <p className="rounded-2xl bg-neutral-800 p-4 text-center font-semibold text-neutral-300">Хугацаа дууслаа{refused === quiz.cur ? ': хариулт хүлээж авсангүй' : ''}.</p>
          ) : question.kind === 'choice' ? (
            <Choices q={question} onPick={(l) => void answer(l)} disabled={!!sending} />
          ) : (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void answer(normalize(typed));
              }}
              className="flex gap-2"
            >
              <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={40} autoFocus placeholder="Хариулт" aria-label="Хариулт" className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-lg outline-none focus:border-blue-500" />
              <button disabled={!typed.trim()} className="rounded-xl bg-pink-500 px-5 font-bold text-black disabled:opacity-50">
                Илгээх
              </button>
            </form>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {quiz.state === 'reveal' && question && (
        <div className={`rounded-3xl p-6 text-center ${result?.ok ? 'bg-green-500/15' : 'bg-red-500/10'}`}>
          {result?.ok ? (
            <>
              <Check size={40} className="mx-auto text-green-300" />
              <p className="mt-2 text-2xl font-bold text-green-300">Зөв! +{result.last}</p>
            </>
          ) : (
            <>
              <X size={40} className="mx-auto text-red-300" />
              <p className="mt-2 text-2xl font-bold text-red-300">{(result ? result.a : mineNow !== null) ? 'Буруу' : 'Хариулаагүй'}</p>
              <p className="mt-1 text-neutral-300">Зөв хариулт: {question.kind === 'choice' ? label(quiz.key ?? '') : quiz.key}</p>
            </>
          )}
          {place > 0 && (
            <p className="mt-3 text-neutral-300">
              Та одоо <b>{place}-р</b> байранд ({players.length} хүнээс)
            </p>
          )}
          {teamLine}
        </div>
      )}

      {quiz.state === 'done' && (
        <div className="space-y-5 rounded-3xl bg-neutral-900 p-6 text-center">
          <Trophy size={40} className="mx-auto text-amber-300" />
          <p className="text-2xl font-bold">Тэмцээн дууслаа!</p>
          {place > 0 && (
            <p className="text-lg">
              Та <b>{place}-р</b> байр, <b>{mine?.score ?? 0}</b> оноо
            </p>
          )}
          {teamLine}
          {teamRanks.length > 0 && <TeamBars teams={teamRanks} />}
          <Podium ranked={ranked} />
        </div>
      )}
    </div>
  );
}
