import {X} from 'lucide-react';
import {useState} from 'react';
import appIcon from '../lib/appIcon';
import {platform, useInstall} from '../lib/install';
import {useGetApp} from './GetApp';

const KEY = 'batnab.appNudge';
const WEEK = 7 * 86_400_000;

const later = () => {
  try {
    localStorage.setItem(KEY, String(Date.now() + WEEK));
  } catch {
    // no storage: it shows again next time
  }
};
const resting = () => {
  try {
    return Number(localStorage.getItem(KEY) || 0) > Date.now();
  } catch {
    return false;
  }
};

/**
 * On the home page of a student whose phone doesn't have the app yet: a small card offering it. An iPhone has no
 * install dialog of its own (only Safari's «Add to Home Screen», which few find), so the card opens the guide, with its
 * download (the Web Clip profile) first; on Android, the browser's own dialog. Put away (or followed) it rests a week.
 */
export default function AppNudge() {
  const app = useGetApp();
  const {canPrompt} = useInstall();
  const [hidden, setHidden] = useState(resting);
  const p = platform();
  if (app.installed || hidden || p === 'desktop' || (p === 'android' && !canPrompt)) return null;
  const close = () => {
    later();
    setHidden(true);
  };
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 sm:p-4" role="region" aria-label="Апп суулгах" data-app-nudge>
      <img src={appIcon} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{p === 'ios' ? 'Batnab-г нүүр дэлгэцэд нэмэх үү?' : 'Batnab-г апп болгож суулгах уу?'}</p>
        <p className="text-sm text-neutral-300">Апп шиг бүтэн дэлгэцээр, нэг товшилтоор нээгдэнэ.</p>
        <button
          type="button"
          onClick={() => {
            close();
            void app.start();
          }}
          className="mt-2.5 rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-blue-400"
        >
          {p === 'ios' ? 'Татах' : 'Суулгах'}
        </button>
      </div>
      <button type="button" onClick={close} aria-label="Дараа" className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
        <X size={18} />
      </button>
    </div>
  );
}
