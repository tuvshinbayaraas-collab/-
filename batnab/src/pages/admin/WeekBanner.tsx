import {Download, RefreshCw} from 'lucide-react';
import {nextReset, untilReset, weekStart} from '../../lib/week';
import {download, resultsCsv, type AdminData} from './data';

// Dates in Ulaanbaatar time (UTC+8, no daylight saving), whatever the device's own time zone.
const pad = (n: number) => String(n).padStart(2, '0');
const ub = (ts: number) => new Date(ts + 8 * 3600 * 1000);
const day = (ts: number) => `${pad(ub(ts).getUTCMonth() + 1)}.${pad(ub(ts).getUTCDate())}`;
const ymd = (ts: number) => `${ub(ts).getUTCFullYear()}-${pad(ub(ts).getUTCMonth() + 1)}-${pad(ub(ts).getUTCDate())}`;

/** Which week the numbers are for, when they are cleared, and a way to keep a copy first. */
export default function WeekBanner({data}: {data: AdminData}) {
  const start = weekStart();
  const end = nextReset() - 1;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-neutral-800 px-4 py-3 text-sm">
      <RefreshCw size={18} className="hidden shrink-0 text-neutral-400 sm:block" />
      <p className="min-w-0 basis-full sm:basis-0 sm:flex-1">
        <span className="font-medium">
          Энэ долоо хоног: {day(start)} – {day(end)}.
        </span>{' '}
        <span className="text-neutral-400">Дүн Баасан гарагийн 24:00-д цэвэрлэгдэнэ ({untilReset()} үлдлээ).</span>
      </p>
      <button
        onClick={() => download(`batnab-dun-${ymd(start)}.csv`, resultsCsv(data))}
        disabled={!data.results.length}
        className="flex items-center gap-2 rounded-full bg-neutral-800 px-3.5 py-1.5 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
      >
        <Download size={15} /> Дүнг хадгалж авах
      </button>
    </div>
  );
}
