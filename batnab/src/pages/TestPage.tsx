import {Clock, Eye, FlaskConical, RotateCcw} from 'lucide-react';
import {useEffect, useState} from 'react';
import {CenterNote, InactiveNote, LockedNote, LoginButton} from '../components/Notices';
import QuestionCard from '../components/QuestionCard';
import {clearAttempt, formatDuration, formatTime, loadAttempt, newAttempt, saveAttempt, type Attempt} from '../lib/attempt';
import {choiceAt, encode, grade, percent, useKeys} from '../lib/keys';
import {saveResult, useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {isStudent, useSession} from '../lib/session';
import {inThisWeek} from '../lib/week';
import {useSettings} from '../lib/settings';
import {loadTest, testInfo} from '../tests';
import type {Test} from '../tests/types';

/** student: results are saved; trial: a guest trying the trial test; preview: the teacher looking at a test. */
type Mode = 'student' | 'trial' | 'preview';

export default function TestPage({id}: {id: string}) {
  const info = testInfo(id);
  const session = useSession();
  const settings = useSettings();
  const mine = useMyResults();

  if (!info) return <CenterNote title="Ийм тест олдсонгүй" />;
  if (!session.ready || !settings) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  const mode: Mode | null = session.admin ? 'preview' : isStudent(session) ? 'student' : !session.user && settings.trial === id ? 'trial' : null;
  if (!mode) {
    if (session.user) return <InactiveNote blocked={!!session.profile?.disabled} />;
    return <LockedNote title={`${info.title}-ийг өгөхийн тулд нэвтэрнэ үү`} trial={settings.trial || undefined} />;
  }
  if (mode === 'student' && mine === null) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  const taken = mine?.find((r) => r.test === id);
  const owner = session.user?.uid ?? 'guest';
  return <Runner key={`${owner}/${id}`} id={id} owner={owner} mode={mode} canRetake={mode !== 'student' || settings.retakes} taken={taken ? {test: id, id: taken.id} : null} />;
}

function Runner({id, owner, mode, canRetake, taken}: {id: string; owner: string; mode: Mode; canRetake: boolean; taken: {test: string; id: string} | null}) {
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [saveError, setSaveError] = useState('');
  const [saveTry, setSaveTry] = useState(0);
  const [onlyWrong, setOnlyWrong] = useState(false);

  useEffect(() => {
    loadTest(id)?.then((t) => {
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
        a = newAttempt(t.questions.length);
        saveAttempt(owner, id, a); // so a reload keeps this order and the clock
      }
      setTest(t);
      setAttempt(a);
    });
    // Decided once when the test opens; a retake setting changed meanwhile applies next time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, owner]);

  const update = (a: Attempt) => {
    setAttempt(a);
    saveAttempt(owner, id, a);
  };

  const finished = !!attempt?.finished;
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
    saveResult(id, encode(attempt.answers), Math.round((attempt.finished - attempt.started) / 1000))
      .then((resultId) => update({...attempt, resultId}))
      .catch((e) => setSaveError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.finished, attempt?.resultId, saveTry]);

  const keyReadable = finished && (mode !== 'student' || !!attempt?.resultId);
  const keys = useKeys(keyReadable ? [id] : []);
  const key = keyReadable ? keys[id] : undefined;

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
  if (!test || !attempt) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  const total = test.questions.length;
  const answered = attempt.answers.filter((x) => x !== null).length;
  const elapsed = ((attempt.finished ?? now) - attempt.started) / 1000;
  const g = key ? grade(encode(attempt.answers), key, total) : null;
  const correctOf = (qi: number) => (g ? choiceAt(key, qi) : null);
  const missed = attempt.order.filter((qi) => correctOf(qi) !== null && attempt.answers[qi] !== correctOf(qi));

  const choose = (qi: number, ci: number) => {
    if (finished) return;
    const answers = [...attempt.answers];
    answers[qi] = answers[qi] === ci ? null : ci;
    update({...attempt, answers});
  };

  const finish = () => {
    const left = total - answered;
    if (left && !confirm(`${left} бодлого хариулаагүй байна. Тестээ дуусгах уу?`)) return;
    update({...attempt, finished: Date.now()});
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const restart = () => {
    clearAttempt(owner, id);
    setSaveError('');
    setOnlyWrong(false);
    update(newAttempt(total));
    window.scrollTo({top: 0});
  };

  const jump = (pos: number) => {
    const to = () => document.getElementById(`q${pos}`)?.scrollIntoView({behavior: 'smooth', block: 'start'});
    if (document.getElementById(`q${pos}`)) return to();
    setOnlyWrong(false); // the question is hidden by the filter
    setTimeout(to, 50);
  };

  return (
    <div className="mx-auto max-w-4xl">
      {mode !== 'student' && (
        <p className="mb-2 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {mode === 'trial' ? <FlaskConical size={16} /> : <Eye size={16} />}
          {mode === 'trial' ? 'Туршилтын горим: дүн хадгалагдахгүй.' : 'Багшийн харах горим: дүн хадгалагдахгүй.'}
        </p>
      )}
      <div className="sticky top-14 z-20 -mx-4 border-b border-neutral-800 bg-[#0f0f0f]/95 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg font-bold">{test.title}</h1>
          <span className="text-sm text-neutral-400">
            {answered}/{total} хариулсан
          </span>
          <span className="flex items-center gap-1 text-sm tabular-nums text-neutral-400">
            <Clock size={14} /> {formatTime(elapsed)}
          </span>
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
        <div className="mt-4 rounded-2xl bg-neutral-900 p-5">
          {mode === 'student' && !attempt.resultId ? (
            saveError ? (
              <div>
                <p className="text-red-400">Хариултыг хадгалж чадсангүй: {saveError}</p>
                <button onClick={() => setSaveTry((n) => n + 1)} className="mt-3 rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-black hover:bg-blue-400">
                  Дахин хадгалах
                </button>
              </div>
            ) : (
              <p className="text-neutral-400">Хариултыг хадгалж байна…</p>
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
              <p className="text-sm text-neutral-400">Таны оноо</p>
              <p className="mt-1 text-4xl font-bold">
                {g.score} <span className="text-2xl text-neutral-400">/ {g.total}</span>
                <span className="ml-3 text-xl text-neutral-300">{percent(g)}%</span>
              </p>
              <p className="mt-1 text-sm text-neutral-400">Зарцуулсан хугацаа: {formatDuration(elapsed)}</p>
              {g.total < g.count && <p className="mt-1 text-sm text-amber-300">{g.count - g.total} бодлогын зөв хариултыг багш оруулаагүй тул тооцоогүй.</p>}
              {missed.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-sm">
                    <span className="font-medium text-red-300">{missed.length} бодлого дээр алдсан</span>
                    {mode !== 'preview' && <span className="text-neutral-400"> — зөв хариултыг харуулахгүй, дахин бодож үзээрэй.</span>}
                  </p>
                  <button
                    onClick={() => setOnlyWrong((o) => !o)}
                    className="rounded-full bg-neutral-800 px-3.5 py-1 text-sm font-medium hover:bg-neutral-700"
                    aria-pressed={onlyWrong}
                  >
                    {onlyWrong ? 'Бүх бодлогыг харах' : 'Зөвхөн алдсанаа харах'}
                  </button>
                </div>
              )}
              {mode === 'student' && (
                <p className="mt-3 text-sm text-neutral-400">
                  Дүн хадгалагдлаа.{' '}
                  <Link href="/results" className="text-blue-400 hover:underline">
                    Миний дүнгүүд
                  </Link>
                </p>
              )}
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
        </div>
      )}

      <ol className="mt-4 space-y-4">
        {attempt.order.map((qi, pos) =>
          onlyWrong && finished && !missed.includes(qi) ? null : (
            <QuestionCard
              key={qi}
              id={`q${pos}`}
              num={pos + 1}
              q={test.questions[qi]}
              chosen={attempt.answers[qi]}
              checked={finished && !!g}
              correct={correctOf(qi)}
              reveal={mode === 'preview'}
              onChoose={finished ? undefined : (ci) => choose(qi, ci)}
            />
          ),
        )}
      </ol>

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
