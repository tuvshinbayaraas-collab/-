import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  Check,
  ChevronRight,
  Download,
  FlaskConical,
  KeyRound,
  Lightbulb,
  ListChecks,
  LogIn,
  Settings2,
  Shuffle,
  Target,
  Users,
  X,
} from 'lucide-react';
import {useEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import appIcon from '../lib/appIcon';
import {useBackdrop} from '../lib/backdrop';
import {closeGuide, guideHidden, type GuideRole} from '../lib/guide';
import {navigate} from '../lib/router';
import {shownName, useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {testInfo} from '../tests';
import {useGetApp} from './GetApp';

const TONES = {
  blue: 'bg-blue-500/15 text-blue-300',
  green: 'bg-green-500/15 text-green-300',
  violet: 'bg-violet-500/15 text-violet-300',
  amber: 'bg-amber-500/15 text-amber-300',
  pink: 'bg-pink-500/15 text-pink-300',
  cyan: 'bg-cyan-500/15 text-cyan-300',
};

interface Step {
  /** None: the app's own icon (the welcome step). */
  icon?: ReactNode;
  tone?: keyof typeof TONES;
  title: string;
  text?: ReactNode;
  /** A short hint under the text. */
  tip?: ReactNode;
  /** Optional shortcut: a page to open from the guide. */
  go?: {label: string; href: string};
  action?: {label: string; run: () => void};
}

/** The welcome guide, one step at a time (Дараах / Буцах, or a swipe); different for guests, students and the teacher. */
export default function GuideDialog({role}: {role: GuideRole}) {
  const session = useSession();
  const settings = useSettings();
  const app = useGetApp();
  const [never, setNever] = useState(() => guideHidden(role));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'next' | 'back'>('next');
  const nextRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{x: number; y: number} | null>(null);
  const ok = () => closeGuide(role, never);
  const backdrop = useBackdrop(ok);

  const trial = settings?.trial ? testInfo(settings.trial) : undefined;
  const getApp: Step | null = app.installed
    ? null
    : {
        icon: <Download size={34} />,
        tone: 'blue',
        title: 'Апп болгох',
        text: 'Утасныхаа нүүр дэлгэцэд нэмбэл Batnab апп шиг нэг товшилтоор нээгдэнэ.',
        action: {label: 'Апп татах', run: app.start},
      };

  const all: (Step | null)[] =
    role === 'teacher'
      ? [
          {
            title: 'Багшийн самбарт тавтай морил',
            text: 'Эхлээд гурван зүйл хийнэ: сурагчдаа нэмэх, түлхүүр оруулах, хэрэгтэй бол шалгалт товлох.',
          },
          {
            icon: <Users size={34} />,
            tone: 'blue',
            title: '1. Анги, сурагч нэмэх',
            text: 'Самбарын дээд талд «Шинэ анги үүсгэх» дарж ангиа (жишээ нь 11_6 анги) үүсгээд сурагчдын нэрийг нэг нэгээр эсвэл жагсаалтаар оруулна. Нэвтрэх нэр, нууц үг нь өөрөө гарна.',
            tip: 'Гарсан нэвтрэх нэр, нууц үгийг хуулж эсвэл CSV-ээр татаж аваад сурагчдад өгнө.',
            go: {label: 'Сурагчид хэсгийг нээх', href: '/admin?tab=students'},
          },
          {
            icon: <KeyRound size={34} />,
            tone: 'green',
            title: '2. Түлхүүр оруулах',
            text: 'Тест бүрийн зөв хариултыг хариултын хуудас шиг дарж бөглөнө, эсвэл «АБВГД…» гэж нэг дор буулгана.',
            tip: 'Түлхүүргүй тестэд оноо гарахгүй. Түлхүүрээ хожим оруулахад өмнөх дүнгүүд өөрөө тооцогдоно.',
            go: {label: 'Түлхүүр хэсгийг нээх', href: '/admin?tab=keys'},
          },
          {
            icon: <CalendarClock size={34} />,
            tone: 'cyan',
            title: '3. Шалгалт товлох',
            text: 'Өдөр, эхлэх ба дуусах цагаа сонгоно. Тест зөвхөн тэр хугацаанд нээгдэж, сурагч нэг л удаа өгнө.',
            tip: 'Шалгалтын үеэр хэн хэдэн бодлого бөглөж байгаа, хэн хуудаснаас гарсныг шууд харна.',
            go: {label: 'Шалгалт хэсгийг нээх', href: '/admin?tab=exams'},
          },
          {
            icon: <BookOpen size={34} />,
            tone: 'violet',
            title: 'Сэдэв ба шууд тэмцээн',
            text: '«Сэдэв»-т хичээл, бодлогоо оруулна: номын хуудасны зургаас бодлогуудыг тасдаж, хэвлэж болно. Сэдвийн бодлогуудаар ангидаа Kahoot шиг шууд тэмцээн хийнэ — ганцаараа, багаар эсвэл ангиар.',
            go: {label: 'Сэдэв хэсгийг нээх', href: '/admin?tab=topics'},
          },
          {
            icon: <BarChart3 size={34} />,
            tone: 'blue',
            title: 'Анализ ба даалгавар',
            text: 'Ангийн дүн, хамгийн хүнд бодлогууд, хуулсан байж болзошгүй ижил хариултыг харна. Даалгавар, зарлал өгч, сурагчдын асуултад хариулна.',
            tip: 'Дээд талын «Тайлан»-аар ангийн тайланг хэвлэж эсвэл PDF болгоно.',
            go: {label: 'Анализ хэсгийг нээх', href: '/admin?tab=overview'},
          },
          {
            icon: <Settings2 size={34} />,
            tone: 'amber',
            title: 'Тохиргоо ба нөөц',
            text: 'Баасан гарагийн 24:00-д дүн цэвэрлэгдэнэ (бүртгэл, түлхүүр үлдэнэ). Хадгалах бол «Тохиргоо»-оос CSV эсвэл «Нөөц татах».',
            tip: 'Туршилтын тест, дахин өгөх, сонголт холих, leaderboard-ыг мөн тэндээс асааж унтраана.',
            go: {label: 'Тохиргоог нээх', href: '/admin?tab=settings'},
          },
        ]
      : role === 'student'
        ? [
            {
              title: `Сайн уу, ${shownName(session.profile)}!`,
              text: 'Хамгийн хэрэгтэй хэдэн зүйлийг товчхон үзүүлье.',
            },
            {
              icon: <ListChecks size={34} />,
              tone: 'green',
              title: 'Тест өгөх',
              text: 'Нүүр хуудаснаас тестээ сонгоод бодлого бүрийн А–Д-ээс зөвийг нь дарна. Дууссан бол «Дуусгах».',
              tip: 'Хариулт тань өөрөө хадгалагдана. Бодлого, сонголтын дараалал хүн бүрт өөр.',
            },
            {
              icon: <Target size={34} />,
              tone: 'blue',
              title: 'Дүн ба давтлага',
              text: 'Дуусгахад оноо, сэдэв бүрээр хэдийг зөв бодсон, юуг давтах нь гарна. Алдсан бодлого тань алдааны дэвтэрт орж, давтах өдөр нь эргэж гарна.',
              tip: 'Өдөр бүр 5 бодлогын «Өдрийн дасгал» хийж 🔥 цуваагаа үргэлжлүүлээрэй.',
              go: {label: 'Миний дүнгүүдийг нээх', href: '/results'},
            },
            {
              icon: <BookOpen size={34} />,
              tone: 'violet',
              title: 'Сэдэв ба шууд тэмцээн',
              text: 'Багшийн оруулсан хичээлийг «Сэдвүүд»-ээс уншаад бодлогоо бодно. Багш ангид тэмцээн нээвэл нүүр хуудсанд «Шууд тэмцээн эхэллээ!» гарна.',
              tip: '«Багш шалгана» гэсэн бодлогод бодолтынхоо зургийг илгээж болно.',
              go: {label: 'Сэдвүүдийг нээх', href: '/topics'},
            },
            {
              icon: <CalendarClock size={34} />,
              tone: 'cyan',
              title: 'Шалгалт',
              text: 'Багшийн товлосон шалгалтыг тэр цагт нь нэг л удаа өгнө. Хугацаа дуусахад хариулт тань өөрөө илгээгдэнэ.',
              tip: 'Тест, шалгалтын үеэр өөр апп эсвэл таб руу шилжвэл багшид харагдана.',
            },
            {
              icon: <Bell size={34} />,
              tone: 'pink',
              title: 'Мэдэгдэл ба цэс',
              text: 'Дээд талын хонхонд шинэ даалгавар, мэдээ, багшийн хариу ирнэ. Зураг дээрээ дарж цэсээ нээнэ: профайл, тохиргоо, гэрэлтэй загвар.',
              tip: settings?.leaderboard ? 'Баасан гараг бүр дүн шинээр эхэлнэ. «Шилдэг оноогоор»-ын эхний 3 нь долоо хоног бүр медаль авна.' : 'Баасан гараг бүр дүн шинээр эхэлнэ.',
            },
            getApp,
          ]
        : [
            {
              title: 'Batnab-д тавтай морил!',
            },
            {
              icon: <LogIn size={34} />,
              tone: 'blue',
              title: 'Нэвтрэх',
              text: 'Нэвтрэх нэр, нууц үгээ багшаасаа авна. Өөрөө бүртгүүлэх боломжгүй.',
              go: {label: 'Нэвтрэх', href: '/login'},
            },
            trial
              ? {
                  icon: <FlaskConical size={34} />,
                  tone: 'green',
                  title: 'Туршиж үзэх',
                  text: `Нэвтрэлгүйгээр ${trial.title}-г өгч үзэж болно. Дүн нь хадгалагдахгүй.`,
                  go: {label: 'Туршиж үзэх', href: `/test/${trial.id}`},
                }
              : null,
            {
              icon: <Shuffle size={34} />,
              tone: 'violet',
              title: 'Тестүүд',
              text: 'Тест бүр 30 бодлоготой. Өгөх бүрт бодлогуудын дараалал өөр байна. Дуусгахад оноо болон алдсан бодлогууд харагдана.',
            },
            getApp,
          ];
  const steps = all.filter((s): s is Step => !!s);
  const at = Math.min(step, steps.length - 1);
  const last = at === steps.length - 1;

  const goTo = (i: number) => {
    if (i < 0 || i >= steps.length || i === at) return;
    setDir(i > at ? 'next' : 'back');
    setStep(i);
  };
  const next = () => (last ? ok() : goTo(at + 1));
  const back = () => goTo(at - 1);

  // On a computer Enter or → goes on straight away; a phone gets no focus ring on a button nobody touched yet.
  useEffect(() => {
    if (!matchMedia('(pointer: coarse)').matches) nextRef.current?.focus();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ok();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  // A sideways swipe on a phone turns the page too.
  const down = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') swipe.current = {x: e.clientX, y: e.clientY};
  };
  const up = (e: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - start.y) * 1.5) (dx < 0 ? next : back)();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" {...backdrop} role="dialog" aria-modal="true" aria-label="Заавар">
      <div
        className="flex max-h-[92dvh] w-full max-w-md animate-[sheet-up_.22s_ease-out] flex-col overflow-y-auto rounded-t-3xl bg-neutral-900 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 motion-reduce:animate-none sm:animate-none sm:rounded-3xl sm:pt-4"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={() => (swipe.current = null)}
        style={{touchAction: 'pan-y'}}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tabular-nums text-neutral-500">
            Заавар · {at + 1}/{steps.length}
          </span>
          <button onClick={ok} aria-label="Хаах" className="-mr-1.5 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>

        {/* Every step sits in the same grid cell, only the current one visible: the sheet is as tall as its tallest step
            and doesn't jump from step to step. */}
        <div className="grid" aria-live="polite">
          {steps.map((x, i) => (
            <div
              key={x.title}
              aria-hidden={i !== at}
              className={`col-start-1 row-start-1 flex flex-col items-center justify-center py-3 text-center ${i !== at ? 'invisible' : `motion-reduce:animate-none ${dir === 'next' ? 'animate-[guide-next_.22s_ease-out]' : 'animate-[guide-back_.22s_ease-out]'}`}`}
            >
              {x.icon ? (
                <span className={`flex h-20 w-20 items-center justify-center rounded-3xl ${TONES[x.tone ?? 'blue']}`}>{x.icon}</span>
              ) : (
                <img src={appIcon} alt="" className="h-20 w-20 rounded-3xl" />
              )}
              <h2 className="mt-5 text-xl font-bold">{x.title}</h2>
              {x.text && <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-neutral-300">{x.text}</p>}
              {x.tip && (
                <p className="mt-4 flex max-w-sm gap-2 rounded-xl bg-neutral-800/70 px-3 py-2.5 text-left text-sm text-neutral-300">
                  <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-300" /> <span>{x.tip}</span>
                </p>
              )}
              {(x.go || x.action) && (
                <button
                  tabIndex={i === at ? undefined : -1}
                  onClick={() => {
                    ok();
                    if (x.go) navigate(x.go.href);
                    else x.action!.run();
                  }}
                  className="mt-4 flex items-center gap-1 rounded-full bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/25"
                >
                  {x.go?.label ?? x.action!.label} <ChevronRight size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-1" aria-label="Алхмууд">
          {steps.map((x, i) => (
            <button key={x.title} aria-current={i === at ? 'step' : undefined} aria-label={`${i + 1}-р алхам: ${x.title}`} onClick={() => goTo(i)} className="p-1">
              <span className={`block h-2 rounded-full transition-all ${i === at ? 'w-6 bg-blue-400' : i < at ? 'w-2 bg-blue-400/40' : 'w-2 bg-neutral-700'}`} />
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {at === 0 ? (
            <button onClick={ok} className="rounded-full bg-neutral-800 py-3 text-sm font-semibold text-neutral-300 hover:bg-neutral-700">
              Алгасах
            </button>
          ) : (
            <button onClick={back} className="flex items-center justify-center gap-1.5 rounded-full bg-neutral-800 py-3 text-sm font-semibold hover:bg-neutral-700">
              <ArrowLeft size={16} /> Буцах
            </button>
          )}
          <button
            ref={nextRef}
            onClick={next}
            className="flex items-center justify-center gap-1.5 rounded-full bg-blue-500 py-3 text-sm font-semibold text-black outline-none hover:bg-blue-400 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            {last ? (
              <>
                <Check size={16} /> Ойлголоо
              </>
            ) : (
              <>
                Дараах <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        <label className="mt-3 flex cursor-pointer select-none items-center justify-center gap-2 text-sm text-neutral-400">
          <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="h-4 w-4 accent-blue-500" />
          Дахин харахгүй
        </label>
      </div>
    </div>
  );
}
