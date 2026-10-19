import {CheckCircle2, ChevronRight, ClipboardList, Flame, Megaphone, MessageCircleQuestion, NotebookPen, X} from 'lucide-react';
import {useState} from 'react';
import {useAnnouncements, useAssignments, useMyQuestions, type Assignment} from '../lib/classroom';
import {forClass} from '../lib/live';
import {isDue, useMistakes} from '../lib/mistakes';
import {usePrefs} from '../lib/prefs';
import {useMyResults} from '../lib/results';
import {Link} from '../lib/router';
import {doneToday, liveStreak, useStats} from '../lib/stats';
import {clock, dayLabel, serverNow, useNow} from '../lib/time';
import {useProgress, useTopics, type Progress, type Topic} from '../lib/topics';
import {testInfo} from '../tests';

const DAY = 86_400_000;
const HIDDEN = 'batnab.announcements.hidden';
const hiddenIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN) ?? '[]');
  } catch {
    return [];
  }
};

/** "2 өдөр үлдсэн", "5 цаг үлдсэн", "Хугацаа хэтэрсэн". */
export function dueLeft(due: number, now: number) {
  const ms = due - now;
  if (ms < 0) return 'Хугацаа хэтэрсэн';
  if (ms >= DAY) return `${Math.floor(ms / DAY)} өдөр үлдсэн`;
  if (ms >= 3600_000) return `${Math.floor(ms / 3600_000)} цаг үлдсэн`;
  return `${Math.max(1, Math.round(ms / 60_000))} мин үлдсэн`;
}

/** How far a student is with an assignment: done (and when), or how many problems so far. */
export function assignmentState(a: Assignment, topics: Topic[] | null, progress: Progress | null | undefined, results: {test: string; at: number}[]) {
  if (a.kind === 'test') {
    const at = results.filter((r) => r.test === a.ref && r.at >= a.createdAt).map((r) => r.at);
    return {done: at.length > 0, late: at.length > 0 && Math.min(...at) > a.due, count: 0, total: 0};
  }
  const t = topics?.find((x) => x.id === a.ref);
  const ps = t?.problems.filter((p) => p.k) ?? [];
  const mine = progress?.[a.ref] ?? {};
  const answered = ps.filter((p) => mine[p.id]);
  const last = Math.max(0, ...answered.map((p) => mine[p.id].at));
  const done = ps.length > 0 && answered.length === ps.length;
  return {done, late: done && last > a.due, count: answered.length, total: ps.length};
}

export const assignmentTitle = (a: Assignment, topics: Topic[] | null) => (a.kind === 'test' ? testInfo(a.ref)?.title ?? a.ref : topics?.find((t) => t.id === a.ref)?.title ?? 'Устгагдсан сэдэв');

/** The top of a student's home page: notes from the teacher, assignments, today's practice, the notebook, answers. */
export default function Today({uid, classId}: {uid: string; classId?: string}) {
  const now = useNow(60_000);
  const announcements = useAnnouncements();
  const assignments = useAssignments();
  const topics = useTopics();
  const progress = useProgress(uid);
  const results = useMyResults() ?? [];
  const stats = useStats(uid);
  const mistakes = useMistakes(uid);
  const questions = useMyQuestions(uid);
  const [hidden, setHidden] = useState(hiddenIds);
  const prefs = usePrefs();

  const notes = (announcements ?? []).filter((a) => forClass(a.classes, classId) && a.at > now - 21 * DAY && !hidden.includes(a.id)).slice(0, 3);
  const tasks = (assignments ?? []).filter((a) => forClass(a.classes, classId) && a.due > now - 3 * DAY && (a.kind === 'test' || topics?.some((t) => t.id === a.ref)));
  const due = (mistakes ?? []).filter((m) => isDue(m, serverNow())).length;
  const replies = (questions ?? []).filter((q) => q.reply && !q.seen).length;
  const streak = liveStreak(stats);
  const today = doneToday(stats);
  const cards = [
    {
      href: '/daily',
      icon: Flame,
      title: 'Өдрийн дасгал',
      text: today ? `Өнөөдөр хийсэн · 🔥 ${streak}` : streak ? `🔥 ${streak} өдөр · цуваагаа таслахгүй!` : 'Цуваа эхлүүлэх',
      hot: !today,
      lit: streak > 0,
      badge: streak,
      hotBg: 'bg-orange-500/10 hover:bg-orange-500/15',
      tone: 'text-orange-300',
      badgeBg: 'bg-orange-400',
    },
    {
      href: '/mistakes',
      icon: NotebookPen,
      title: 'Алдааны дэвтэр',
      text: due ? `${due} бодлого давтах` : 'Өнөөдөр давтах зүйл алга',
      hot: due > 0,
      lit: due > 0,
      badge: due,
      hotBg: 'bg-rose-500/10 hover:bg-rose-500/15',
      tone: 'text-rose-300',
      badgeBg: 'bg-rose-400',
    },
    {
      href: '/questions',
      icon: MessageCircleQuestion,
      title: 'Асуултууд',
      text: replies ? `Багш ${replies} асуултад хариулсан` : 'Багшаас асуух',
      hot: replies > 0,
      lit: replies > 0,
      badge: replies,
      hotBg: 'bg-sky-500/10 hover:bg-sky-500/15',
      tone: 'text-sky-300',
      badgeBg: 'bg-sky-400',
    },
  ];
  const hide = (id: string) => {
    const next = [...hidden, id].slice(-50);
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN, JSON.stringify(next));
    } catch {
      // storage blocked: it shows again next time
    }
  };

  return (
    <div className="mt-5 space-y-3">
      {notes.map((a) => (
        <div key={a.id} className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <Megaphone size={20} className="mt-0.5 shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-300">Багшийн зарлал · {dayLabel(a.at)}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-100">{a.text}</p>
          </div>
          <button onClick={() => hide(a.id)} aria-label="Нуух" className="-mr-1 -mt-1 h-fit rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={16} />
          </button>
        </div>
      ))}

      {tasks.length > 0 && (
        <section className="rounded-2xl bg-neutral-900 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            <ClipboardList size={16} /> Даалгавар
          </h2>
          <ul className="mt-2 divide-y divide-neutral-800">
            {tasks.map((a) => {
              const st = assignmentState(a, topics, progress, results);
              const over = !st.done && a.due < now;
              return (
                <li key={a.id}>
                  <Link href={a.kind === 'test' ? `/test/${a.ref}` : `/topics/${a.ref}`} className="flex items-center gap-3 py-2.5">
                    {st.done ? <CheckCircle2 size={20} className="shrink-0 text-green-400" /> : <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${over ? 'border-red-400' : 'border-neutral-600'}`} />}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-medium ${st.done ? 'text-neutral-400 line-through decoration-neutral-600' : ''}`}>
                        {a.kind === 'test' ? 'Тест: ' : 'Сэдэв: '}
                        {assignmentTitle(a, topics)}
                      </span>
                      <span className={`block text-xs ${over ? 'text-red-400' : 'text-neutral-500'}`}>
                        {dayLabel(a.due)} {clock(a.due)} хүртэл · {st.done ? (st.late ? 'хоцорч хийсэн' : 'хийсэн') : dueLeft(a.due, now)}
                        {!st.done && a.kind === 'topic' && st.total > 0 && ` · ${st.count}/${st.total} бодсон`}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-neutral-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {prefs.fullCards ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className={`flex items-center gap-3 rounded-2xl p-4 ${c.hot ? c.hotBg : 'bg-neutral-900'}`}>
              <c.icon size={22} className={c.lit ? c.tone : 'text-neutral-500'} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.title}</span>
                <span className="block text-xs text-neutral-400">{c.text}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        // Just the icons (a number when there is something to do); "Тохиргоо" can show them with their names.
        <div className="grid grid-cols-3 gap-3">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              title={`${c.title}: ${c.text}`}
              aria-label={`${c.title}: ${c.text}`}
              className={`relative flex h-14 items-center justify-center rounded-2xl ${c.hot ? c.hotBg : 'bg-neutral-900 hover:bg-neutral-800'}`}
            >
              <c.icon size={24} className={c.lit ? c.tone : 'text-neutral-500'} />
              {c.badge > 0 && <span className={`absolute right-2 top-1.5 min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5 text-black ${c.badgeBg}`}>{c.badge}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
