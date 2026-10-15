import {AlertTriangle, Check, CloudOff, Timer} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import QuestionCard from '../components/QuestionCard';
import {QuestionList, useJump} from '../components/QuestionList';
import {formatDuration, formatTime} from '../lib/attempt';
import {examState, saveExam, type Exam, type ExamAnswer} from '../lib/exams';
import {choiceAt, encode, grade, percent, useKeys} from '../lib/keys';
import {ask, useLeaveCounter} from '../lib/leaves';
import {usePrefs} from '../lib/prefs';
import {Link} from '../lib/router';
import {clock, serverNow, useNow} from '../lib/time';
import {loadTest, testInfo} from '../tests';
import type {Test} from '../tests/types';

interface ExamAttempt {
  order: number[];
  answers: (number | null)[];
  leaves: number;
  /** Milliseconds away from the page. */
  away: number;
  /** Server time when this student opened the exam. */
  started: number;
}

const storeKey = (uid: string, test: string, start: number) => `batnab.exam.${uid}.${test}.${start}`;

function load(key: string, count: number): ExamAttempt | null {
  try {
    const a = JSON.parse(localStorage.getItem(key) ?? 'null') as ExamAttempt | null;
    return a && a.order?.length === count && a.answers?.length === count ? a : null;
  } catch {
    return null;
  }
}

function keep(key: string, a: ExamAttempt) {
  try {
    localStorage.setItem(key, JSON.stringify(a));
  } catch {
    // the server copy is what counts
  }
}

function shuffled(count: number) {
  const order = Array.from({length: count}, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** A scheduled exam for one student: once, until the end time, saved as they go. */
export default function ExamRunner({id, exam, uid, saved}: {id: string; exam: Exam; uid: string; saved: ExamAnswer | null}) {
  const info = testInfo(id)!;
  const key = storeKey(uid, id, exam.start);
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [onlyWrong, setOnlyWrong] = useState(false);
  const {full, jump} = useJump(() => setOnlyWrong(false));
  const prefs = usePrefs();
  const [submitted, setSubmitted] = useState(false);
  const now = useNow(1000);
  const state = examState(exam, now);
  const done = !!saved?.done;
  const hasRecord = useRef(saved !== null);
  const queue = useRef(Promise.resolve());
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<ExamAttempt | null>(null);
  latest.current = attempt;

  useEffect(() => {
    loadTest(id)?.then((t) => {
      const n = t.questions.length;
      let a = load(key, n);
      if (!a) {
        a = {order: shuffled(n), answers: Array(n).fill(null), leaves: 0, away: 0, started: serverNow()};
        // Opened on another device before: carry on from what the server has.
        if (saved) a = {...a, answers: a.answers.map((_, i) => choiceAt(saved.answers, i)), leaves: saved.leaves, away: saved.away};
        keep(key, a);
      }
      setTest(t);
      setAttempt(a);
    });
    // The saved copy only seeds a fresh device; later updates come from this page itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);

  /** Sends the current answers; saves run one after another so the first one (which records the start) is never raced. */
  const send = (finish = false) => {
    clearTimeout(debounce.current);
    const a = latest.current;
    if (!a) return queue.current;
    setStatus('saving');
    queue.current = queue.current
      .then(() =>
        saveExam(id, {answers: encode(a.answers), leaves: a.leaves, away: a.away, seconds: (serverNow() - a.started) / 1000, done: finish}, !hasRecord.current),
      )
      .then(() => {
        hasRecord.current = true;
        setStatus('saved');
      })
      .catch(() => setStatus('error'));
    return queue.current;
  };

  const change = (f: (a: ExamAttempt) => ExamAttempt, now = false) => {
    const prev = latest.current;
    if (!prev) return;
    const next = f(prev);
    latest.current = next; // so the save below (and a quick second change) see it before React re-renders
    keep(key, next);
    setAttempt(next);
    clearTimeout(debounce.current);
    if (now) send();
    else debounce.current = setTimeout(() => send(), 1200);
  };

  const active = state === 'active' && !done && !!attempt;

  // Mark the start for the teacher as soon as the exam is open on this page.
  useEffect(() => {
    if (active && !hasRecord.current) send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useLeaveCounter(
    active,
    () => change((a) => ({...a, leaves: a.leaves + 1}), true),
    (ms) => change((a) => ({...a, away: a.away + ms}), true),
  );

  // Time is up: hand in whatever is answered.
  const handedIn = useRef(false);
  useEffect(() => {
    if (!attempt || done || handedIn.current || now < exam.end) return;
    handedIn.current = true;
    setSubmitted(true);
    send(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now >= exam.end, attempt !== null, done]);

  const ended = state === 'ended';
  const keys = useKeys(ended && saved ? [id] : []);
  const answerKey = ended ? keys[id] : undefined;

  if (!test || !attempt) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  const total = test.questions.length;
  const shown = done || ended ? (saved ? saved.answers : encode(attempt.answers)) : encode(attempt.answers);
  const chosen = (qi: number) => choiceAt(shown, qi);
  const answered = [...shown].filter((c) => c !== '-').length;
  const g = answerKey ? grade(shown, answerKey, total) : null;
  const correctOf = (qi: number) => (g ? choiceAt(answerKey, qi) : null);
  const missed = attempt.order.filter((qi) => correctOf(qi) !== null && chosen(qi) !== correctOf(qi));
  const left = exam.end - now;
  const leaves = saved && (done || ended) ? saved.leaves : attempt.leaves;

  const choose = (qi: number, ci: number) => {
    const picked = attempt.answers[qi] !== ci;
    change((a) => ({...a, answers: a.answers.map((x, i) => (i === qi ? (x === ci ? null : ci) : x))}));
    // "Дараагийн бодлого руу шилжих" setting.
    const pos = attempt.order.indexOf(qi);
    if (prefs.autoNext && picked && pos + 1 < total) setTimeout(() => jump(pos + 1), 250);
  };

  const finish = () => {
    const empty = total - answered;
    if (!ask(`${empty ? `${empty} бодлого хариулаагүй байна. ` : ''}Шалгалтаа дуусгах уу? Дараа нь засах боломжгүй.`)) return;
    handedIn.current = true;
    setSubmitted(true);
    send(true);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const finished = done || ended || submitted;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="sticky top-14 z-20 -mx-4 border-b border-neutral-800 bg-[#0f0f0f]/95 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-lg font-bold">Шалгалт: {info.title}</h1>
          <span className="text-sm text-neutral-400">
            {answered}/{total} хариулсан
          </span>
          {!finished && (
            <span className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${left < 5 * 60_000 ? 'text-red-400' : 'text-neutral-200'}`}>
              <Timer size={15} /> {formatTime(left / 1000)} үлдлээ
            </span>
          )}
          {leaves > 0 && (
            <span className="flex items-center gap-1 text-sm text-amber-300">
              <AlertTriangle size={14} /> {leaves} удаа гарсан
            </span>
          )}
          {!finished && (
            <span className="text-xs text-neutral-500" aria-live="polite">
              {status === 'error' ? (
                <span className="flex items-center gap-1 text-red-400">
                  <CloudOff size={13} /> Хадгалагдаагүй — интернэтээ шалгана уу
                </span>
              ) : status === 'saved' ? (
                <span className="flex items-center gap-1">
                  <Check size={13} /> Хадгалагдсан
                </span>
              ) : status === 'saving' ? (
                'Хадгалж байна…'
              ) : null}
            </span>
          )}
          {!finished && (
            <button onClick={finish} className="ml-auto rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-black hover:bg-blue-400">
              Дуусгах
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible">
          {attempt.order.map((qi, pos) => {
            const c = chosen(qi);
            const right = correctOf(qi);
            const style =
              finished && right !== null ? (c === right ? 'bg-green-600 text-white' : 'bg-red-600/80 text-white') : c !== null ? 'bg-blue-500 text-black' : 'bg-neutral-800 text-neutral-300';
            return (
              <button key={qi} onClick={() => jump(pos)} className={`h-7 min-w-7 shrink-0 rounded-md px-1 text-xs font-semibold ${style}`} aria-label={`${pos + 1}-р бодлого`}>
                {pos + 1}
              </button>
            );
          })}
        </div>
      </div>

      {!finished && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${leaves ? 'bg-red-500/10 text-red-200' : 'bg-neutral-900 text-neutral-300'}`}>
          {leaves ? (
            <p className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Та шалгалтын үеэр хуудаснаас {leaves} удаа гарсан байна. Багш үүнийг харж байгаа.
            </p>
          ) : (
            <p>
              Шалгалт {clock(exam.start)}–{clock(exam.end)}. Хариулт тань автоматаар хадгалагдана, хугацаа дуусахад өөрөө илгээгдэнэ. Өөр таб эсвэл апп руу шилжвэл
              тоологдож багшид харагдана.
            </p>
          )}
        </div>
      )}

      {finished && (
        <div className="mt-4 rounded-2xl bg-neutral-900 p-5">
          {!ended && !done ? (
            status === 'error' ? (
              <div>
                <p className="flex items-center gap-2 text-red-400">
                  <CloudOff size={18} /> Шалгалтыг илгээж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.
                </p>
                <button onClick={() => send(true)} className="mt-3 rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-black hover:bg-blue-400">
                  Дахин илгээх
                </button>
              </div>
            ) : (
              <p className="text-neutral-400">Илгээж байна…</p>
            )
          ) : !ended ? (
            <>
              <p className="flex items-center gap-2 text-lg font-semibold">
                <Check size={20} className="text-green-400" /> Шалгалтаа өгсөн
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                {answered}/{total} бодлогод хариулсан. Дүн шалгалт дуусахад ({clock(exam.end)}) гарна.
              </p>
            </>
          ) : !saved ? (
            <p className="text-neutral-400">Шалгалт дууссан.</p>
          ) : answerKey === undefined ? (
            <p className="text-neutral-400">Дүнг тооцож байна…</p>
          ) : !g ? (
            <p className="text-neutral-400">Шалгалт дууссан. Багш зөв хариултыг оруулсны дараа дүн гарна.</p>
          ) : (
            <div>
              <p className="text-sm text-neutral-400">Шалгалтын оноо</p>
              <p className="mt-1 text-4xl font-bold">
                {g.score} <span className="text-2xl text-neutral-400">/ {g.total}</span>
                <span className="ml-3 text-xl text-neutral-300">{percent(g)}%</span>
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                Зарцуулсан хугацаа: {formatDuration(saved.seconds)}
                {!saved.done && ' • хугацаа дуусахад автоматаар илгээгдсэн'}
              </p>
              {missed.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-sm">
                    <span className="font-medium text-red-300">{missed.length} бодлого дээр алдсан</span>
                  </p>
                  <button onClick={() => setOnlyWrong((o) => !o)} aria-pressed={onlyWrong} className="rounded-full bg-neutral-800 px-3.5 py-1 text-sm font-medium hover:bg-neutral-700">
                    {onlyWrong ? 'Бүх бодлогыг харах' : 'Зөвхөн алдсанаа харах'}
                  </button>
                </div>
              )}
            </div>
          )}
          {ended && (
            <Link href={`/test/${id}?practice=1`} className="mt-4 inline-block text-sm text-blue-400 hover:underline">
              Энэ тестийг дасгал болгож дахин өгөх
            </Link>
          )}
        </div>
      )}

      <QuestionList full={full}>
        {attempt.order.map((qi, pos) =>
          onlyWrong && finished && !missed.includes(qi) ? null : (
            <QuestionCard
              key={qi}
              id={`q${pos}`}
              num={pos + 1}
              q={test.questions[qi]}
              chosen={chosen(qi)}
              checked={finished && !!g}
              correct={correctOf(qi)}
              onChoose={finished ? undefined : (ci) => choose(qi, ci)}
            />
          ),
        )}
      </QuestionList>

      {!finished && (
        <div className="mt-6 flex justify-center">
          <button onClick={finish} className="rounded-full bg-blue-500 px-8 py-2.5 font-semibold text-black hover:bg-blue-400">
            Шалгалтаа дуусгах
          </button>
        </div>
      )}
    </div>
  );
}

/** Before the start: the test stays closed, with a countdown. */
export function ExamWait({id, exam, now}: {id: string; exam: Exam; now: number}) {
  const info = testInfo(id)!;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <Timer size={36} className="mb-3 text-neutral-500" />
      <h1 className="text-xl font-semibold">Шалгалт: {info.title}</h1>
      <p className="mt-2 text-neutral-400">
        {clock(exam.start)}–{clock(exam.end)}. Эхлэхэд үлдсэн хугацаа:
      </p>
      <p className="mt-2 text-4xl font-bold tabular-nums">{formatTime((exam.start - now) / 1000)}</p>
      <p className="mt-4 text-sm text-neutral-500">Цаг болоход бодлогууд энд автоматаар гарч ирнэ. Шалгалтын үеэр өөр таб эсвэл апп руу шилжвэл тоологдоно.</p>
    </div>
  );
}
