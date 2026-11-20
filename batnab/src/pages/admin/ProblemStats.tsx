import {AlertTriangle, ChevronDown} from 'lucide-react';
import {useState} from 'react';
import {Rich, TopicPicture} from '../../components/TopicParts';
import {Link} from '../../lib/router';
import {LETTER_CODES, LETTER_LABELS, normalize, problemNo, type Letter, type Problem, type Topic} from '../../lib/topics';
import type {Student} from './data';

/** One student's first answer to one problem and how it went (null: the teacher hasn't checked it). */
interface Answer {
  s: Student;
  a: string;
  v: boolean | null;
}

/** How a problem went: first answers, right, wrong, waiting, and who hasn't answered it. */
export interface ProblemStat {
  p: Problem;
  no: number;
  answers: Answer[];
  right: number;
  wrong: number;
  waiting: number;
  /** Right out of the judged ones, or null with none judged. */
  pct: number | null;
  missing: Student[];
}

export function problemStats(topic: Topic, students: Student[], first: (uid: string, pid: string) => {a: string; v: boolean | null} | undefined): ProblemStat[] {
  return topic.problems.map((p, i) => {
    const answers: Answer[] = students.flatMap((s) => {
      const f = first(s.uid, p.id);
      return f ? [{s, ...f}] : [];
    });
    const right = answers.filter((x) => x.v === true).length;
    const wrong = answers.filter((x) => x.v === false).length;
    return {
      p,
      no: problemNo(p, i),
      answers,
      right,
      wrong,
      waiting: answers.length - right - wrong,
      pct: right + wrong ? Math.round((right / (right + wrong)) * 100) : null,
      missing: students.filter((s) => !first(s.uid, p.id)),
    };
  });
}

/** Judged by at least this many before a problem counts as hard (one wrong answer out of one says little). */
const ENOUGH = 3;
const tone = (pct: number | null) => (pct === null ? 'text-neutral-500' : pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-300' : 'text-red-400');
const names = (xs: Student[]) => xs.map((s) => s.profile.name);

/** "Бодлого бүрээр": every problem's right share, its wrong answers, who missed it; the hardest ones first if asked. */
export default function ProblemStats({topic, stats, keys}: {topic: Topic; stats: ProblemStat[]; keys: Record<string, string>}) {
  const [hardFirst, setHardFirst] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const hard = stats
    .filter((x) => x.pct !== null && x.right + x.wrong >= ENOUGH && x.pct < 50)
    .sort((a, b) => a.pct! - b.pct!)
    .slice(0, 3);
  const shown = hardFirst ? [...stats].sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.no - b.no) : stats;
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">Бодлого бүрээр</h2>
        <div className="flex rounded-full bg-neutral-800 p-0.5 text-xs" role="radiogroup" aria-label="Эрэмбэ">
          {[
            [false, 'Дарааллаар'],
            [true, 'Хүнд нь эхэндээ'],
          ].map(([v, label]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={hardFirst === v} onClick={() => setHardFirst(v as boolean)} className={`rounded-full px-3 py-1 font-medium ${hardFirst === v ? 'bg-neutral-600 text-neutral-50' : 'text-neutral-400'}`}>
              {label as string}
            </button>
          ))}
        </div>
      </div>
      {hard.length > 0 && (
        <p className="mb-2 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Хамгийн их алдсан: {hard.map((x) => `${x.no}-р (${x.pct}%)`).join(', ')}. Эдгээрийг ангид дахин тайлбарлах нь зүйтэй.
          </span>
        </p>
      )}
      <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
        {shown.map((x) => {
          const isOpen = open === x.p.id;
          const judged = x.right + x.wrong;
          return (
            <li key={x.p.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : x.p.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-800/40">
                <span className="w-9 shrink-0 font-semibold tabular-nums">{x.no}.</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-neutral-400">{x.p.text || (x.p.img ? 'Зурагтай бодлого' : '—')}</span>
                  {/* The right share as a bar: green right, red wrong, violet waiting for the check. */}
                  <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-neutral-800" role="img" aria-label={`${x.right} зөв, ${x.wrong} буруу, ${x.waiting} шалгах`}>
                    {x.answers.length > 0 && (
                      <>
                        <span className="bg-green-500" style={{width: `${(x.right / x.answers.length) * 100}%`}} />
                        <span className="bg-red-500" style={{width: `${(x.wrong / x.answers.length) * 100}%`}} />
                        <span className="bg-violet-500" style={{width: `${(x.waiting / x.answers.length) * 100}%`}} />
                      </>
                    )}
                  </span>
                </span>
                {x.waiting > 0 && <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-200">{x.waiting} шалгах</span>}
                <span className={`min-w-16 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums ${tone(x.pct)}`}>{x.pct === null ? '—' : `${x.pct}% зөв`}</span>
                <span className="hidden w-16 shrink-0 text-right text-xs text-neutral-500 sm:block">{x.answers.length} бодсон</span>
                <ChevronDown size={16} className={`shrink-0 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && <Detail topic={topic} x={x} keyed={keys[x.p.id]} judged={judged} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Detail({topic, x, keyed, judged}: {topic: Topic; x: ProblemStat; keyed?: string; judged: number}) {
  const p = x.p;
  // The answers given, the same ones together (written answers as they are compared: spaces, case, "," and "."), most first.
  const groups = new Map<string, {shown: string; who: Answer[]}>();
  for (const a of x.answers) {
    const k = p.kind === 'choice' ? a.a : normalize(a.a);
    const g = groups.get(k) ?? {shown: p.kind === 'choice' ? (LETTER_LABELS[a.a as Letter] ?? a.a) : a.a.trim(), who: []};
    g.who.push(a);
    groups.set(k, g);
  }
  const wrongs = [...groups.values()].filter((g) => g.who.some((a) => a.v === false)).sort((a, b) => b.who.length - a.who.length);
  const missed = x.answers.filter((a) => a.v === false);
  return (
    <div className="space-y-3 border-t border-neutral-800 px-4 pb-4 pt-3 sm:pl-16">
      <div className="max-h-56 overflow-hidden rounded-xl bg-neutral-800/40 p-3">
        {p.text && <Rich text={p.text} className="text-sm text-neutral-200" />}
        {p.img && <TopicPicture tid={topic.id} iid={p.img} className="mt-2 max-h-40 w-auto" />}
      </div>
      <p className="text-sm text-neutral-300">
        {x.answers.length} бодсон: <span className="text-green-300">{x.right} зөв</span>, <span className="text-red-300">{x.wrong} буруу</span>
        {x.waiting > 0 && <span className="text-violet-200">, {x.waiting} шалгаагүй</span>}
        {keyed && <span className="text-neutral-400"> · зөв хариулт: {p.kind === 'choice' ? LETTER_LABELS[keyed as Letter] : keyed}</span>}
      </p>
      {p.kind === 'choice' && x.answers.length > 0 && (
        <div className="space-y-1">
          {LETTER_CODES.map((l) => {
            const n = x.answers.filter((a) => a.a === l).length;
            const right = keyed === l;
            return (
              <div key={l} className="flex items-center gap-2 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${right ? 'bg-green-500 text-black' : 'bg-neutral-800 text-neutral-300'}`}>{LETTER_LABELS[l]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
                  <span className={`block h-full rounded-full ${right ? 'bg-green-500' : 'bg-[#3987e5]'}`} style={{width: `${(n / x.answers.length) * 100}%`}} />
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-neutral-400">
                  {n} ({Math.round((n / x.answers.length) * 100)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
      {p.kind === 'answer' && wrongs.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Түгээмэл буруу хариулт</p>
          <ul className="flex flex-wrap gap-1.5 text-sm">
            {wrongs.slice(0, 6).map((g) => (
              <li key={g.shown} className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-200" title={names(g.who.map((a) => a.s)).join(', ')}>
                «{g.shown.length > 30 ? `${g.shown.slice(0, 30)}…` : g.shown}» · {g.who.length}
              </li>
            ))}
          </ul>
        </div>
      )}
      {missed.length > 0 && (
        <p className="text-sm">
          <span className="text-neutral-500">Алдсан: </span>
          {missed.map((a, i) => (
            <span key={a.s.uid}>
              {i > 0 && ', '}
              <Link href={`/admin/student/${a.s.uid}`} className="text-neutral-200 hover:underline">
                {a.s.profile.name}
              </Link>
            </span>
          ))}
        </p>
      )}
      {x.missing.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-neutral-500">Бодоогүй: {x.missing.length} сурагч</summary>
          <p className="mt-1 text-neutral-300">{names(x.missing).join(', ')}</p>
        </details>
      )}
      {!judged && !x.answers.length && <p className="text-sm text-neutral-500">Одоогоор хэн ч бодоогүй.</p>}
    </div>
  );
}
