import {ArrowDown, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Copy, Ellipsis, EllipsisVertical, Glasses, Menu, MonitorDown, Share, SquarePlus, X} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import appIcon from '../lib/appIcon';
import {useBackdrop} from '../lib/backdrop';
import {platform} from '../lib/install';

// iPhones have no Mongolian interface, so the guide quotes the buttons as the phone shows them (English or Russian)
// and explains them in Mongolian.
const ru = navigator.language.toLowerCase().startsWith('ru');
const T = ru
  ? {share: 'Поделиться', add: 'На экран «Домой»', confirm: 'Добавить', cancel: 'Отменить', openSafari: 'Открыть в Safari', copy: 'Скопировать', reading: 'Добавить в список для чтения'}
  : {share: 'Share', add: 'Add to Home Screen', confirm: 'Add', cancel: 'Cancel', openSafari: 'Open in Safari', copy: 'Copy', reading: 'Add to Reading List'};

type Browser = 'safari' | 'chrome' | 'firefox' | 'inapp';
function iosBrowser(): {browser: Browser; ipad: boolean; safari26: boolean} {
  const ua = navigator.userAgent;
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const browser: Browser = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|Zalo|MicroMessenger|Snapchat|TikTok|musical_ly|KAKAOTALK/i.test(ua)
    ? 'inapp'
    : /CriOS/.test(ua)
      ? 'chrome'
      : /FxiOS/.test(ua)
        ? 'firefox'
        : 'safari';
  // Safari 26 (iOS 26) moved Share into the "•••" button of the bottom bar.
  const safari26 = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0) >= 26;
  return {browser, ipad, safari26};
}

/** How to add the site to the home screen when the browser has no install dialog we can open. */
export default function InstallHelp({onClose}: {onClose: () => void}) {
  const backdrop = useBackdrop(onClose);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const p = platform();
  const ios = p === 'ios' ? iosBrowser() : null;
  // On iPhone Safari the Share button is in the browser's own bar, below the page: point at it.
  const arrow = ios?.browser === 'safari' ? (ios.ipad ? 'top-right' : ios.safari26 ? 'bottom-right' : 'bottom-center') : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-black/70 ${arrow?.startsWith('bottom') ? 'items-start p-3 pt-4' : 'items-end sm:items-center sm:p-4'}`}
      {...backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Апп болгож суулгах"
    >
      <div
        className={`max-h-[calc(100dvh-6rem)] w-full max-w-md overflow-y-auto bg-neutral-900 p-5 ${arrow?.startsWith('bottom') ? 'rounded-2xl' : 'rounded-t-2xl sm:rounded-2xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <img src={appIcon} alt="" className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{p === 'ios' ? 'Нүүр дэлгэцэд нэмэх' : 'Batnab-г апп болгож суулгах'}</h2>
            <p className="text-sm text-neutral-400">Дараа нь нүүр дэлгэцийн дүрснээс апп шиг нээгдэнэ.</p>
          </div>
          <button onClick={onClose} aria-label="Хаах" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>

        <ol className="mt-5 space-y-5">{ios ? <IosSteps {...ios} /> : p === 'android' ? <AndroidSteps /> : <DesktopSteps />}</ol>

        <p className="mt-5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Туршилтын хувилбар: тест, шалгалт өгөхөд интернэт шаардлагатай хэвээр.</p>
        <button onClick={onClose} className="mt-4 w-full rounded-full bg-neutral-800 py-2 text-sm font-medium hover:bg-neutral-700">
          Ойлголоо
        </button>
      </div>

      {arrow && <Pointer where={arrow} />}
    </div>
  );
}

function Step({n, children, mock}: {n: number; children: ReactNode; mock?: ReactNode}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-black">{n}</span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-neutral-200">
        {children}
        {mock && <div className="mt-2">{mock}</div>}
      </div>
    </li>
  );
}

/** A button name as the phone shows it, with what it means. */
const Btn = ({label, mn}: {label: string; mn?: string}) => (
  <>
    <b className="whitespace-nowrap rounded bg-neutral-800 px-1.5 py-0.5 font-semibold text-white">{label}</b>
    {mn && <span className="text-neutral-400"> ({mn})</span>}
  </>
);

/** Highlighted spot in a mock-up. */
const Hot = ({children}: {children: ReactNode}) => (
  <span className="relative inline-flex items-center justify-center rounded-lg bg-blue-500/20 p-1 text-blue-300 ring-2 ring-blue-400">
    {children}
    <span className="absolute inset-0 animate-ping rounded-lg ring-2 ring-blue-400/60" />
  </span>
);

const Frame = ({children}: {children: ReactNode}) => <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-neutral-400">{children}</div>;

function SafariBar({safari26}: {safari26: boolean}) {
  return (
    <Frame>
      {safari26 ? (
        <div className="flex items-center gap-2">
          <ChevronLeft size={20} />
          <span className="flex-1 truncate rounded-full bg-neutral-800 px-3 py-1.5 text-center text-xs">batnab.web.app</span>
          <Hot>
            <Ellipsis size={20} />
          </Hot>
        </div>
      ) : (
        <div className="flex items-center justify-around">
          <ChevronLeft size={20} />
          <ChevronRight size={20} />
          <Hot>
            <Share size={20} />
          </Hot>
          <BookOpen size={20} />
          <Copy size={20} />
        </div>
      )}
      <p className="mt-1 text-center text-[11px] text-neutral-500">утасны хамгийн доод хэсэг</p>
    </Frame>
  );
}

function ShareSheet() {
  return (
    <Frame>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between rounded-lg bg-neutral-800/60 px-3 py-2">
          {T.copy} <Copy size={16} />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-neutral-800/60 px-3 py-2">
          {T.reading} <Glasses size={16} />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-blue-500/20 px-3 py-2 font-semibold text-white ring-2 ring-blue-400">
          {T.add} <SquarePlus size={16} />
        </div>
      </div>
      <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-neutral-500">
        <ArrowDown size={12} /> харагдахгүй бол жагсаалтыг доош гүйлгэнэ
      </p>
    </Frame>
  );
}

function AddScreen() {
  return (
    <Frame>
      <div className="flex items-center justify-between text-xs">
        <span>{T.cancel}</span>
        <span className="font-semibold text-neutral-300">{T.add}</span>
        <Hot>
          <span className="px-1 font-semibold">{T.confirm}</span>
        </Hot>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-neutral-800/60 p-2">
        <img src={appIcon} alt="" className="h-8 w-8 rounded-lg" />
        <span className="text-sm text-neutral-200">Batnab</span>
      </div>
    </Frame>
  );
}

function IosSteps({browser, ipad, safari26}: {browser: Browser; ipad: boolean; safari26: boolean}) {
  const pointed = browser === 'safari'; // the arrow is only shown inside Safari itself
  const [copied, setCopied] = useState(false);
  const shareStep = (n: number) =>
    browser === 'chrome' ? (
      <Step n={n}>
        Дээд талын хаягийн мөрний баруун талд байгаа <Share size={16} className="-mt-1 inline" /> <Btn label={T.share} mn="хуваалцах" /> товчийг дарна.
      </Step>
    ) : browser === 'firefox' ? (
      <Step n={n}>
        Доод талын <Menu size={16} className="-mt-1 inline" /> цэсийг дараад <Share size={16} className="-mt-1 inline" /> <Btn label={T.share} mn="хуваалцах" />-г дарна.
      </Step>
    ) : ipad ? (
      <Step n={n}>
        Дэлгэцийн баруун дээд буланд байгаа <Share size={16} className="-mt-1 inline" /> <Btn label={T.share} mn="хуваалцах" /> товчийг дарна.
      </Step>
    ) : safari26 ? (
      <Step n={n} mock={<SafariBar safari26 />}>
        Доод талын баруун буланд байгаа <Ellipsis size={16} className="-mt-1 inline" /> товчийг дараад <Btn label={T.share} mn="хуваалцах" />-г сонгоно.
      </Step>
    ) : (
      <Step n={n} mock={<SafariBar safari26={false} />}>
        Дэлгэцийн доод талын голд байгаа <Share size={16} className="-mt-1 inline" /> <Btn label={T.share} mn="хуваалцах" /> товчийг дарна.
        {pointed && ' Сум тэр товчийг заасан.'}
      </Step>
    );

  const steps = [
    shareStep,
    (n: number) => (
      <Step n={n} mock={<ShareSheet />}>
        Гарч ирсэн жагсаалтаас <SquarePlus size={16} className="-mt-1 inline" /> <Btn label={T.add} mn="нүүр дэлгэцэд нэмэх" />-г дарна.
      </Step>
    ),
    (n: number) => (
      <Step n={n} mock={<AddScreen />}>
        Баруун дээд буланд <Btn label={T.confirm} mn="нэмэх" /> дарна.
      </Step>
    ),
    (n: number) => (
      <Step n={n}>
        <Check size={16} className="-mt-1 mr-1 inline text-green-400" />
        Нүүр дэлгэцэд гарсан <img src={appIcon} alt="" className="-mt-1 inline h-5 w-5 rounded-md" /> <b>Batnab</b> дүрсээр нээнэ.
      </Step>
    ),
  ];

  if (browser === 'inapp')
    return (
      <>
        <Step n={1}>
          Та Messenger, Facebook зэрэг апп доторх хөтчөөр нээсэн байна. Эндээс нүүр дэлгэцэд нэмэх боломжгүй тул эхлээд <b>Safari</b>-д нээнэ: баруун дээд эсвэл доод
          буланд байгаа <Ellipsis size={16} className="-mt-1 inline" /> / <Share size={16} className="-mt-1 inline" /> товчийг дараад <Btn label={T.openSafari} mn="Safari-д нээх" />
          -г сонгоно.
          <button
            onClick={() => {
              navigator.clipboard
                ?.writeText(location.origin)
                .then(() => setCopied(true))
                .catch(() => {});
            }}
            className="mt-2 flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-medium hover:bg-neutral-700"
          >
            <Copy size={14} /> {copied ? 'Хуулагдлаа — Safari-д хуулж оруулна уу' : 'Эсвэл хаягийг хуулж аваад Safari-д нээх'}
          </button>
        </Step>
        <li className="text-xs text-neutral-500">Safari-д нээсний дараа:</li>
        {steps.map((s, i) => s(i + 2))}
      </>
    );
  return <>{steps.map((s, i) => s(i + 1))}</>;
}

function AndroidSteps() {
  return (
    <>
      <Step n={1}>
        Сайтыг <b>Chrome</b>-оор нээнэ.
      </Step>
      <Step n={2}>
        Баруун дээд буланд <EllipsisVertical size={16} className="-mt-1 inline" /> цэсийг дарна.
      </Step>
      <Step n={3}>
        <Btn label="Апп суулгах" mn="Install app" /> эсвэл <Btn label="Нүүр дэлгэцэд нэмэх" mn="Add to Home screen" />-ийг сонгоод баталгаажуулна.
      </Step>
    </>
  );
}

function DesktopSteps() {
  return (
    <>
      <Step n={1}>
        Сайтыг <b>Chrome</b> эсвэл <b>Edge</b>-ээр нээнэ.
      </Step>
      <Step n={2}>
        Хаягийн мөрний баруун талд байгаа <MonitorDown size={16} className="-mt-1 inline" /> суулгах тэмдгийг, эсвэл <EllipsisVertical size={16} className="-mt-1 inline" /> цэс →{' '}
        <Btn label="Batnab-г суулгах" mn="Install Batnab" />-г дарна.
      </Step>
    </>
  );
}

/** A bouncing arrow at the edge of the page, pointing at the browser's own button. */
function Pointer({where}: {where: 'bottom-center' | 'bottom-right' | 'top-right'}) {
  const pos = where === 'bottom-center' ? 'bottom-2 left-1/2 -translate-x-1/2' : where === 'bottom-right' ? 'bottom-2 right-3' : 'top-2 right-14';
  return (
    <div className={`pointer-events-none fixed z-[60] flex flex-col items-center ${pos}`} aria-hidden>
      {where === 'top-right' && <ArrowUp size={36} className="animate-bounce text-blue-400" strokeWidth={3} />}
      <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-black shadow-lg">{where === 'bottom-right' ? 'Энд ••• дарна' : `Энд ${T.share} дарна`}</span>
      {where !== 'top-right' && <ArrowDown size={36} className="animate-bounce text-blue-400" strokeWidth={3} />}
    </div>
  );
}
