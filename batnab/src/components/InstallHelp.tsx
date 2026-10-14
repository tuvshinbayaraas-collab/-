import {EllipsisVertical, MonitorDown, Share, SquarePlus, X} from 'lucide-react';
import {useEffect, type ReactNode} from 'react';
import {platform} from '../lib/install';

/** How to add the site to the home screen when the browser has no install dialog we can open. */
export default function InstallHelp({onClose}: {onClose: () => void}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const p = platform();
  const steps: ReactNode[] =
    p === 'ios'
      ? [
          <>Сайтыг <b>Safari</b>-аар нээнэ.</>,
          <>
            Доод талын <Share size={16} className="inline -mt-1" /> <b>Хуваалцах</b> товчийг дарна.
          </>,
          <>
            Жагсаалтаас <SquarePlus size={16} className="inline -mt-1" /> <b>Нүүр дэлгэцэд нэмэх</b> (Add to Home Screen)-г сонгоно.
          </>,
          <>
            Баруун дээд буланд <b>Нэмэх</b> (Add) дарна.
          </>,
        ]
      : p === 'android'
        ? [
            <>Сайтыг <b>Chrome</b>-оор нээнэ.</>,
            <>
              Баруун дээд буланд <EllipsisVertical size={16} className="inline -mt-1" /> цэсийг дарна.
            </>,
            <>
              <b>Апп суулгах</b> эсвэл <b>Нүүр дэлгэцэд нэмэх</b>-ийг сонгоод баталгаажуулна.
            </>,
          ]
        : [
            <>Сайтыг <b>Chrome</b> эсвэл <b>Edge</b>-ээр нээнэ.</>,
            <>
              Хаягийн мөрний баруун талд байгаа <MonitorDown size={16} className="inline -mt-1" /> суулгах тэмдгийг, эсвэл{' '}
              <EllipsisVertical size={16} className="inline -mt-1" /> цэс → <b>Batnab-г суулгах</b>-ыг дарна.
            </>,
          ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Апп болгож суулгах">
      <div className="w-full max-w-md rounded-t-2xl bg-neutral-900 p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Batnab-г апп болгож суулгах</h2>
            <p className="text-sm text-neutral-400">Нүүр дэлгэцэд дүрс нь гарч, апп шиг дэлгэц дүүрэн нээгдэнэ.</p>
          </div>
          <button onClick={onClose} aria-label="Хаах" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-neutral-200">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Туршилтын хувилбар: тест, шалгалт өгөхөд интернэт шаардлагатай хэвээр.</p>
        <button onClick={onClose} className="mt-4 w-full rounded-full bg-neutral-800 py-2 text-sm font-medium hover:bg-neutral-700">
          Ойлголоо
        </button>
      </div>
    </div>
  );
}
