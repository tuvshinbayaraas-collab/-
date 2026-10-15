import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronRight,
  Download,
  FlaskConical,
  KeyRound,
  ListChecks,
  LogIn,
  RefreshCw,
  Settings2,
  Shuffle,
  Target,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import {closeGuide, guideHidden, type GuideRole} from '../lib/guide';
import {navigate} from '../lib/router';
import {shownName, useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {testInfo} from '../tests';
import {useGetApp} from './GetApp';

interface Item {
  icon: ReactNode;
  title: string;
  text: ReactNode;
  /** Optional shortcut: a page to open from the guide. */
  go?: {label: string; href: string};
  action?: {label: string; run: () => void};
}

/** The welcome guide, different for guests, students and the teacher. */
export default function GuideDialog({role}: {role: GuideRole}) {
  const session = useSession();
  const settings = useSettings();
  const app = useGetApp();
  const [never, setNever] = useState(() => guideHidden(role));
  const ok = () => closeGuide(role, never);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && closeGuide(role, never);
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [role, never]);

  const trial = settings?.trial ? testInfo(settings.trial) : undefined;
  const getApp: Item | null = app.installed
    ? null
    : {
        icon: <Download size={18} />,
        title: 'Апп татах',
        text: 'Утасныхаа нүүр дэлгэцэд нэмээд апп шиг нээж ашиглаарай.',
        action: {label: 'Татах', run: app.start},
      };

  const content: {title: string; sub?: string; items: (Item | null)[]} =
    role === 'teacher'
      ? {
          title: 'Багшийн самбарт тавтай морил',
          sub: 'Эхлээд эдгээрийг хийнэ:',
          items: [
            {
              icon: <Users size={18} />,
              title: '1. Сурагч нэмэх',
              text: 'Нэг нэгээр эсвэл нэрсийн жагсаалтаар нэмнэ. Гарсан нэвтрэх нэр, нууц үгийг хуулж эсвэл татаж аваад сурагчдад өгнө.',
              go: {label: 'Сурагчид', href: '/admin?tab=students'},
            },
            {
              icon: <KeyRound size={18} />,
              title: '2. Түлхүүр оруулах',
              text: 'Тест бүрийн зөв хариултыг хариултын хуудас шиг дугуйлж бөглөнө. Түлхүүргүй бол оноо гарахгүй.',
              go: {label: 'Түлхүүр', href: '/admin?tab=keys'},
            },
            {
              icon: <CalendarClock size={18} />,
              title: '3. Шалгалт товлох',
              text: 'Өдөр, эхлэх-дуусах цагийг сонгоно. Шалгалтын үеэр хэн хэдэн бодлого бөглөж, хэдэн удаа хуудаснаас гарсныг шууд харна.',
              go: {label: 'Шалгалт', href: '/admin?tab=exams'},
            },
            {
              icon: <BarChart3 size={18} />,
              title: 'Анализ',
              text: 'Ангийн дүнгийн хүснэгт, тест бүрийн хүнд бодлогууд, сурагч бүрийн оролдлогууд.',
              go: {label: 'Анализ', href: '/admin?tab=overview'},
            },
            {
              icon: <RefreshCw size={18} />,
              title: 'Баасан гараг бүр шинээр',
              text: 'Дүн Баасан гарагийн 24:00-д цэвэрлэгдэнэ. Хадгалах бол өмнө нь CSV-ээр татаж аваарай.',
            },
            {
              icon: <Settings2 size={18} />,
              title: 'Тохиргоо',
              text: 'Туршилтын тест, тестийг дахин өгөхийг зөвшөөрөх эсэх.',
              go: {label: 'Тохиргоо', href: '/admin?tab=settings'},
            },
          ],
        }
      : role === 'student'
        ? {
            title: `Сайн уу, ${shownName(session.profile)}!`,
            sub: 'Batnab-ийг ингэж ашиглана:',
            items: [
              {
                icon: <ListChecks size={18} />,
                title: 'Тест өгөх',
                text: 'Нүүр хуудаснаас тест сонгоно. Хариулт тань автоматаар хадгалагдана, дуусгаад «Дуусгах» дарна.',
              },
              {
                icon: <Shuffle size={18} />,
                title: 'Бодлогууд холилдоно',
                text: 'Тест өгөх бүрт бодлогуудын байр солигдоно. Дээд талын дугааруудаар бодлого хооронд шилжинэ.',
              },
              {
                icon: <Target size={18} />,
                title: 'Алдаагаа засах',
                text:
                  settings?.retakes === false
                    ? 'Дуусгахад аль бодлого дээр алдсанаа харна (зөв хариулт харагдахгүй). Тест бүрийг долоо хоногт нэг удаа өгнө.'
                    : 'Дуусгахад аль бодлого дээр алдсанаа харна (зөв хариулт харагдахгүй). Дахин бодоод дахин өгч болно.',
              },
              {
                icon: <CalendarClock size={18} />,
                title: 'Шалгалт',
                text: 'Багш товлосон цагт л нээгдэнэ, нэг л удаа өгнө. Цаг дуусахад хариулт тань автоматаар илгээгдэнэ.',
              },
              {
                icon: <AlertTriangle size={18} />,
                title: 'Анхаар',
                text: 'Тест өгөх үеэр өөр апп эсвэл таб руу шилжвэл тоологдож багшид харагдана.',
              },
              {
                icon: <RefreshCw size={18} />,
                title: 'Долоо хоног бүр шинээр',
                text: 'Дүн Баасан гараг бүрийн 24:00-д шинээр эхэлнэ.',
              },
              {
                icon: <UserRound size={18} />,
                title: 'Профайл',
                text: 'Хоч нэр, зургаа сольж, нууц үгээ шинэчилж болно.',
                go: {label: 'Профайл', href: '/profile'},
              },
              getApp,
            ],
          }
        : {
            title: 'Batnab-д тавтай морил!',
            items: [
              {
                icon: <LogIn size={18} />,
                title: 'Нэвтрэх',
                text: 'Нэвтрэх нэр, нууц үгээ багшаасаа авна. Өөрөө бүртгүүлэх боломжгүй.',
                go: {label: 'Нэвтрэх', href: '/login'},
              },
              trial
                ? {
                    icon: <FlaskConical size={18} />,
                    title: 'Туршиж үзэх',
                    text: `Нэвтрэлгүйгээр ${trial.title}-г туршиж үзэж болно. Дүн нь хадгалагдахгүй.`,
                    go: {label: 'Туршилт', href: `/test/${trial.id}`},
                  }
                : null,
              {
                icon: <Shuffle size={18} />,
                title: 'Тестүүд',
                text: 'Тест бүр 30 бодлоготой. Өгөх бүрт бодлогуудын байр холилдоно, дуусгахад оноо болон алдсан бодлогууд харагдана.',
              },
              getApp,
            ],
          };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={ok} role="dialog" aria-modal="true" aria-label="Заавар">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-neutral-900 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-5 pb-3">
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{content.title}</h2>
            {content.sub && <p className="text-sm text-neutral-400">{content.sub}</p>}
          </div>
          <button onClick={ok} aria-label="Хаах" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
          {content.items
            .filter((x): x is Item => !!x)
            .map((item) => (
              <li key={item.title} className="flex gap-3 rounded-xl bg-neutral-800/50 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm leading-relaxed text-neutral-400">{item.text}</p>
                </div>
                {(item.go || item.action) && (
                  <button
                    onClick={() => {
                      ok();
                      if (item.go) navigate(item.go.href);
                      else item.action!.run();
                    }}
                    className="flex shrink-0 items-center gap-0.5 self-center rounded-full px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/10"
                  >
                    {item.go?.label ?? item.action!.label} <ChevronRight size={14} />
                  </button>
                )}
              </li>
            ))}
        </ul>

        <div className="flex items-center gap-3 border-t border-neutral-800 px-5 py-3">
          <label className="flex flex-1 cursor-pointer select-none items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="h-4 w-4 accent-blue-500" />
            Дахин харахгүй
          </label>
          <button onClick={ok} className="rounded-full bg-blue-500 px-6 py-2 text-sm font-semibold text-black hover:bg-blue-400">
            Ойлголоо
          </button>
        </div>
      </div>
    </div>
  );
}
