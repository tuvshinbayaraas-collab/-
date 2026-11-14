import {Lightbulb, NotebookPen} from 'lucide-react';
import {Link} from '../lib/router';
import {toReview, verdict, type SkillStat} from '../lib/skills';
import type {Skill} from '../tests/skills';

/**
 * Under a score: what it means and what to go over, then the topics weakest first with how many were right. A topic
 * with mistakes can be picked (`onPick`) to see just those questions; `notebook`: the wrong ones are in the notebook.
 */
export default function SkillBreakdown({
  stats,
  percent,
  picked,
  onPick,
  notebook,
}: {
  stats: SkillStat[];
  percent: number;
  picked?: Skill | null;
  onPick?: (s: Skill | null) => void;
  notebook?: boolean;
}) {
  if (!stats.length) return null;
  const review = toReview(stats);
  return (
    <section className="mt-4 border-t border-neutral-800 pt-4" aria-label="Сэдвээр">
      <p className="flex gap-2 text-sm text-neutral-200">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-300" />
        <span>{verdict(percent, review)}</span>
      </p>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">Сэдвээр</h3>
      <ul className="mt-2 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {stats.map((s) => {
          const share = Math.round((s.right / s.total) * 100);
          const tone = share >= 80 ? 'bg-green-500' : share >= 50 ? 'bg-amber-500' : 'bg-red-500';
          const on = picked === s.skill;
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className={`min-w-0 truncate font-medium ${on ? 'text-blue-200' : ''}`}>{s.name}</span>
                <span className="shrink-0 tabular-nums text-neutral-400">
                  <b className="text-neutral-100">{s.right}</b>/{s.total} зөв
                </span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <span className={`block h-full rounded-full ${tone}`} style={{width: `${share}%`}} />
              </span>
            </>
          );
          return (
            <li key={s.skill}>
              {onPick && s.wrong.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onPick(on ? null : s.skill)}
                  aria-pressed={on}
                  title={on ? 'Бүх бодлогыг харах' : `${s.name}: алдсан ${s.wrong.length} бодлогыг харах`}
                  className={`-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left ${on ? 'bg-blue-500/15 ring-1 ring-blue-500/50' : 'hover:bg-neutral-800'}`}
                >
                  {body}
                </button>
              ) : (
                <div className="px-0 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {onPick && <p className="mt-2 text-xs text-neutral-500">Сэдэв дээр дарж тэр сэдэвт алдсан бодлогуудаа харна.</p>}
      {notebook && review.length > 0 && (
        <Link href="/mistakes" className="mt-3 inline-flex items-center gap-2 rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700">
          <NotebookPen size={16} className="text-rose-300" /> Алдсан бодлогууд алдааны дэвтэрт орсон — давтах
        </Link>
      )}
    </section>
  );
}
