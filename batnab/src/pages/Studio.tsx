import {ArrowDown, ArrowUp, ChevronDown, ChevronUp, Minus} from 'lucide-react';
import {useMemo, useState, type ReactNode} from 'react';
import {ShortsLogo} from '../components/ShortCard';
import Thumbnail from '../components/Thumbnail';
import {EmptyState} from '../components/VideoCard';
import {api, dayKey} from '../lib/api';
import {signIn, useUser} from '../lib/auth';
import {formatViews} from '../lib/format';
import {Link} from '../lib/router';
import type {VideoStats} from '../lib/types';
import {useAsync} from '../lib/useAsync';

const DAYS = 28;
// Single-series chart hue (validated against the #171717 card surface: L/chroma/contrast pass).
const SERIES = '#3987e5';

const dayDate = (offset: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
};
const shortDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
const compact = (n: number) => formatViews(n).replace(' мян.', 'K').replace(' сая', 'M');

export default function Studio() {
  const {user, ready} = useUser();
  const stats = useAsync(() => (user ? api.channelStats(user.uid) : Promise.resolve([])), [user?.uid]);
  const subs = useAsync(() => (user ? api.subscriberCount(user.uid) : Promise.resolve(0)), [user?.uid]);

  if (ready && !user)
    return (
      <EmptyState title="Үзүүлэлтээ харахын тулд нэвтэрнэ үү">
        <button onClick={signIn} className="mt-2 rounded-full bg-white px-5 py-2 font-semibold text-black hover:bg-neutral-200">
          Нэвтрэх
        </button>
      </EmptyState>
    );
  if (!ready || stats.loading) return <p className="text-neutral-400">Үзүүлэлт ачаалж байна…</p>;
  if (stats.error) return <EmptyState title="Ачаалж чадсангүй">{stats.error}</EmptyState>;

  const rows = stats.data ?? [];
  if (!rows.length)
    return (
      <EmptyState title="Танд одоогоор бичлэг алга">
        <Link href="/upload" className="text-blue-400 hover:underline">
          Анхны бичлэгээ оруулаад үзүүлэлтээ хянаарай
        </Link>
      </EmptyState>
    );

  return <Dashboard rows={rows} subscribers={subs.data ?? 0} />;
}

function Dashboard({rows, subscribers}: {rows: VideoStats[]; subscribers: number}) {
  // Daily totals across the channel for the last 2×28 days (oldest first).
  const daily = useMemo(() => {
    const series = Array.from({length: DAYS * 2}, (_, i) => {
      const date = dayDate(DAYS * 2 - 1 - i);
      const key = dayKey(date);
      return {date, views: rows.reduce((sum, r) => sum + (r.daily[key] ?? 0), 0)};
    });
    return {current: series.slice(DAYS), previous: series.slice(0, DAYS)};
  }, [rows]);

  const sum = (f: (r: VideoStats) => number) => rows.reduce((s, r) => s + f(r), 0);
  const last28 = daily.current.reduce((s, d) => s + d.views, 0);
  const prev28 = daily.previous.reduce((s, d) => s + d.views, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Сувгийн үзүүлэлт</h1>
        <p className="mt-1 text-sm text-neutral-400">Таны бичлэгүүд хэр үзэгдэж, хэр таалагдаж байгааг эндээс харна.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Сүүлийн 28 хоногийн үзэлт" value={last28} delta={{now: last28, before: prev28}} />
        <Tile label="Нийт үзэлт" value={sum((r) => r.video.views ?? 0)} />
        <Tile label="Захиалагч" value={subscribers} />
        <Tile label="Таалагдсан" value={sum((r) => r.likes)} />
        <Tile label="Сэтгэгдэл" value={sum((r) => r.comments)} />
        <Tile label="Бичлэг" value={rows.length} note={`${rows.filter((r) => r.video.short).length} нь Shorts`} />
      </div>

      <DailyChart days={daily.current} />
      <VideoTable rows={rows} />
    </div>
  );
}

function Tile({label, value, delta, note}: {label: string; value: number; delta?: {now: number; before: number}; note?: string}) {
  let deltaEl: ReactNode = null;
  if (delta) {
    const diff = delta.now - delta.before;
    const pct = delta.before ? Math.round((diff / delta.before) * 100) : null;
    const text = pct === null ? (diff ? 'шинэ' : 'өөрчлөлтгүй') : `${diff >= 0 ? '+' : ''}${pct}%`;
    deltaEl = (
      <p className="mt-1 text-xs text-neutral-400">
        <span
          className={`mr-1 inline-flex items-center gap-0.5 font-medium ${
            diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-neutral-300'
          }`}
        >
          {diff > 0 ? <ArrowUp size={12} /> : diff < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
          {text}
        </span>
        өмнөх 28 хоногоос
      </p>
    );
  }
  return (
    <div className="rounded-xl bg-neutral-900 p-4">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold" title={value.toLocaleString('en-US')}>
        {compact(value)}
      </p>
      {deltaEl}
      {note && <p className="mt-1 text-xs text-neutral-400">{note}</p>}
    </div>
  );
}

/** Column chart of channel views per day, with per-column hover/focus tooltip and a table fallback. */
function DailyChart({days}: {days: Array<{date: Date; views: number}>}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(...days.map((d) => d.views));
  const top = niceMax(max);
  const ticks = [0, top / 2, top];

  return (
    <section className="rounded-xl bg-neutral-900 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Өдөр тутмын үзэлт</h2>
          <p className="text-xs text-neutral-400">Сүүлийн 28 хоног, бүх бичлэг нийлбэрээр</p>
        </div>
        <button onClick={() => setAsTable(!asTable)} className="rounded-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800">
          {asTable ? 'График' : 'Хүснэгт'}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-900 text-left text-xs text-neutral-400">
              <tr>
                <th className="py-2 font-medium">Өдөр</th>
                <th className="py-2 text-right font-medium">Үзэлт</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date.toISOString()} className="border-t border-neutral-800">
                  <td className="py-1.5">{d.date.toLocaleDateString('mn-MN')}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.views.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-6 pl-9">
          {/* y gridlines */}
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 bottom-6">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 flex items-center"
                style={{bottom: `${(t / top) * 100}%`}}
              >
                <span className="w-8 -translate-y-1/2 pr-1 text-right text-[11px] tabular-nums text-neutral-500">{compact(t)}</span>
                <span className={`h-px flex-1 ${t === 0 ? 'bg-neutral-600' : 'bg-neutral-800'}`} />
              </div>
            ))}
          </div>
          <div className="relative flex h-48 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => (
              <button
                key={i}
                type="button"
                className="group relative flex h-full flex-1 items-end outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.date.toLocaleDateString('mn-MN')}: ${d.views} үзэлт`}
              >
                <span
                  className="w-full rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-white"
                  style={{
                    height: d.views ? `${Math.max((d.views / top) * 100, 1.5)}%` : 0,
                    background: SERIES,
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
            {hover !== null && (
              <div
                className={`pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg bg-neutral-800 px-3 py-2 text-xs shadow-lg ${
                  hover < 4 ? '' : hover > days.length - 5 ? '-translate-x-full' : '-translate-x-1/2'
                }`}
                style={{left: `${((hover + (hover < 4 ? 0 : hover > days.length - 5 ? 1 : 0.5)) / days.length) * 100}%`}}
              >
                <p className="text-neutral-400">{days[hover].date.toLocaleDateString('mn-MN')}</p>
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="inline-block h-2 w-2 rounded-full" style={{background: SERIES}} />
                  {days[hover].views.toLocaleString('en-US')} үзэлт
                </p>
              </div>
            )}
          </div>
          <div className="mt-1 flex h-5 justify-between text-[11px] text-neutral-500">
            {[0, 7, 14, 21, 27].map((i) => (
              <span key={i}>{shortDate(days[i].date)}</span>
            ))}
          </div>
          {max === 0 && (
            <p className="absolute inset-x-9 top-16 text-center text-sm text-neutral-400">
              Сүүлийн 28 хоногт үзэлт бүртгэгдээгүй байна
            </p>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-neutral-500">Өдөр тутмын үзэлтийг энэ боломж нэмэгдсэнээс хойш тоолж эхэлсэн.</p>
    </section>
  );
}

function niceMax(n: number) {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const steps = [1, 2, 2.5, 5, 10];
  return steps.find((s) => s * pow >= n)! * pow;
}

type SortKey = 'date' | 'views' | 'last28' | 'likes' | 'dislikes' | 'comments';

function VideoTable({rows}: {rows: VideoStats[]}) {
  const [sort, setSort] = useState<{key: SortKey; desc: boolean}>({key: 'date', desc: true});
  const recentKeys = useMemo(() => Array.from({length: DAYS}, (_, i) => dayKey(dayDate(i))), []);

  const value = (r: VideoStats, key: SortKey) => {
    switch (key) {
      case 'date':
        return r.video.createdAt;
      case 'views':
        return r.video.views ?? 0;
      case 'last28':
        return recentKeys.reduce((s, k) => s + (r.daily[k] ?? 0), 0);
      default:
        return r[key];
    }
  };
  const sorted = [...rows].sort((a, b) => (value(a, sort.key) - value(b, sort.key)) * (sort.desc ? -1 : 1));

  const th = (key: SortKey, label: string) => (
    <th className="px-3 py-2 text-right font-medium">
      <button
        onClick={() => setSort((s) => ({key, desc: s.key === key ? !s.desc : true}))}
        className={`inline-flex items-center gap-1 hover:text-white ${sort.key === key ? 'text-white' : ''}`}
      >
        {label}
        {sort.key === key && (sort.desc ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
      </button>
    </th>
  );

  return (
    <section className="rounded-xl bg-neutral-900 p-4 sm:p-5">
      <h2 className="mb-3 font-semibold">Бичлэг тус бүрийн үзүүлэлт</h2>
      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-xs text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="px-3 py-2 text-left font-medium">Бичлэг</th>
              {th('date', 'Огноо')}
              {th('views', 'Үзэлт')}
              {th('last28', '28 хоног')}
              {th('likes', 'Лайк')}
              {th('dislikes', 'Дислайк')}
              {th('comments', 'Сэтгэгдэл')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.video.id} className="border-b border-neutral-800/70 last:border-0 hover:bg-neutral-800/40">
                <td className="px-3 py-2">
                  <Link
                    href={r.video.short ? `/shorts/${r.video.id}` : `/watch?v=${r.video.id}`}
                    className="flex items-center gap-3"
                  >
                    <Thumbnail video={r.video} className="w-24 shrink-0 rounded-md" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 font-medium">{r.video.title}</span>
                      {r.video.short && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-neutral-400">
                          <ShortsLogo size={12} /> Shorts
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-right text-neutral-300">{new Date(r.video.createdAt).toLocaleDateString('mn-MN')}</td>
                {(['views', 'last28', 'likes', 'dislikes', 'comments'] as const).map((k) => (
                  <td key={k} className="px-3 py-2 text-right tabular-nums">
                    {value(r, k).toLocaleString('en-US')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
