import {AlertTriangle, BookOpen} from 'lucide-react';
import {Link} from '../../lib/router';
import {useLive} from '../../lib/live';
import {useAllProgress, useTopics, type Progress, type Topic} from '../../lib/topics';
import type {AdminData, Student} from './data';

export interface TopicScore {
  topic: Topic;
  /** First answers given / right, over the class. */
  answered: number;
  right: number;
  /** Students who answered at least one problem. */
  started: number;
  /** Per student: [answered, right]. */
  by: Map<string, [number, number]>;
}

/** Every topic's keys, for the teacher. */
export const useAllTopicKeys = () => useLive('topicKeys', (v) => (v ?? {}) as Record<string, Record<string, string>>);

/** How the class did in each opened topic, by first answers. */
export function topicScores(students: Student[], topics: Topic[], progress: Record<string, Progress>, keys: Record<string, Record<string, string>>): TopicScore[] {
  return topics
    .filter((t) => t.published && t.problems.some((p) => p.k))
    .map((topic) => {
      const by = new Map<string, [number, number]>();
      let answered = 0;
      let right = 0;
      for (const s of students) {
        const mine = progress[s.uid]?.[topic.id] ?? {};
        let a = 0;
        let r = 0;
        for (const p of topic.problems) {
          if (!mine[p.id]) continue;
          a++;
          if (keys[topic.id]?.[p.id] && mine[p.id].a === keys[topic.id][p.id]) r++;
        }
        if (a) by.set(s.uid, [a, r]);
        answered += a;
        right += r;
      }
      return {topic, answered, right, started: by.size, by};
    });
}

export const pctOf = (right: number, answered: number) => (answered ? Math.round((right / answered) * 100) : null);

/** "Сэдвүүдээр": topics from weakest to strongest, with the students who need help in each. */
export default function WeakTopics({data}: {data: AdminData}) {
  const topics = useTopics();
  const progress = useAllProgress();
  const keys = useAllTopicKeys();
  if (!topics || !progress || !keys) return null;
  const scores = topicScores(data.students, topics, progress, keys)
    .filter((s) => s.answered)
    .sort((a, b) => a.right / a.answered - b.right / b.answered);
  if (!scores.length) return null;
  const names = new Map(data.students.map((s) => [s.uid, s.profile.name]));
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <BookOpen size={18} className="text-violet-300" /> Сэдвүүдээр (сулаас нь эхлээд)
      </h2>
      <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
        {scores.map((s) => {
          const pct = pctOf(s.right, s.answered)!;
          const weak = [...s.by].filter(([, [a, r]]) => a >= 2 && r / a < 0.5).map(([uid]) => names.get(uid)).filter(Boolean);
          return (
            <li key={s.topic.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Link href={`/admin/topic/${s.topic.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {s.topic.title}
                </Link>
                {pct < 50 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                    <AlertTriangle size={12} /> Сул
                  </span>
                )}
                <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{pct}%</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full rounded-full bg-[#3987e5]" style={{width: `${pct}%`}} />
                </div>
                <span className="shrink-0 text-xs text-neutral-500">
                  {s.started}/{data.students.length} сурагч бодсон
                </span>
              </div>
              {weak.length > 0 && <p className="mt-1.5 text-xs text-neutral-400">Анхаарах: {weak.join(', ')}</p>}
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-neutral-500">Сурагч бүрийн эхний хариултаар. «Анхаарах»: тэр сэдэвт хагасаас бага нь зөв.</p>
    </section>
  );
}
