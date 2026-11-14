import {ChevronRight} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import type {Question} from '../lib/classroom';
import {navigate, Link} from '../lib/router';
import {LETTER_CODES, LETTER_LABELS, problemNo, useTopics} from '../lib/topics';
import {loadTest} from '../tests';
import {LETTERS, type Test} from '../tests/types';
import MathText from './MathText';
import {Rich, TopicPicture} from './TopicParts';

type About = Pick<Question['ctx'], 's' | 't' | 'q'>;

/**
 * Where the problem a question is about is: a topic's problem on its page; a test's question in the latest handed-in
 * attempt of it (`results`; `uid`: the teacher looking at a student's); none this week: nowhere (null).
 */
export function problemHref(ctx: About, results?: {id: string; test: string; at: number}[] | null, uid?: string): string | null {
  if (ctx.s === 'p') return `/topics/${encodeURIComponent(ctx.t)}${ctx.q ? `?p=${encodeURIComponent(ctx.q)}` : ''}`;
  const last = (results ?? []).filter((r) => r.test === ctx.t).sort((a, b) => b.at - a.at)[0];
  return last
    ? `/review/${encodeURIComponent(ctx.t)}/${encodeURIComponent(last.id)}?${uid ? `u=${encodeURIComponent(uid)}&` : ''}q=${encodeURIComponent(ctx.q ?? '')}`
    : null;
}

/**
 * The problem a question to the teacher is about, in full (its text, picture and choices; never the right answer). A
 * tap on it goes to the problem itself (`href`); the picture opens large instead.
 */
export default function AskedProblem({ctx, href, children}: {ctx: About; href?: string | null; children?: ReactNode}) {
  return (
    <div
      onClick={href ? () => navigate(href) : undefined}
      className={`mt-2 rounded-xl border border-neutral-800 bg-neutral-950/40 p-3 ${href ? 'cursor-pointer transition-colors hover:border-sky-500/50 hover:bg-neutral-950/70' : ''}`}
    >
      {ctx.s === 't' ? <TestQuestion ctx={ctx} /> : <TopicProblem ctx={ctx} />}
      {children}
      {href && (
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-sky-300 hover:underline"
        >
          Бодлого руу очих <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

const quiet = 'text-sm text-neutral-500';

function TopicProblem({ctx}: {ctx: About}) {
  const topics = useTopics();
  if (!topics) return <p className={quiet}>Бодлогыг ачаалж байна…</p>;
  const t = topics.find((x) => x.id === ctx.t);
  const i = t?.problems.findIndex((x) => x.id === ctx.q) ?? -1;
  const p = t && i >= 0 ? t.problems[i] : undefined;
  if (!t || !p) return <p className={quiet}>Энэ бодлого олдсонгүй (устгагдсан байж магадгүй).</p>;
  return (
    <div className="space-y-2">
      <div className="flex gap-2 leading-relaxed">
        <span className="shrink-0 font-bold">{problemNo(p, i)}.</span>
        {p.text ? <Rich text={p.text} className="min-w-0 flex-1 text-neutral-100" /> : <span className="text-neutral-500">(зурагтай бодлого)</span>}
      </div>
      {p.img && (
        // The picture opens large (it doesn't go to the problem).
        <div onClick={(e) => e.stopPropagation()}>
          <TopicPicture tid={t.id} iid={p.img} className="w-full" trim />
        </div>
      )}
      {p.kind === 'choice' && p.choices && (
        <div className="flex flex-wrap gap-1.5">
          {LETTER_CODES.filter((l) => p.choices?.[l]).map((l) => (
            <span key={l} className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1 text-sm">
              <b className="text-xs text-neutral-400">{LETTER_LABELS[l]}</b>
              <MathText text={p.choices![l]!} display />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TestQuestion({ctx}: {ctx: About}) {
  const [test, setTest] = useState<Test | null | undefined>(undefined);
  useEffect(() => {
    const p = loadTest(ctx.t);
    if (!p) return setTest(null);
    let live = true;
    p.then(
      (x) => live && setTest(x),
      () => live && setTest(null),
    );
    return () => {
      live = false;
    };
  }, [ctx.t]);
  if (test === undefined) return <p className={quiet}>Бодлогыг ачаалж байна…</p>;
  const qi = Number(ctx.q);
  const q = test?.questions[qi];
  if (!q) return <p className={quiet}>Энэ бодлого олдсонгүй.</p>;
  const figures = q.c.some((c) => typeof c !== 'string');
  return (
    <div className="space-y-2">
      <div className="flex gap-2 leading-relaxed">
        <span className="shrink-0 font-bold">{qi + 1}.</span>
        <MathText text={q.q} className="min-w-0 [overflow-wrap:anywhere]" />
      </div>
      {q.fig && <div className="mx-auto flex w-fit max-w-full justify-center text-neutral-200">{q.fig}</div>}
      <div className="flex flex-wrap gap-1.5">
        {q.c.map((c, ci) => (
          <span
            key={ci}
            className={`flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1 text-sm ${figures ? 'flex-[1_1_7rem] flex-col' : ''}`}
          >
            <b className="text-xs text-neutral-400">{LETTERS[ci]}</b>
            {typeof c === 'string' ? <MathText text={c} display /> : c}
          </span>
        ))}
      </div>
    </div>
  );
}
