import {BarChart3, BookOpen, CalendarClock, ClipboardList, KeyRound, MessageCircleQuestion, Printer, Settings2, Users} from 'lucide-react';
import {useEffect, useMemo, useRef} from 'react';
import {CenterNote, LockedNote} from '../../components/Notices';
import {Link, useLocation} from '../../lib/router';
import {useAllQuestions} from '../../lib/classroom';
import {usePickedClass} from '../../lib/classes';
import {useSession} from '../../lib/session';
import {ClassBar, forClass} from './Classes';
import {useAdminData} from './data';
import Exams from './Exams';
import Keys from './Keys';
import Overview from './Overview';
import QuestionsTab from './QuestionsTab';
import Report from './Report';
import SettingsTab from './SettingsTab';
import StudentDetail from './StudentDetail';
import TasksTab from './TasksTab';
import Students from './Students';
import TopicEditor from './TopicEditor';
import TopicsTab from './TopicsTab';

const TABS = [
  {id: 'overview', label: 'Анализ', icon: BarChart3},
  {id: 'exams', label: 'Шалгалт', icon: CalendarClock},
  {id: 'students', label: 'Сурагчид', icon: Users},
  {id: 'topics', label: 'Сэдэв', icon: BookOpen},
  {id: 'tasks', label: 'Даалгавар', icon: ClipboardList},
  {id: 'questions', label: 'Асуулт', icon: MessageCircleQuestion},
  {id: 'keys', label: 'Түлхүүр', icon: KeyRound},
  {id: 'settings', label: 'Тохиргоо', icon: Settings2},
] as const;

/** The teacher's dashboard: /admin?tab=…, /admin/student/{uid}, /admin/topic/{id}, /admin/report. Everything shows the class picked at the top. */
export default function Admin({student, topic, report}: {student?: string; topic?: string; report?: boolean}) {
  const session = useSession();
  const {query} = useLocation();
  const {data: all, error} = useAdminData();
  const picked = usePickedClass();
  const data = useMemo(() => (all ? forClass(all, picked) : null), [all, picked]);
  // On a phone the tabs scroll sideways: keep the open one in view.
  const nav = useRef<HTMLElement>(null);
  const where = `${query.get('tab')}/${student}/${topic}/${report}`;
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-current=page]');
    const box = nav.current;
    if (el && box && (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollTo({left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2});
  }, [where, session.admin]);
  const questions = useAllQuestions();
  const unanswered = (questions ?? []).filter((q) => !q.reply && data?.students.some((s) => s.uid === q.uid)).length;

  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote title="Багшийн самбар" text="Багшийн бүртгэлээр нэвтэрнэ үү." />;
  if (!session.admin) return <CenterNote title="Энэ хуудсыг зөвхөн багш харна" />;

  const tab = TABS.find((t) => t.id === query.get('tab'))?.id ?? 'overview';
  return (
    <div className="mx-auto max-w-5xl py-4">
      <div className="flex items-center gap-3 print:hidden">
        <h1 className="flex-1 text-xl font-bold sm:text-2xl">Багшийн самбар</h1>
        {!report && (
          <Link href="/admin/report" className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800">
            <Printer size={15} /> Тайлан
          </Link>
        )}
      </div>
      <div className="print:hidden">{all && <ClassBar data={all} picked={picked} />}</div>
      <nav ref={nav} className="relative -mx-4 mt-3 flex overflow-x-auto border-b border-neutral-800 px-4 [scrollbar-width:none] sm:mx-0 sm:gap-1 sm:px-0 print:hidden">
        {TABS.map((t) => {
          const active = !report && (student ? 'students' : topic ? 'topics' : tab) === t.id;
          return (
            <Link
              key={t.id}
              href={`/admin?tab=${t.id}`}
              aria-current={active ? 'page' : undefined}
              className={`relative -mb-px flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 border-b-2 px-2 py-2 text-xs font-medium sm:min-w-0 sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm ${active ? 'border-blue-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
            >
              <t.icon size={18} className="sm:h-4 sm:w-4" /> {t.label}
              {t.id === 'questions' && unanswered > 0 && (
                <span className="absolute right-1 top-1 min-w-4 rounded-full bg-sky-400 px-1 text-center text-[10px] font-bold leading-4 text-black sm:static sm:ml-0.5">{unanswered}</span>
              )}
            </Link>
          );
        })}
      </nav>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">Өгөгдөл уншихад алдаа гарлаа: {error}</p>}
      <div className="mt-5">
        {!data || !all ? (
          <p className="py-16 text-center text-neutral-400">Ачаалж байна…</p>
        ) : student ? (
          <StudentDetail uid={student} data={all} />
        ) : report ? (
          <Report data={data} picked={picked} />
        ) : topic ? (
          <TopicEditor id={topic} data={data} />
        ) : tab === 'tasks' ? (
          <TasksTab data={data} picked={picked} />
        ) : tab === 'questions' ? (
          <QuestionsTab data={data} />
        ) : tab === 'topics' ? (
          <TopicsTab data={data} />
        ) : tab === 'exams' ? (
          <Exams data={data} test={query.get('test') ?? undefined} />
        ) : tab === 'students' ? (
          <Students data={data} all={all} picked={picked} />
        ) : tab === 'keys' ? (
          <Keys data={data} initial={query.get('test') ?? undefined} />
        ) : tab === 'settings' ? (
          <SettingsTab data={data} />
        ) : (
          <Overview data={data} test={query.get('test') ?? undefined} />
        )}
      </div>
    </div>
  );
}
