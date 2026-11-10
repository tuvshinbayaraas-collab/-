import {Clock, Eye, FlaskConical, RotateCcw} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import Loading from '../components/Loading';
import {CenterNote, InactiveNote, LockedNote, LoginButton} from '../components/Notices';
import {isPerfect, perfectText, PerfectTitle, ResultCard} from '../components/Perfect';
import QuestionCard from '../components/QuestionCard';
import {QuestionList, useJump} from '../components/QuestionList';
import RankLine from '../components/RankLine';
import SkillBreakdown from '../components/SkillBreakdown';
import {choicePerms, clearAttempt, formatDuration, formatTime, loadAttempt, newAttempt, saveAttempt, type Attempt} from '../lib/attempt';
import {examState, useExamAnswer, useExams} from '../lib/exams';
import {choiceAt, encode, grade, percent, useKeys} from '../lib/keys';
import {useDbConnected} from '../lib/connection';
import {submitScore} from '../lib/leaderboard';
import {addMistakes, useMistakes} from '../lib/mistakes';
import {ask, useLeaveCounter} from '../lib/leaves';
import {endTestLive, markTestOut, reportTestLive} from '../lib/testLive';
import {usePrefs} from '../lib/prefs';
import {saveResult, useMyResults} from '../lib/results';
import {Link, useLocation} from '../lib/router';
import {isStudent, useSession} from '../lib/session';
import {inThisWeek} from '../lib/week';
import {settingsReady, useSettings, type Settings} from '../lib/settings';
import {skillStats} from '../lib/skills';
import {useNow} from '../lib/time';
import {testTimeKey, timeResult, useTimeOn} from '../lib/timeOn';
import {skillOf, type Skill} from '../tests/skills';
import ExamRunner, {ExamWait} from './ExamRunner';
import {loadTest, testInfo} from '../tests';
import type {Test} from '../tests/types';

/** student: results are saved; trial: a guest trying the trial test; preview: the teacher looking at a test. */
type Mode = 'student' | 'trial' | 'preview';

export default function TestPage({id}: {id: string}) {
  const info = testInfo(id);
  const session = useSession();
  const settings = useSettings();
  const mine = useMyResults();
  const exams = useExams();
  const exam = exams?.[id];
  const now = useNow(exam ? 1000 : 0);
  const examAnswer = useExamAnswer(id, exam && isStudent(session) ? session.user?.uid : undefined);
  const {query} = useLocation();

  if (!info) return <CenterNote title="Ийм тест олдсонгүй" />;
  if (!session.ready || !settings || !exams) return <Loading />;

  const mode: Mode | null = session.admin ? 'preview' : isStudent(session) ? 'student' : !session.user && settings.trial === id ? 'trial' : null;
  if (!mode) {
    if (session.user) return <InactiveNote blocked={!!session.profile?.disabled} />;
    return <LockedNote title={`${info.title}-ийг өгөхийн тулд нэвтэрнэ үү`} trial={settings.trial || undefined} />;
  }

  // A test scheduled as an exam is closed until it starts, taken once while it runs, and shows its result afterwards.
  const state = exam ? examState(exam, now) : null;
  if (exam && state !== 'ended' && mode === 'trial') return <CenterNote title="Энэ тест одоогоор шалгалтаар товлогдсон байна" />;
  if (exam && mode === 'student') {
    if (examAnswer === undefined) return <Loading what="Шалгалтыг ачаалж байна…" />;
    if (state === 'upcoming') return <ExamWait id={id} exam={exam} now={now} />;
    if (state === 'active' || (examAnswer && query.get('practice') !== '1'))
      return <ExamRunner key={`${session.user!.uid}/${id}/${exam.start}`} id={id} exam={exam} uid={session.user!.uid} saved={examAnswer} />;
  }
  // Earlier results only matter when retakes are off (to close a test already taken), so only then wait for them.
  if (mode === 'student' && !settings.retakes && mine === null) return <Loading what="Тестийг ачаалж байна…" />;

  const taken = mine?.find((r) => r.test === id);
  const owner = session.user?.uid ?? 'guest';
  const saved = mine ? mine.filter((r) => r.test === id).map((r) => r.id) : null;
  return <Runner key={`${owner}/${id}`} id={id} owner={owner} mode={mode} canRetake={mode !== 'student' || settings.retakes} taken={taken ? {test: id, id: taken.id} : null} saved={saved} />;
}

function Runner(props: {
  id: string;
  owner: string;
  mode: Mode;
  canRetake: boolean;
  taken: {test: string; id: string} | null;
  /** Ids of this week's stored attempts at this test (null while loading). */
  saved: string[] | null;
}) {
  const {id, owner, mode, canRetake, taken, saved} = props;
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [saveError, setSaveError] = useState('');
  const [saveTry, setSaveTry] = useState(0);
  const [onlyWrong, setOnlyWrong] = useState(false);
  // A topic picked under the score: just its wrong questions.
  const [skill, setSkill] = useState<Skill | null>(null);
  // The test's questions didn't come (no connection when it opened).
  const [failed, setFailed] = useState(false);
  const {full, jump} = useJump(() => {
    setOnlyWrong(false);
    setSkill(null);
  });
  // A new attempt: its questions in their own order, and (unless the teacher turned it off) each one's choices too.
  const fresh = (t: Test, s: Settings | null) => newAttempt(t.questions.length, s?.shuffleChoices !== false ? choicePerms(t.questions) : undefined);

  useEffect(() => {
    // The settings first: whether the choices are shuffled is fixed when the attempt is made.
    loadTest(id)?.then(
      async (t) => {
        const s = await settingsReady();
        let a = loadAttempt(owner, id, t.questions.length);
        // A test finished before the weekly reset is gone from the results, so start afresh.
        if (a?.finished && !inThisWeek(a.finished)) {
          clearAttempt(owner, id);
          a = null;
        }
        if (!a) {
          if (!canRetake && taken) {
            setTest(t);
            setBlocked(true);
            return;
          }
          a = fresh(t, s);
          saveAttempt(owner, id, a); // so a reload keeps this order and the clock
        }
        setTest(t);
        setAttempt(a);
      },
      () => setFailed(true),
    );
    // Decided once when the test opens; a retake setting changed meanwhile applies next time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, owner]);

  const update = (a: Attempt) => {
    setAttempt(a);
    saveAttempt(owner, id, a);
  };

  // The teacher removed the stored attempt (say, one handed in by mistake while retakes are off), but this device
  // still holds it as finished: start afresh, or show the test closed if another attempt still counts.
  const gone = mode === 'student' && !!saved && !!attempt?.finished && !!attempt.resultId && !saved.includes(attempt.resultId);
  useEffect(() => {
    if (!gone || !test) return;
    clearAttempt(owner, id);
    setSaveError('');
    setOnlyWrong(false);
    if (!canRetake && saved!.length) return setBlocked(true);
    update(fresh(test, settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone, test]);

  const finished = !!attempt?.finished;

  // Leaving the page (another tab or app, another window, closing it, another page of the site) while answering is
  // counted quietly (the student isn't shown it) and shown to the teacher: live in "Одоо тест өгч байна", and with the
  // result. Stored at once: the page may be closing, or already gone to another page.
  const latest = useRef(attempt);
  latest.current = attempt;
  const bump = (f: (a: Attempt) => Attempt) => {
    const prev = latest.current;
    if (!prev) return null;
    const next = f(prev);
    latest.current = next;
    saveAttempt(owner, id, next);
    setAttempt(next);
    return next;
  };
  const liveUid = mode === 'student' ? owner : null;
  useLeaveCounter(
    !!attempt && !finished && mode !== 'preview',
    () => {
      const a = bump((x) => ({...x, leaves: (x.leaves ?? 0) + 1}));
      if (liveUid && a) markTestOut(liveUid, true, {leaves: a.leaves ?? 0, away: a.away ?? 0});
    },
    (ms) => {
      const a = bump((x) => ({...x, away: (x.away ?? 0) + ms}));
      if (liveUid && a) markTestOut(liveUid, false, {leaves: a.leaves ?? 0, away: a.away ?? 0});
    },
    {store: attempt ? `batnab.away.${owner}.${id}.${attempt.started}` : undefined},
  );
  // The teacher's live view: this test going on (how far, how often left), off it once handed in.
  const answeredNow = attempt ? attempt.answers.filter((x) => x !== null).length : 0;
  useEffect(() => {
    if (!liveUid || !attempt) return;
    if (attempt.finished) return void endTestLive(liveUid);
    void reportTestLive(
      liveUid,
      {test: id, started: attempt.started, n: answeredNow, total: attempt.answers.length, leaves: attempt.leaves ?? 0, away: attempt.away ?? 0},
      document.visibilityState === 'hidden',
    );
    // Reported again as answers come; leaving and coming back are reported where they're counted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveUid, attempt?.started, attempt?.finished, answeredNow]);
  // How long each question takes, for the teacher only (lib/timeOn): while answering, a question's from the touch before
  // to the touch on it (a long stretch: the questions on screen).
  useTimeOn(liveUid && attempt && !finished ? `timeOn/${liveUid}/${testTimeKey(id, attempt.started)}` : null, () =>
    (latest.current?.order ?? []).map((qi, pos) => ({el: document.getElementById(`q${pos}`), key: String(qi), open: true})),
  );
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finished]);

  // A student's answers are stored first; only then may the answer key be read.
  useEffect(() => {
    if (mode !== 'student' || !attempt?.finished || attempt.resultId) return;
    setSaveError('');
    // Kept even if the page was left meanwhile, so the same answers aren't stored twice.
    saveResult(id, encode(attempt.answers), Math.round((attempt.finished - attempt.started) / 1000), attempt.leaves, attempt.away)
      .then((resultId) => {
        update({...attempt, resultId});
        if (liveUid) void timeResult(liveUid, testTimeKey(id, attempt.started), resultId);
      })
      .catch((e) => setSaveError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.finished, attempt?.resultId, saveTry]);

  const keyReadable = finished && (mode !== 'student' || !!attempt?.resultId);
  const keys = useKeys(keyReadable ? [id] : []);
  const key = keyReadable ? keys[id] : undefined;

  const session = useSession();
  const settings = useSettings();
  const prefs = usePrefs();
  const connected = useDbConnected();
  // A saved, graded attempt goes on the weekly leaderboard (when it beats this week's best and the student takes part).
  const onBoard = mode === 'student' && !!settings?.leaderboard && !prefs.lbOff;
  const graded = key && attempt?.finished ? grade(encode(attempt.answers), key, testInfo(id)!.count) : null;
  useEffect(() => {
    if (!onBoard || !attempt?.resultId || !attempt.finished || !graded || !session.profile) return;
    submitScore(id, graded, Math.round((attempt.finished - attempt.started) / 1000), attempt.resultId, session.profile).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBoard, attempt?.resultId, graded?.score, graded?.total]);
  // Questions answered wrong in a saved attempt go into the mistakes notebook (once per attempt).
  const mistakes = useMistakes(mode === 'student' ? session.user?.uid : undefined);
  const noted = useRef<string | null>(null);
  useEffect(() => {
    if (!mistakes || !key || !attempt?.finished || !attempt.resultId || noted.current === attempt.resultId) return;
    noted.current = attempt.resultId;
    const wrong = attempt.order.filter((qi) => attempt.answers[qi] !== null && choiceAt(key, qi) !== null && attempt.answers[qi] !== choiceAt(key, qi));
    addMistakes(
      wrong.map((qi) => ({s: 't', t: id, q: String(qi)})),
      mistakes,
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mistakes !== null, key, attempt?.resultId]);

  if (blocked)
    return (
      <CenterNote title="Та энэ тестийг өгсөн байна">
        <p>Багш дахин өгөхийг хаасан байна.</p>
        {taken && (
          <Link href={`/review/${taken.test}/${taken.id}`} className="mt-4 inline-block text-blue-400 hover:underline">
            Хариултаа харах
          </Link>
        )}
      </CenterNote>
    );
  if (failed)
    return (
      <CenterNote title="Тестийг ачаалж чадсангүй">
        <p className="text-neutral-400">Интернэт холболтоо шалгаад дахин оролдоно уу. Өмнө нь бөглөсөн хариулт тань энэ төхөөрөмжид хадгалагдсан.</p>
        <button onClick={() => location.reload()} className="mt-4 rounded-full bg-blue-500 px-5 py-2 font-semibold text-black hover:bg-blue-400">
          Дахин оролдох
        </button>
      </CenterNote>
    );
  if (!test || !attempt) return <Loading what="Тестийг ачаалж байна…" />;

  const total = test.questions.length;
  const answered = attempt.answers.filter((x) => x !== null).length;
  const elapsed = ((attempt.finished ?? now) - attempt.started) / 1000;
  const g = key ? grade(encode(attempt.answers), key, total) : null;
  const perfect = isPerfect(g);
  const correctOf = (qi: number) => (g ? choiceAt(key, qi) : null);
  const missed = attempt.order.filter((qi) => correctOf(qi) !== null && attempt.answers[qi] !== correctOf(qi));

  const choose = (qi: number, ci: number) => {
    if (finished) return;
    const answers = [...attempt.answers];
    answers[qi] = answers[qi] === ci ? null : ci;
    update({...attempt, answers});
    // "Дараагийн бодлого руу шилжих" setting: on to the next question once this one is answered.
    const pos = attempt.order.indexOf(qi);
    if (prefs.autoNext && answers[qi] !== null && pos + 1 < total) setTimeout(() => jump(pos + 1), 250);
  };

  const finish = () => {
    const left = total - answered;
    if (left && !ask(`${left} бодлого хариулаагүй байна. Тестээ дуусгах уу?`)) return;
    update({...attempt, finished: Date.now()});
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const restart = () => {
    clearAttempt(owner, id);
    setSaveError('');
    setOnlyWrong(false);
    update(fresh(test, settings));
    window.scrollTo({top: 0});
  };

  return (
    <div className="mx-auto max-w-4xl">
      {mode !== 'student' && (
        <p className="mb-2 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {mode === 'trial' ? <FlaskConical size={16} /> : <Eye size={16} />}
          {mode === 'trial' ? 'Туршилтын горим: дүн хадгалагдахгүй.' : 'Багшийн харах горим: дүн хадгалагдахгүй.'}
        </p>
      )}
      <div className="sticky top-14 z-20 -mx-4 border-b border-neutral-800 bg-page/95 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg font-bold">{test.title}</h1>
          <span className="text-sm text-neutral-400">
            {answered}/{total} хариулсан
          </span>
          {!prefs.hideTimer && (
            <span className="flex items-center gap-1 text-sm tabular-nums text-neutral-400">
              <Clock size={14} /> {formatTime(elapsed)}
            </span>
          )}
          <div className="ml-auto">
            {!finished ? (
              <button onClick={finish} className="rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-black hover:bg-blue-400">
                Дуусгах
              </button>
            ) : (
              canRetake && (
                <button onClick={restart} className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-semibold hover:bg-neutral-700">
                  <RotateCcw size={16} /> Дахин өгөх
                </button>
              )
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible">
          {attempt.order.map((qi, pos) => {
            const chosen = attempt.answers[qi];
            const correct = correctOf(qi);
            const style =
              finished && correct !== null
                ? chosen === correct
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600/80 text-white'
                : chosen !== null
                  ? 'bg-blue-500 text-black'
                  : 'bg-neutral-800 text-neutral-300';
            return (
              <button key={qi} onClick={() => jump(pos)} className={`h-7 min-w-7 shrink-0 rounded-md px-1 text-xs font-semibold ${style}`} aria-label={`${pos + 1}-р бодлого`}>
                {pos + 1}
              </button>
            );
          })}
        </div>
      </div>

      {finished && (
        <ResultCard perfect={perfect ? 'test' : null} id={attempt.resultId ?? `${id}-${attempt.started}`} className="mt-4">
          {mode === 'student' && !attempt.resultId ? (
            saveError ? (
              <div>
                <p className="text-red-400">Хариултыг хадгалж чадсангүй: {saveError}</p>
                <button onClick={() => setSaveTry((n) => n + 1)} className="mt-3 rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-black hover:bg-blue-400">
                  Дахин хадгалах
                </button>
              </div>
            ) : (
              <div>
                <p className="text-neutral-400">Хариултыг хадгалж байна…</p>
                {!connected && <p className="mt-1 text-sm text-amber-300">Сервертэй холболт тасарсан байна. Хариулт тань энэ төхөөрөмжид хадгалагдсан, холбогдмогц автоматаар илгээгдэнэ.</p>}
              </div>
            )
          ) : key === undefined ? (
            <p className="text-neutral-400">Дүнг тооцож байна…</p>
          ) : !g && mode !== 'student' ? (
            <p className="text-neutral-400">Багш энэ тестийн зөв хариултыг оруулаагүй байна.</p>
          ) : !g ? (
            <div>
              <p className="font-semibold">Хариултууд тань хадгалагдлаа.</p>
              <p className="mt-1 text-sm text-neutral-400">
                Багш энэ тестийн зөв хариултыг оруулаагүй байна. Оруулсны дараа дүн тань{' '}
                <Link href="/results" className="text-blue-400 hover:underline">
                  Миний дүнгүүд
                </Link>{' '}
                хэсэгт гарна.
              </p>
            </div>
          ) : (
            <div>
              {perfect && <PerfectTitle kind="test" />}
              <p className={`text-sm text-neutral-400 ${perfect ? 'mt-2' : ''}`}>Таны оноо</p>
              {perfect ? (
                <p className={`mt-1 text-5xl font-extrabold ${perfectText('test')}`}>
                  {g.score} <span className="text-3xl">/ {g.total}</span>
                  <span className="ml-3 text-2xl">{percent(g)}%</span>
                </p>
              ) : (
                <p className="mt-1 text-4xl font-bold">
                  {g.score} <span className="text-2xl text-neutral-400">/ {g.total}</span>
                  <span className="ml-3 text-xl text-neutral-300">{percent(g)}%</span>
                </p>
              )}
              {perfect && <p className="mt-1 text-sm text-neutral-300">Бүх бодлогыг зөв бодлоо. Гайхалтай!</p>}
              <p className="mt-1 text-sm text-neutral-400">Зарцуулсан хугацаа: {formatDuration(elapsed)}</p>
              {g.total < g.count && <p className="mt-1 text-sm text-amber-300">{g.count - g.total} бодлогын зөв хариултыг багш оруулаагүй тул тооцоогүй.</p>}
              {missed.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-sm">
                    <span className="font-medium text-red-300">{missed.length} бодлого дээр алдсан</span>
                  </p>
                  <button
                    onClick={() => {
                      setOnlyWrong((o) => !o);
                      setSkill(null);
                    }}
                    className="rounded-full bg-neutral-800 px-3.5 py-1 text-sm font-medium hover:bg-neutral-700"
                    aria-pressed={onlyWrong}
                  >
                    {onlyWrong ? 'Бүх бодлогыг харах' : 'Зөвхөн алдсанаа харах'}
                  </button>
                </div>
              )}
              <SkillBreakdown
                stats={skillStats([{test: id, answers: encode(attempt.answers), key}])}
                percent={percent(g)}
                picked={skill}
                onPick={(s) => {
                  setSkill(s);
                  setOnlyWrong(false);
                }}
                notebook={mode === 'student'}
              />
              {mode === 'student' && (
                <p className="mt-3 text-sm text-neutral-400">
                  Дүн хадгалагдлаа.{' '}
                  <Link href="/results" className="text-blue-400 hover:underline">
                    Миний дүнгүүд
                  </Link>
                </p>
              )}
              {onBoard && !prefs.lbHideRank && attempt.resultId && <RankLine test={id} uid={owner} rid={attempt.resultId} />}
            </div>
          )}
          {mode === 'trial' && (
            <div className="mt-4 border-t border-neutral-800 pt-4">
              <p className="text-sm text-neutral-400">Бусад тестийг өгч, дүнгээ хадгалахын тулд багшаасаа нэвтрэх нэр, нууц үг аваарай.</p>
              <div className="mt-3">
                <LoginButton next="/" />
              </div>
            </div>
          )}
        </ResultCard>
      )}

      <QuestionList full={full}>
        {attempt.order.map((qi, pos) =>
          (onlyWrong || skill) && finished && (!missed.includes(qi) || (skill && skillOf(id, qi) !== skill)) ? null : (
            <QuestionCard
              key={qi}
              id={`q${pos}`}
              num={pos + 1}
              q={test.questions[qi]}
              chosen={attempt.answers[qi]}
              checked={finished && !!g}
              correct={correctOf(qi)}
              reveal={mode === 'preview'}
              perm={attempt.perms?.[qi] ?? undefined}
              onChoose={finished ? undefined : (ci) => choose(qi, ci)}
            />
          ),
        )}
      </QuestionList>

      {!finished && (
        <div className="mt-6 flex justify-center">
          <button onClick={finish} className="rounded-full bg-blue-500 px-8 py-2.5 font-semibold text-black hover:bg-blue-400">
            Тестээ дуусгах
          </button>
        </div>
      )}
    </div>
  );
}
