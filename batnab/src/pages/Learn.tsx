import {ArrowLeft, BookOpenCheck, Check, ChevronRight, Eye, Footprints, Lightbulb, Lock, PencilLine} from 'lucide-react';
import {Fragment, useEffect, useRef, useState} from 'react';
import AskButton from '../components/Ask';
import Loading from '../components/Loading';
import MathText from '../components/MathText';
import {CenterNote, InactiveNote, LockedNote} from '../components/Notices';
import QuestionCard from '../components/QuestionCard';
import {QuestionList, useJump} from '../components/QuestionList';
import {useExams} from '../lib/exams';
import {focusOn} from '../lib/focus';
import {grade, useKeys} from '../lib/keys';
import {setLearnDone, useLearnDone, useLearnIndex, useSolutions, type Solution} from '../lib/learn';
import {useMyResults} from '../lib/results';
import {Link, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {useNow} from '../lib/time';
import {TESTS, testInfo} from '../tests';
import {skillOf, SKILLS} from '../tests/skills';
import {CODES, LETTERS, type Test} from '../tests/types';
import {useTest} from './admin/useTest';

/** /learn — «Сурах»: the tests whose problems are solved step by step; /learn/{test}: one test's. */
export default function Learn({test}: {test?: string}) {
  const session = useSession();
  const allowed = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  if (session.ready && !session.user) return <LockedNote text="Бодолтыг харахын тулд нэвтэрнэ үү." />;
  if (session.ready && !allowed) return <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!allowed) return <Loading />;
  return test ? <TestSolutions id={test} /> : <Hub />;
}

function Hub() {
  const session = useSession();
  const index = useLearnIndex();
  const learnt = useLearnDone(session.admin ? undefined : session.user?.uid);
  if (!index) return <Loading />;
  const tests = TESTS.filter((t) => index[t.id]);
  const uid = session.admin ? undefined : session.user?.uid;
  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-6">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <BookOpenCheck size={18} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Сурах</h1>
          <p className="text-sm text-neutral-400">Тестийн бодлого бүрийн бодолт</p>
        </div>
      </header>
      {tests.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tests.map((t) => {
            const done = learnt?.[t.id]?.size ?? 0;
            return (
              <li key={t.id}>
                <Link href={`/learn/${t.id}`} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800/80" data-learn-test={t.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold">{t.title}</span>
                    <span className="block text-sm text-neutral-400">
                      {index[t.id].n} бодлогын бодолт{uid && done > 0 ? ` · ${done} ойлгосон` : ''}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-neutral-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-neutral-900 p-4 text-sm text-neutral-400">
          {session.admin ? 'Бодолт оруулаагүй байна. Багшийн самбарын Түлхүүр хэсгээс тест бүрийн бодолтыг оруулна.' : 'Одоогоор бодолт алга.'}
        </p>
      )}
    </div>
  );
}

/** How many parts a solution opens in: its rule (the hint), then each step. */
const partsOf = (s: Solution) => (s.rule ? 1 : 0) + s.steps.length;
type Filter = 'all' | 'missed' | 'todo';

function TestSolutions({id}: {id: string}) {
  const session = useSession();
  const student = !session.admin;
  const uid = session.user?.uid;
  const info = testInfo(id);
  const test = useTest(info ? id : '');
  const solutions = useSolutions(info ? id : undefined);
  const exam = useExams()?.[id];
  const now = useNow(30_000);
  // How far each problem's solution is open: 0 closed; then its rule, then a step at a time; partsOf = all of it.
  const [level, setLevel] = useState<Record<number, number>>({});
  const [filter, setFilter] = useState<Filter>('all');
  // The problems they marked «Ойлголоо», kept on the account. A tap shows at once (Firebase's local event).
  const learnt = useLearnDone(student ? uid : undefined);
  const done = learnt?.[id] ?? new Set<number>();
  const toggleDone = (n: number) => {
    if (student && uid) setLearnDone(uid, id, n, !done.has(n)).catch(() => alert('Хадгалж чадсангүй. Дахин оролдоно уу.'));
  };
  // The student's last go at the test this week, against the key: what they got, and the problems they missed.
  const results = useMyResults();
  const last = student ? results?.filter((r) => r.test === id).sort((a, b) => b.at - a.at)[0] : undefined;
  const key = useKeys(last ? [id] : [])[id] ?? null;
  const {full, jump} = useJump(() => setFilter('all'));
  // Opened at one problem (?n=5, from a test's result): that one open in full and brought into view.
  const focus = Number(useLocation().query.get('n')) || 0;
  const focused = useRef(0);
  useEffect(() => {
    if (!focus || focused.current === focus || !test || !solutions || solutions === 'locked' || !solutions[focus]) return;
    const el = document.getElementById(`q${focus}`);
    if (!el) return;
    focused.current = focus;
    setLevel((l) => ({...l, [focus]: partsOf(solutions[focus])}));
    focusOn(el);
  });

  if (!info) return <CenterNote title="Ийм тест алга" />;
  if (solutions === null || !test) return <Loading />;
  if (student && learnt === null) return <Loading />;
  const back = (
    <Link href="/learn" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
      <ArrowLeft size={16} /> Сурах
    </Link>
  );
  if (solutions === 'locked') {
    const examOn = !!exam && now <= exam.end;
    return (
      <div className="mx-auto max-w-2xl py-4 sm:py-6">
        {back}
        <div className="mt-3 rounded-2xl bg-neutral-900 p-5 text-center" data-learn-locked>
          <Lock size={28} className="mx-auto text-neutral-500" />
          <h1 className="mt-2 text-lg font-semibold">{info.title} · бодолт</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {examOn ? 'Энэ тестээр шалгалт явагдаж байна. Шалгалт дууссаны дараа бодолт нээгдэнэ.' : `${info.title}-г өгсний дараа бодолт энд нээгдэнэ.`}
          </p>
          {!examOn && (
            <Link href={`/test/${id}`} className="mt-4 inline-block rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400">
              Тест өгөх
            </Link>
          )}
        </div>
      </div>
    );
  }
  const numbers = test.questions.map((_, i) => i + 1).filter((n) => solutions[n]);
  if (!numbers.length) return <CenterNote title={`${info.title}-гийн бодолт одоогоор алга`} />;

  const g = last && key ? grade(last.answers, key, info.count) : null;
  // Their answer to each problem they got wrong ('-': none).
  const missed = new Map<number, string>();
  if (last && key)
    for (let i = 0; i < info.count; i++) {
      const k = key[i];
      if (k && k !== '-' && CODES.includes(k) && (last.answers[i] ?? '-') !== k) missed.set(i + 1, last.answers[i] ?? '-');
    }
  const missedShown = numbers.filter((n) => missed.has(n));
  const todo = numbers.filter((n) => !done.has(n));
  const shown = (n: number) => !!solutions[n] && (filter === 'all' || (filter === 'missed' ? missed.has(n) : !done.has(n)));
  const isFull = (n: number) => (level[n] ?? 0) >= partsOf(solutions[n]);
  const allOpen = numbers.every(isFull);
  const filters: [Filter, string, number][] = [
    ['all', 'Бүгд', numbers.length],
    ...(missedShown.length ? ([['missed', 'Алдсан', missedShown.length]] as [Filter, string, number][]) : []),
    ...(student ? ([['todo', 'Ойлгоогүй', todo.length]] as [Filter, string, number][]) : []),
  ];

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      {back}
      <div className="mt-2 rounded-2xl bg-neutral-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Сурах</p>
        <h1 className="text-xl font-bold">{info.title}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {numbers.length} бодлогын бодолт. Эхлээд өөрөө бодоорой. Гацвал сануулга аваад, дараа нь бодолтыг алхам алхмаар нээгээрэй.
          {session.admin && ' Сурагч энэ тестийг өгсний дараа харна.'}
        </p>
        {g && (
          <p className="mt-2 text-sm" data-learn-score>
            Сүүлд өгөхдөө <b>{g.score}/{g.total}</b> авсан.
            {missed.size > 0 && <span className="text-red-300"> Алдсан {missed.size} бодлогоо эхэлж үзээрэй.</span>}
          </p>
        )}
        {student && (
          <div className="mt-3" data-learn-progress>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-300">Ойлгосон</span>
              <span className="font-semibold tabular-nums">
                {numbers.length - todo.length}/{numbers.length}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-800" aria-hidden>
              <div className="h-full rounded-full bg-green-500" style={{width: `${((numbers.length - todo.length) / numbers.length) * 100}%`}} />
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {filters.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Аль бодлогыг харах">
              {filters.map(([f, label, count]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 text-sm ${filter === f ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}
                  data-learn-filter={f}
                >
                  {label} <span className={filter === f ? 'text-emerald-200' : 'text-neutral-400'}>{count}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setLevel(allOpen ? {} : Object.fromEntries(numbers.map((n) => [n, partsOf(solutions[n])])))}
            className="ml-auto rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700"
            data-learn-all
          >
            {allOpen ? 'Бүгдийг хаах' : 'Бүгдийг нээх'}
          </button>
        </div>
        <nav aria-label="Бодлогууд" className="mt-3 flex flex-wrap gap-1.5">
          {test.questions.map((_, i) => {
            const n = i + 1;
            const miss = missed.has(n);
            const ok = done.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  if (!shown(n)) setFilter('all');
                  jump(n);
                }}
                aria-label={`${n}-р бодлого${miss ? ', алдсан' : ''}${ok ? ', ойлгосон' : ''}`}
                className={`h-8 w-8 rounded-full text-sm font-medium tabular-nums ${ok ? 'bg-green-500/20 text-green-200' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'} ${miss ? 'ring-2 ring-red-400/70' : ''}`}
                data-learn-no={n}
              >
                {n}
              </button>
            );
          })}
        </nav>
        {(missed.size > 0 || student) && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400" aria-hidden>
            {missed.size > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full ring-2 ring-red-400/70" /> алдсан
              </span>
            )}
            {student && (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-green-500/40" /> ойлгосон
              </span>
            )}
          </p>
        )}
      </div>
      <QuestionList full={full || !!focus}>
        {test.questions.map((q, i) => {
          const n = i + 1;
          const s = solutions[n];
          if (!s) return null;
          if (!shown(n)) return null;
          const lv = level[n] ?? 0;
          return (
            <QuestionCard
              key={i}
              id={`q${n}`}
              num={n}
              q={q}
              chosen={lv >= partsOf(s) ? CODES.indexOf(s.a) : null}
              keyMode
              footer={
                <SolutionPanel
                  n={n}
                  s={s}
                  test={test}
                  level={lv}
                  setLevel={(l) => setLevel((m) => ({...m, [n]: l}))}
                  topic={skillOf(id, i) ? SKILLS[skillOf(id, i)!] : undefined}
                  theirs={missed.get(n)}
                  done={student ? done.has(n) : undefined}
                  onDone={() => toggleDone(n)}
                  ask={student ? {s: 't', t: id, q: String(i), label: `${info.title} · ${n}-р бодлого`} : undefined}
                />
              }
            />
          );
        })}
      </QuestionList>
      {filter !== 'all' && numbers.every((n) => !shown(n)) && (
        <p className="mt-4 rounded-2xl bg-neutral-900 p-4 text-center text-sm text-neutral-400">{filter === 'todo' ? 'Бүх бодлогыг ойлгосон байна.' : 'Алдсан бодлого алга.'}</p>
      )}
    </div>
  );
}

// Where a formula on its own line may break on a narrow screen: between its parts (\qquad), then before a relation.
const GAP = /^\\qquad(?![a-zA-Z])/;
const RELATION = /^(=|<|>|\\(le|ge|approx|ne)(?![a-zA-Z]))/;

/** `tex` cut at `sep` where it isn't inside braces, \left…\right or \begin…\end (`keep`: the cut starts the next part). */
function splitTop(tex: string, sep: RegExp, keep: boolean) {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  let i = 0;
  while (i < tex.length) {
    const rest = tex.slice(i);
    const m = depth === 0 && i > from ? sep.exec(rest) : null;
    if (m) {
      parts.push(tex.slice(from, i));
      from = keep ? i : i + m[0].length;
      i += m[0].length;
      continue;
    }
    if (tex[i] === '\\') {
      const cmd = /^\\([a-zA-Z]+|.?)/.exec(rest)![0];
      if (cmd === '\\left' || cmd === '\\begin') depth++;
      else if (cmd === '\\right' || cmd === '\\end') depth--;
      i += Math.max(1, cmd.length);
      continue;
    }
    if (tex[i] === '{') depth++;
    else if (tex[i] === '}') depth--;
    i++;
  }
  parts.push(tex.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * A formula on its own line. On a narrow screen it breaks only between its parts and before =, ≤, <…, never inside
 * a bracket or a fraction; what still doesn't fit scrolls sideways.
 */
function Formula({tex}: {tex: string}) {
  return (
    <div className="my-1.5 overflow-x-auto overflow-y-hidden py-1 text-center">
      {splitTop(tex, GAP, false).map((group, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="mx-2 inline-block">
            {splitTop(group, RELATION, true).map((part, j) => (
              <Fragment key={j}>
                {j > 0 && ' '}
                <span className="inline-block whitespace-nowrap">
                  <MathText text={`$${part}$`} display />
                </span>
              </Fragment>
            ))}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

/** A text of lines: each a paragraph, a $$…$$ line a formula on its own. */
function Lines({text}: {text: string}) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        const formula = /^\$\$([\s\S]+)\$\$$/.exec(t);
        return formula ? (
          <Formula key={i} tex={formula[1]} />
        ) : (
          <p key={i} className="[overflow-wrap:anywhere]">
            <MathText text={t} />
          </p>
        );
      })}
    </>
  );
}

const button = 'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium';

/**
 * One problem's way to the answer, given a bit at a time so the student keeps thinking: first the rule it rests on,
 * then each step, then the check, the slip to watch for, the answer and a problem of the same kind to try. «Ойлголоо»
 * marks it learnt; «Багшаас асуух» is there for what still isn't clear.
 */
function SolutionPanel(props: {
  n: number;
  s: Solution;
  test: Test;
  level: number;
  setLevel: (l: number) => void;
  topic?: string;
  theirs?: string;
  done?: boolean;
  onDone: () => void;
  ask?: {s: 't'; t: string; q: string; label: string};
}) {
  const {n, s, test, level, setLevel, topic, theirs, done, onDone, ask} = props;
  const [tryOpen, setTryOpen] = useState(false);
  const parts = partsOf(s);
  const full = level >= parts;
  const ruleShown = !!s.rule && level >= 1;
  const stepsShown = full ? s.steps.length : Math.max(0, level - (s.rule ? 1 : 0));
  const ci = CODES.indexOf(s.a);
  const choice = test.questions[n - 1]?.c[ci];
  return (
    <div className="w-full text-left" data-solution={n}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
        {topic && <span>Сэдэв: {topic}</span>}
        {theirs !== undefined && (
          <span className="font-medium text-red-300" data-theirs>
            {theirs === '-' ? 'Хариулаагүй' : `Таны хариулт: ${LETTERS[CODES.indexOf(theirs)] ?? theirs}`}
          </span>
        )}
      </p>
      {level === 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {s.rule ? (
            <button type="button" onClick={() => setLevel(1)} className={`${button} bg-sky-500/15 text-sky-200 hover:bg-sky-500/25`} data-step="hint">
              <Lightbulb size={15} /> Сануулга
            </button>
          ) : (
            <button type="button" onClick={() => setLevel(1)} className={`${button} bg-sky-500/15 text-sky-200 hover:bg-sky-500/25`} data-step="next">
              <Footprints size={15} /> Эхний алхам
            </button>
          )}
          <button type="button" onClick={() => setLevel(parts)} className={`${button} bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25`} data-step="all">
            <Eye size={15} /> Бодолтыг харах
          </button>
        </div>
      )}
      {level > 0 && (
        <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-neutral-200">
          {ruleShown && (
            <section className="rounded-xl bg-neutral-800/60 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-300">Сануулга</h3>
              <div className="mt-1 space-y-1">
                <Lines text={s.rule!} />
              </div>
            </section>
          )}
          {stepsShown > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Бодолт</h3>
              <ol className="mt-2 space-y-3">
                {s.steps.slice(0, stepsShown).map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-200" aria-hidden>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Lines text={step} />
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {!full && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLevel(level + 1)} className={`${button} bg-sky-500/15 text-sky-200 hover:bg-sky-500/25`} data-step="next">
                <Footprints size={15} /> {stepsShown === 0 ? 'Эхний алхам' : `Дараагийн алхам (${stepsShown + 1}/${s.steps.length})`}
              </button>
              <button type="button" onClick={() => setLevel(parts)} className={`${button} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`} data-step="all">
                <Eye size={15} /> Бүгдийг харах
              </button>
            </div>
          )}
          {full && (
            <>
              {s.check && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300">Шалгах</h3>
                  <div className="mt-1 space-y-1">
                    <Lines text={s.check} />
                  </div>
                </section>
              )}
              {s.note && (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300">Санамж</h3>
                  <div className="mt-1 space-y-1 text-amber-100">
                    <Lines text={s.note} />
                  </div>
                </section>
              )}
              <p className="flex flex-wrap items-center gap-2 font-semibold" data-answer={s.a}>
                <span className="text-neutral-400">Хариу:</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-black">{LETTERS[ci]}</span>
                {typeof choice === 'string' && <MathText text={choice} display />}
              </p>
              {s.try && (
                <section className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3" data-try>
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-300">
                    <PencilLine size={14} /> Өөрөө бодоод үз
                  </h3>
                  <div className="mt-1 space-y-1">
                    <Lines text={s.try.q} />
                  </div>
                  {tryOpen ? (
                    <div className="mt-2 space-y-1 border-t border-violet-500/20 pt-2" data-try-answer>
                      <p className="font-semibold">
                        Хариу: <MathText text={s.try.a} />
                      </p>
                      {s.try.s && <Lines text={s.try.s} />}
                    </div>
                  ) : (
                    <button type="button" onClick={() => setTryOpen(true)} className={`${button} mt-2 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25`}>
                      Хариуг харах
                    </button>
                  )}
                </section>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {done !== undefined && (
                  <button
                    type="button"
                    onClick={onDone}
                    aria-pressed={done}
                    className={`${button} ${done ? 'bg-green-500 text-black hover:bg-green-400' : 'border border-green-500/50 text-green-200 hover:bg-green-500/10'}`}
                    data-done
                  >
                    <Check size={15} /> {done ? 'Ойлгосон' : 'Ойлголоо'}
                  </button>
                )}
                {ask && <AskButton ctx={ask} />}
                <button type="button" onClick={() => setLevel(0)} className={`${button} ml-auto text-neutral-400 hover:bg-neutral-800`}>
                  Хаах
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
