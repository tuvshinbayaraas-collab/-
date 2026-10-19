import {ArrowDown, ArrowUp, BookOpen, ChevronRight, Plus} from 'lucide-react';
import {useState} from 'react';
import {useClasses} from '../../lib/classes';
import {Link, navigate} from '../../lib/router';
import {createTopic, setTopicOrder, useAllProgress, useTopics} from '../../lib/topics';
import type {AdminData} from './data';

/** The teacher's topics: each with its lesson and problems; drafts stay hidden from students. */
export default function TopicsTab({data}: {data: AdminData}) {
  const topics = useTopics();
  const classes = useClasses() ?? [];
  const progress = useAllProgress();
  const [busy, setBusy] = useState(false);
  if (!topics) return <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>;

  const add = async () => {
    setBusy(true);
    try {
      navigate(`/admin/topic/${await createTopic(Math.max(Date.now(), ...topics.map((t) => t.order + 1)))}`);
    } catch (e) {
      alert(`Алдаа: ${(e as Error).message}`);
      setBusy(false);
    }
  };
  const move = (i: number, d: -1 | 1) => setTopicOrder(topics[i], topics[i + d]).catch((e) => alert(`Алдаа: ${(e as Error).message}`));
  const classNames = (ids: string[]) => ids.map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Сэдвүүд ({topics.length})</h2>
          <p className="text-sm text-neutral-400">Сэдэв бүрт хичээл (бичвэр, томьёо, зураг) болон бодлого оруулна. Сурагчид цэсний «Сэдвүүд»-ээс үзнэ.</p>
        </div>
        <button onClick={add} disabled={busy} className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
          <Plus size={18} /> Шинэ сэдэв
        </button>
      </div>

      {!topics.length ? (
        <div className="rounded-2xl border border-dashed border-neutral-700 p-8 text-center">
          <BookOpen size={28} className="mx-auto text-violet-300" />
          <p className="mt-3 font-medium">Одоогоор сэдэв алга</p>
          <p className="mt-1 text-sm text-neutral-400">«Шинэ сэдэв» дарж эхний сэдвээ (жишээ нь «Логарифм») үүсгээд хичээл, бодлогоо нэмээрэй.</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-800 overflow-hidden rounded-2xl bg-neutral-900">
          {topics.map((t, i) => {
            const solved = data.students.filter((s) => Object.keys(progress?.[s.uid]?.[t.id] ?? {}).length > 0).length;
            const ids = Object.keys(t.classes ?? {});
            const missing = t.problems.filter((p) => !p.k).length;
            return (
              <li key={t.id} className="flex items-center gap-2 pr-2">
                <div className="flex flex-col py-1 pl-2">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Дээш" className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-20">
                    <ArrowUp size={15} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === topics.length - 1} aria-label="Доош" className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-20">
                    <ArrowDown size={15} />
                  </button>
                </div>
                <Link href={`/admin/topic/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-3 hover:bg-neutral-800/50">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {t.title}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.published ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>{t.published ? 'Нээлттэй' : 'Ноорог'}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-neutral-400">
                      {t.lesson.length ? 'Хичээлтэй' : 'Хичээлгүй'} · {t.problems.length} бодлого · {ids.length ? classNames(ids) : 'Бүх анги'}
                      {missing > 0 && <span className="text-amber-300"> · {missing} бодлогод хариулт алга</span>}
                    </span>
                  </span>
                  <span className="w-16 shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {solved}/{data.students.length}
                    </span>
                    <span className="block text-[11px] text-neutral-500">бодсон</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
