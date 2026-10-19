import {BarChart3, BookOpen, CalendarClock, KeyRound, Settings2, Users} from 'lucide-react';
import {useMemo} from 'react';
import {CenterNote, LockedNote} from '../../components/Notices';
import {Link, useLocation} from '../../lib/router';
import {usePickedClass} from '../../lib/classes';
import {useSession} from '../../lib/session';
import {ClassBar, forClass} from './Classes';
import {useAdminData} from './data';
import Exams from './Exams';
import Keys from './Keys';
import Overview from './Overview';
import SettingsTab from './SettingsTab';
import StudentDetail from './StudentDetail';
import Students from './Students';
import TopicEditor from './TopicEditor';
import TopicsTab from './TopicsTab';

const TABS = [
  {id: 'overview', label: 'Анализ', icon: BarChart3},
  {id: 'exams', label: 'Шалгалт', icon: CalendarClock},
  {id: 'students', label: 'Сурагчид', icon: Users},
  {id: 'topics', label: 'Сэдэв', icon: BookOpen},
  {id: 'keys', label: 'Түлхүүр', icon: KeyRound},
  {id: 'settings', label: 'Тохиргоо', icon: Settings2},
] as const;

/** The teacher's dashboard: /admin?tab=…, /admin/student/{uid}, /admin/topic/{id}. Everything shows the class picked at the top. */
export default function Admin({student, topic}: {student?: string; topic?: string}) {
  const session = useSession();
  const {query} = useLocation();
  const {data: all, error} = useAdminData();
  const picked = usePickedClass();
  const data = useMemo(() => (all ? forClass(all, picked) : null), [all, picked]);

  if (!session.ready) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;
  if (!session.user) return <LockedNote title="Багшийн самбар" text="Багшийн бүртгэлээр нэвтэрнэ үү." />;
  if (!session.admin) return <CenterNote title="Энэ хуудсыг зөвхөн багш харна" />;

  const tab = TABS.find((t) => t.id === query.get('tab'))?.id ?? 'overview';
  return (
    <div className="mx-auto max-w-5xl py-4">
      <h1 className="text-xl font-bold sm:text-2xl">Багшийн самбар</h1>
      {all && <ClassBar data={all} picked={picked} />}
      <nav className="mt-3 grid grid-cols-6 border-b border-neutral-800 sm:flex sm:gap-1">
        {TABS.map((t) => {
          const active = (student ? 'students' : topic ? 'topics' : tab) === t.id;
          return (
            <Link
              key={t.id}
              href={`/admin?tab=${t.id}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px flex flex-col items-center gap-1 border-b-2 px-1 py-2 text-xs font-medium sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm ${active ? 'border-blue-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
            >
              <t.icon size={18} className="sm:h-4 sm:w-4" /> {t.label}
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
        ) : topic ? (
          <TopicEditor id={topic} data={data} />
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
