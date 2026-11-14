import {formatDuration} from '../lib/attempt';
import type {Away} from '../lib/exams';
import {WHY_LABEL} from '../lib/leaves';

const pad = (n: number) => String(n).padStart(2, '0');
const hms = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** Each time a student was away: when, why, and for how long ("still away"; with `until`, the exam over first). */
export default function AwayList({times, now, until}: {times: Away[]; now: number; until?: number}) {
  return (
    <ol className="space-y-1 text-xs">
      {times.map((t, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="tabular-nums text-neutral-400">{hms(t.at)}</span>
          <span className="text-neutral-200">{WHY_LABEL[t.why]}</span>
          <span className={`tabular-nums ${t.ms === undefined ? 'font-semibold text-red-300' : 'text-neutral-400'}`}>
            {t.ms !== undefined ? formatDuration(t.ms / 1000) : until !== undefined ? `буцаж ирээгүй · ${formatDuration((until - t.at) / 1000)}` : `одоо ч гадуур · ${formatDuration((now - t.at) / 1000)}`}
          </span>
        </li>
      ))}
    </ol>
  );
}
