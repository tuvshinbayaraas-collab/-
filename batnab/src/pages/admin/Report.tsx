import {ArrowLeft, Printer} from 'lucide-react';
import {assignmentState} from '../../components/Today';
import {useAssignments} from '../../lib/classroom';
import {useClasses} from '../../lib/classes';
import type {History} from '../../lib/history';
import {percent} from '../../lib/keys';
import {forClass, useLive} from '../../lib/live';
import {formatDate} from '../../lib/results';
import {Link} from '../../lib/router';
import type {Stats} from '../../lib/stats';
import {useAllMarks, useAllProgress, useTopics} from '../../lib/topics';
import {TESTS} from '../../tests';
import {gradeOf, mean, type AdminData} from './data';
import {pctOf, topicScores, useAllTopicKeys} from './WeakTopics';

const cell = 'border border-neutral-700 px-2 py-1.5 print:border-neutral-400';

/** /admin/report: the picked class on one page — this week's tests, topics, assignments, the trend — to print or save as PDF. */
export default function Report({data, picked}: {data: AdminData; picked: string}) {
  const classes = useClasses();
  const topics = useTopics();
  const progress = useAllProgress();
  const keys = useAllTopicKeys();
  const marks = useAllMarks();
  const assignments = useAssignments();
  const history = useLive('history', (v) => (v ?? {}) as Record<string, History>);
  const stats = useLive('stats', (v) => (v ?? {}) as Record<string, Partial<Stats>>);
  if (!topics || !progress || !keys || !marks || !assignments || !history || !stats) return <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>;

  const name = classes?.find((c) => c.id === picked)?.name ?? 'Бүх анги';
  const students = data.students.filter((s) => !s.profile.disabled);
  const scores = topicScores(students, topics, progress, keys, marks).filter((s) => s.judged);
  const tasks = assignments.filter((a) => !picked || forClass(a.classes, picked));
  const best = (uid: string, test: string) => {
    const ps = data.results.filter((r) => r.uid === uid && r.test === test).flatMap((r) => (gradeOf(r, data.keys) ? [percent(gradeOf(r, data.keys)!)] : []));
    return ps.length ? Math.max(...ps) : null;
  };
  const trend = (uid: string) => {
    const weeks = Object.entries(history[uid] ?? {})
      .sort(([a], [b]) => Number(a) - Number(b))
      .slice(-4)
      .map(([, w]) => mean(Object.values(w).flatMap((v) => (typeof v.score === 'number' ? [(v.score / v.total) * 100] : []))));
    return weeks.filter((x): x is number => x !== null);
  };
  const fmt = (x: number | null) => (x === null ? '—' : `${Math.round(x)}%`);

  return (
    <div className="space-y-5 print:space-y-3 print:text-black">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href="/admin?tab=students" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft size={16} /> Самбар
        </Link>
        <button onClick={() => print()} className="ml-auto flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400">
          <Printer size={16} /> Хэвлэх / PDF
        </button>
      </div>
      <header>
        <h2 className="text-2xl font-bold">Ангийн тайлан — {name}</h2>
        <p className="text-sm text-neutral-400 print:text-neutral-600">
          {formatDate(Date.now())} · {students.length} сурагч · энэ долоо хоногийн тест, сэдэв, даалгавар
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-900 text-left print:bg-neutral-100">
            <tr>
              <th className={cell}>Сурагч</th>
              {TESTS.map((t) => (
                <th key={t.id} className={`${cell} text-center`}>
                  {t.title.replace('Тест ', '')}
                </th>
              ))}
              <th className={`${cell} text-center`}>Сэдэв (зөв)</th>
              <th className={`${cell} text-center`}>Даалгавар</th>
              <th className={`${cell} text-center`}>Ахиц (4 д.х.)</th>
              <th className={`${cell} text-center`}>🔥</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const mine = scores.reduce((acc, t) => {
                const v = t.by.get(s.uid);
                return v ? [acc[0] + v[0], acc[1] + v[1]] : acc;
              }, [0, 0]);
              const done = tasks.filter((a) => forClass(a.classes, s.profile.class) && assignmentState(a, topics, progress[s.uid], data.results.filter((r) => r.uid === s.uid)).done).length;
              const mineTasks = tasks.filter((a) => forClass(a.classes, s.profile.class)).length;
              const tr = trend(s.uid);
              return (
                <tr key={s.uid}>
                  <td className={`${cell} whitespace-nowrap`}>{s.profile.name}</td>
                  {TESTS.map((t) => (
                    <td key={t.id} className={`${cell} text-center tabular-nums`}>
                      {fmt(best(s.uid, t.id))}
                    </td>
                  ))}
                  <td className={`${cell} text-center tabular-nums`}>{mine[0] ? `${pctOf(mine[1], mine[0])}% (${mine[0]})` : '—'}</td>
                  <td className={`${cell} text-center tabular-nums`}>{mineTasks ? `${done}/${mineTasks}` : '—'}</td>
                  <td className={`${cell} text-center tabular-nums`}>{tr.length ? tr.map((x) => Math.round(x)).join(' → ') : '—'}</td>
                  <td className={`${cell} text-center tabular-nums`}>{stats[s.uid]?.best ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {scores.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold">Сэдвүүд (ангийн эхний хариултын зөв хувь)</h3>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {[...scores]
              .sort((a, b) => a.right / a.judged - b.right / b.judged)
              .map((t) => (
                <li key={t.topic.id} className="flex justify-between gap-3 border-b border-neutral-800 py-1 print:border-neutral-300">
                  <span>{t.topic.title}</span>
                  <span className="tabular-nums">
                    {pctOf(t.right, t.judged)}% · {t.started} бодсон
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-neutral-500 print:text-neutral-600">
        Тест: энэ долоо хоногийн шилдэг оролдлого. Ахиц: сүүлийн 4 долоо хоногийн дундаж (%). 🔥: өдрийн дасгалын хамгийн урт цуваа.
      </p>
    </div>
  );
}
