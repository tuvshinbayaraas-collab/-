import {ArrowLeft, BookOpenCheck, ChevronDown, ChevronRight, Lightbulb, Lock} from 'lucide-react';
import {Fragment, useEffect, useRef, useState} from 'react';
import Loading from '../components/Loading';
import MathText from '../components/MathText';
import {CenterNote, InactiveNote, LockedNote} from '../components/Notices';
import QuestionCard from '../components/QuestionCard';
import {QuestionList, useJump} from '../components/QuestionList';
import {useExams} from '../lib/exams';
import {focusOn} from '../lib/focus';
import {useLearnIndex, useSolutions, type Solution} from '../lib/learn';
import {Link, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {useNow} from '../lib/time';
import {TESTS, testInfo} from '../tests';
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
  if (!index) return <Loading />;
  const tests = TESTS.filter((t) => index[t.id]);
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
          {tests.map((t) => (
            <li key={t.id}>
              <Link href={`/learn/${t.id}`} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800/80" data-learn-test={t.id}>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold">{t.title}</span>
                  <span className="block text-sm text-neutral-400">{index[t.id].n} бодлогын бодолт</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-neutral-900 p-4 text-sm text-neutral-400">
          {session.admin ? 'Бодолт оруулаагүй байна. Багшийн самбарын Түлхүүр хэсгээс тест бүрийн бодолтыг оруулна.' : 'Одоогоор бодолт алга.'}
        </p>
      )}
    </div>
  );
}

function TestSolutions({id}: {id: string}) {
  const session = useSession();
  const info = testInfo(id);
  const test = useTest(info ? id : '');
  const solutions = useSolutions(info ? id : undefined);
  const exam = useExams()?.[id];
  const now = useNow(30_000);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const {full, jump} = useJump(() => {});
  // Opened at one problem (?n=5, from a test's result): that one open and brought into view.
  const focus = Number(useLocation().query.get('n')) || 0;
  const focused = useRef(0);
  useEffect(() => {
    if (!focus || focused.current === focus || !test || !solutions || solutions === 'locked') return;
    const el = document.getElementById(`q${focus}`);
    if (!el) return;
    focused.current = focus;
    setOpen((o) => new Set(o).add(focus));
    focusOn(el);
  });

  if (!info) return <CenterNote title="Ийм тест алга" />;
  if (solutions === null || !test) return <Loading />;
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
  const count = Object.keys(solutions).length;
  if (!count) return <CenterNote title={`${info.title}-гийн бодолт одоогоор алга`} />;
  const all = test.questions.map((_, i) => i + 1).filter((n) => solutions[n]);
  const allOpen = all.every((n) => open.has(n));
  const toggle = (n: number) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-6">
      {back}
      <div className="mt-2 rounded-2xl bg-neutral-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Сурах</p>
        <h1 className="text-xl font-bold">{info.title}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {count} бодлогын бодолт. Эхлээд өөрөө бодоод, дараа нь бодолтыг нээж хараарай.
          {session.admin && ' Сурагч энэ тестийг өгсний дараа харна.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(all))}
            className="rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700"
            data-learn-all
          >
            {allOpen ? 'Бүгдийг хаах' : 'Бүгдийг нээх'}
          </button>
        </div>
        <nav aria-label="Бодлогууд" className="mt-3 flex flex-wrap gap-1.5">
          {test.questions.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jump(i + 1)}
              aria-label={`${i + 1}-р бодлого`}
              className={`h-8 w-8 rounded-full text-sm font-medium tabular-nums ${open.has(i + 1) ? 'bg-emerald-500/20 text-emerald-200' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      </div>
      <QuestionList full={full || !!focus}>
        {test.questions.map((q, i) => {
          const n = i + 1;
          const s = solutions[n];
          const shown = !!s && open.has(n);
          return (
            <QuestionCard
              key={i}
              id={`q${n}`}
              num={n}
              q={q}
              chosen={shown ? CODES.indexOf(s.a) : null}
              keyMode
              footer={s ? <SolutionPanel n={n} s={s} test={test} shown={shown} onToggle={() => toggle(n)} /> : <p className="text-sm text-neutral-500">Энэ бодлогын бодолт алга.</p>}
            />
          );
        })}
      </QuestionList>
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

function SolutionPanel({n, s, test, shown, onToggle}: {n: number; s: Solution; test: Test; shown: boolean; onToggle: () => void}) {
  const ci = CODES.indexOf(s.a);
  const choice = test.questions[n - 1]?.c[ci];
  return (
    <div className="w-full text-left" data-solution={n}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={shown}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${shown ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'}`}
      >
        <Lightbulb size={15} /> {shown ? 'Бодолтыг хаах' : 'Бодолтыг харах'}
        <ChevronDown size={15} className={shown ? 'rotate-180' : ''} />
      </button>
      {shown && (
        <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-neutral-200">
          {s.rule && (
            <section className="rounded-xl bg-neutral-800/60 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-300">Дүрэм</h3>
              <div className="mt-1 space-y-1">
                <Lines text={s.rule} />
              </div>
            </section>
          )}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Бодолт</h3>
            <ol className="mt-2 space-y-3">
              {s.steps.map((step, i) => (
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
        </div>
      )}
    </div>
  );
}
