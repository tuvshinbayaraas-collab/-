import {BookOpen, Flame, NotebookPen} from 'lucide-react';
import type {ReactNode} from 'react';
import {BadgeGrid, useBadgeFacts} from '../../components/Badges';
import {ProgressChart, useWeeks} from '../../components/Progress';
import {isDue, useMistakes} from '../../lib/mistakes';
import {liveStreak, useStats} from '../../lib/stats';
import {useAllMarks, useAllProgress, useTopics} from '../../lib/topics';
import type {AdminData} from './data';
import {pctOf, topicScores, useAllTopicKeys} from './WeakTopics';

/** On the teacher's page about one student: streak, notebook, topics, the progress chart and the badges. */
export default function StudentGrowth({uid, data}: {uid: string; data: AdminData}) {
  const results = data.results.filter((r) => r.uid === uid);
  const weeks = useWeeks(uid, results, data.keys);
  const facts = useBadgeFacts(uid, results, data.keys);
  const stats = useStats(uid);
  const mistakes = useMistakes(uid);
  const topics = useTopics();
  const progress = useAllProgress();
  const keys = useAllTopicKeys();
  const marks = useAllMarks();
  const student = data.students.find((s) => s.uid === uid);
  const scores = student && topics && progress && keys && marks ? topicScores([student], topics, progress, keys, marks).filter((s) => s.answered) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Tile icon={<Flame size={16} className="text-orange-300" />} label="Өдрийн дасгал" value={`🔥 ${liveStreak(stats)}`} sub={`хамгийн их ${stats?.best ?? 0}`} />
        <Tile icon={<NotebookPen size={16} className="text-rose-300" />} label="Алдааны дэвтэр" value={mistakes?.length ?? '—'} sub={`${mistakes?.filter((m) => isDue(m)).length ?? 0} давтах · ${stats?.learned ?? 0} сурсан`} />
        <Tile icon={<BookOpen size={16} className="text-violet-300" />} label="Сэдэв" value={scores.length} sub="эхэлсэн" />
      </div>
      {scores.length > 0 && (
        <section className="rounded-2xl bg-neutral-900 p-4">
          <h3 className="mb-2 font-semibold">Сэдвүүд (эхний хариултаар)</h3>
          <ul className="space-y-1.5 text-sm">
            {scores
              // Waiting for the teacher's check: last, without a percent yet.
              .sort((a, b) => (a.judged ? a.right / a.judged : 2) - (b.judged ? b.right / b.judged : 2))
              .map((s) => {
                const pct = pctOf(s.right, s.judged);
                return (
                  <li key={s.topic.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate">{s.topic.title}</span>
                    <span className="text-xs text-neutral-500">
                      {s.answered}/{s.topic.problems.length} бодсон
                    </span>
                    <span className={`w-12 text-right font-semibold tabular-nums ${pct !== null && pct < 50 ? 'text-amber-300' : ''}`} title={pct === null ? 'Багш шалгаагүй' : undefined}>
                      {pct === null ? '—' : `${pct}%`}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
      {weeks && <ProgressChart points={weeks} />}
      {facts && <BadgeGrid facts={facts} />}
    </div>
  );
}

function Tile({icon, label, value, sub}: {icon: ReactNode; label: string; value: ReactNode; sub: string}) {
  return (
    <div className="rounded-2xl bg-neutral-900 p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-xs text-neutral-400">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}
