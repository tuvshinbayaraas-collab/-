import {CheckCircle2, Clock, LogIn, RotateCcw, XCircle} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import MathText from '../components/MathText';
import {clearAttempt, formatTime, loadAttempt, newAttempt, saveAttempt, type Attempt} from '../lib/attempt';
import {signIn, useUser} from '../lib/auth';
import {saveResult} from '../lib/results';
import {Link} from '../lib/router';
import {loadTest, testInfo} from '../tests';
import {LETTERS, type Question, type Test} from '../tests/types';

const correctIndex = (q: Question) => LETTERS.indexOf(q.a);

export default function TestPage({id}: {id: string}) {
  const info = testInfo(id);
  const {user} = useUser();
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [now, setNow] = useState(Date.now());
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setTest(null);
    loadTest(id)?.then((t) => {
      let a = loadAttempt(id, t.questions.length);
      if (!a) {
        a = newAttempt(t.questions.length);
        saveAttempt(id, a); // so a reload keeps this order and the clock
      }
      setTest(t);
      setAttempt(a);
    });
  }, [id]);

  const update = (a: Attempt) => {
    setAttempt(a);
    saveAttempt(id, a);
  };

  const finished = !!attempt?.finished;
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finished]);

  // Store the result once for a signed-in user (also after signing in from the result screen).
  useEffect(() => {
    if (!test || !attempt?.finished || attempt.saved || !user) return;
    const score = attempt.answers.filter((x, i) => x !== null && x === correctIndex(test.questions[i])).length;
    saveResult({
      test: id,
      score,
      total: test.questions.length,
      seconds: Math.round((attempt.finished - attempt.started) / 1000),
      answers: attempt.answers.map((x) => (x === null ? '-' : LETTERS[x])).join(''),
    })
      .then(() => update({...attempt, saved: true}))
      .catch((e) => setSaveError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test, attempt?.finished, attempt?.saved, user?.uid]);

  if (!info) return <p className="py-24 text-center text-neutral-400">Ийм тест олдсонгүй.</p>;
  if (!test || !attempt) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  const total = test.questions.length;
  const answered = attempt.answers.filter((x) => x !== null).length;
  const score = attempt.answers.filter((x, i) => x !== null && x === correctIndex(test.questions[i])).length;
  const elapsed = ((attempt.finished ?? now) - attempt.started) / 1000;

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
    clearAttempt(id);
    setSaveError('');
    update(newAttempt(total));
    window.scrollTo({top: 0});
  };

  const jump = (pos: number) => document.getElementById(`q${pos}`)?.scrollIntoView({behavior: 'smooth', block: 'start'});

  return (
    <div className="mx-auto max-w-4xl">
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
            {finished ? (
              <button onClick={restart} className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-semibold hover:bg-neutral-700">
                <RotateCcw size={16} /> Дахин өгөх
              </button>
            ) : (
              <button onClick={finish} className="rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-black hover:bg-blue-400">
                Дуусгах
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {attempt.order.map((qi, pos) => {
            const chosen = attempt.answers[qi];
            const right = chosen === correctIndex(test.questions[qi]);
            const style = finished
              ? right
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
          <p className="text-sm text-neutral-400">Таны оноо</p>
          <p className="mt-1 text-4xl font-bold">
            {score} <span className="text-2xl text-neutral-400">/ {total}</span>
            <span className="ml-3 text-xl text-neutral-300">{Math.round((score / total) * 100)}%</span>
          </p>
          <p className="mt-1 text-sm text-neutral-400">Зарцуулсан хугацаа: {formatTime(elapsed)}</p>
          {user ? (
            <p className="mt-3 text-sm text-neutral-400">
              {attempt.saved ? 'Дүн хадгалагдлаа. ' : saveError ? <span className="text-red-400">Дүн хадгалж чадсангүй: {saveError} </span> : 'Хадгалж байна… '}
              <Link href="/results" className="text-blue-400 hover:underline">
                Миний дүнгүүд
              </Link>
            </p>
          ) : (
            <button onClick={signIn} className="mt-3 flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-1.5 text-sm font-medium text-blue-400 hover:bg-blue-500/10">
              <LogIn size={16} /> Нэвтэрч дүнгээ хадгалах
            </button>
          )}
        </div>
      )}

      <ol className="mt-4 space-y-4">
        {attempt.order.map((qi, pos) => (
          <QuestionCard key={qi} pos={pos} q={test.questions[qi]} chosen={attempt.answers[qi]} finished={finished} onChoose={(ci) => choose(qi, ci)} />
        ))}
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

function QuestionCard(props: {pos: number; q: Question; chosen: number | null; finished: boolean; onChoose: (ci: number) => void}) {
  const {pos, q, chosen, finished, onChoose} = props;
  const correct = correctIndex(q);
  const figures = q.c.some((c) => typeof c !== 'string');
  const render = (c: string | ReactNode) => (typeof c === 'string' ? <MathText text={c} display /> : c);

  return (
    <li id={`q${pos}`} className="scroll-mt-36 rounded-2xl bg-neutral-900 p-4 sm:p-5">
      <div className="flex gap-2 leading-relaxed">
        <span className="shrink-0 font-bold">{pos + 1}.</span>
        <MathText text={q.q} className="min-w-0 [overflow-wrap:anywhere]" />
      </div>
      {q.fig && <div className="mt-3 flex justify-center text-neutral-200">{q.fig}</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {q.c.map((c, ci) => {
          const picked = chosen === ci;
          let style = picked ? 'border-blue-500 bg-blue-500/15' : 'border-neutral-700 hover:border-neutral-500';
          if (finished) {
            if (ci === correct) style = 'border-green-500 bg-green-500/15';
            else if (picked) style = 'border-red-500 bg-red-500/15';
            else style = 'border-neutral-800 opacity-70';
          }
          return (
            <button
              key={ci}
              onClick={() => onChoose(ci)}
              disabled={finished}
              aria-pressed={picked}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${figures ? 'flex-[1_1_9rem] flex-col' : 'min-w-[5.5rem] flex-[1_1_auto]'} ${style}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${picked ? 'bg-blue-500 text-black' : 'bg-neutral-800'}`}>
                {LETTERS[ci]}
              </span>
              <span className="whitespace-nowrap">{render(c)}</span>
            </button>
          );
        })}
      </div>
      {finished && chosen !== correct && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          {chosen === null ? (
            <span className="text-neutral-400">Хариулаагүй.</span>
          ) : (
            <>
              <XCircle size={16} className="text-red-400" /> Таны хариулт: {LETTERS[chosen]}.
            </>
          )}
          <span className="text-green-400">Зөв хариулт: {LETTERS[correct]}</span>
        </p>
      )}
      {finished && chosen === correct && (
        <p className="mt-3 flex items-center gap-2 text-sm text-green-400">
          <CheckCircle2 size={16} /> Зөв
        </p>
      )}
    </li>
  );
}
