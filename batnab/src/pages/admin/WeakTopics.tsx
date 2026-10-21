import {AlertTriangle, BookOpen} from 'lucide-react';
import {Link} from '../../lib/router';
import {useLive} from '../../lib/live';
import {useAllMarks, useAllProgress, useTopics, verdict, type Marks, type Progress, type Topic} from '../../lib/topics';
import type {AdminData, Student} from './data';

export interface TopicScore {
  topic: Topic;
  /** First answers given; of them, the ones judged (by the key or the teacher's mark) and right; over the class. */
  answered: number;
  judged: number;
  right: number;
  /** Students who answered at least one problem. */
  started: number;
  /** Per student: [judged, right]. */
  by: Map<string, [number, number]>;
}

/** Every topic's keys, for the teacher. */
export const useAllTopicKeys = () => useLive('topicKeys', (v) => (v ?? {}) as Record<string, Record<string, string>>);

/** How the class did in each opened topic, by first answers: against the key or the teacher's mark (answers the teacher hasn't checked yet only counted as answered). */
export function topicScores(students: Student[], topics: Topic[], progress: Record<string, Progress>, keys: Record<string, Record<string, string>>, marks: Record<string, Marks> = {}): TopicScore[] {
  return topics
    .filter((t) => t.published && t.problems.length > 0)
    .map((topic) => {
      const by = new Map<string, [number, number]>();
      let answered = 0;
      let judged = 0;
      let right = 0;
      let started = 0;
      for (const s of students) {
        const mine = progress[s.uid]?.[topic.id] ?? {};
        let n = 0;
        let j = 0;
        let r = 0;
        for (const p of topic.problems) {
          if (!mine[p.id]) continue;
          n++;
          const v = verdict(mine[p.id].a, keys[topic.id]?.[p.id], marks[s.uid]?.[topic.id]?.[p.id]);
          if (v === null) continue;
          j++;
          if (v) r++;
        }
        if (n) started++;
        if (j) by.set(s.uid, [j, r]);
        answered += n;
        judged += j;
        right += r;
      }
      return {topic, answered, judged, right, started, by};
    });
}

export const pctOf = (right: number, answered: number) => (answered ? Math.round((right / answered) * 100) : null);

/** "Сэдвүүдээр": topics from weakest to strongest, with the students who need help in each. */
export default function WeakTopics({data}: {data: AdminData}) {
  const topics = useTopics();
  const progress = useAllProgress();
  const keys = useAllTopicKeys();
  const marks = useAllMarks();
  if (!topics || !progress || !keys || !marks) return null;
  const scores = topicScores(data.students, topics, progress, keys, marks)
    .filter((s) => s.judged)
    .sort((a, b) => a.right / a.judged - b.right / b.judged);
  if (!scores.length) return null;
  const names = new Map(data.students.map((s) => [s.uid, s.profile.name]));
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <BookOpen size={18} className="text-violet-300" /> Сэдвүүдээр (сулаас нь эхлээд)
      </h2>
      <ul className="divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
        {scores.map((s) => {
          const pct = pctOf(s.right, s.judged)!;
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
