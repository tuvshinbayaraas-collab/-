import {CheckCircle2, Wrench} from 'lucide-react';
import {useEffect, useState} from 'react';
import {errorMessage} from '../lib/api';
import {formatBytes} from '../lib/format';
import {checkLayout, repairVideo, type LayoutCheck, type RepairStage} from '../lib/repair';
import type {Video} from '../lib/types';

const PHONE_LIMIT = 300 * 1024 ** 2;
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const STAGE: Record<RepairStage, string> = {
  check: 'Шалгаж байна…',
  download: 'Drive-аас татаж байна…',
  fix: 'Засаж байна…',
  upload: 'Drive-д хадгалж байна…',
};

/** For the owner: offers to fix a video file that streams slowly (see lib/repair.ts). */
export default function RepairBanner({video}: {video: Video}) {
  const [found, setFound] = useState<LayoutCheck | null>(null);
  const [progress, setProgress] = useState<{stage: RepairStage; fraction: number} | null>(null);
  const [result, setResult] = useState<'fixed' | 'fine' | 'unchanged' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setFound(null);
    setProgress(null);
    setResult(null);
    setError('');
    let alive = true;
    checkLayout(video.driveId).then((r) => alive && setFound(r));
    return () => {
      alive = false;
    };
  }, [video.driveId]);

  if (result === 'fixed' || result === 'fine') {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-green-950/60 px-4 py-3 text-sm">
        <CheckCircle2 size={18} className="shrink-0 text-green-400" />
        <span className="flex-1">
          {result === 'fixed' ? 'Бэлэн боллоо. Бичлэг одоо хурдан ачаалагдана.' : 'Файл хэвийн байна — засах шаардлагагүй.'}
        </span>
        {result === 'fixed' && (
          <button onClick={() => location.reload()} className="rounded-full bg-white px-4 py-1.5 font-semibold text-black hover:bg-neutral-200">
            Дахин ачаалах
          </button>
        )}
      </div>
    );
  }
  if (!found || found === 'fine') return null;

  const slow = found === 'unknown' ? null : found;
  const tooBigHere = isPhone() && (slow?.size ?? 0) > PHONE_LIMIT;
  const start = async () => {
    setError('');
    setProgress({stage: 'download', fraction: 0});
    try {
      setResult(await repairVideo(video.driveId, (stage, fraction) => setProgress({stage, fraction})));
    } catch (e) {
      setError(errorMessage(e));
    }
    setProgress(null);
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start gap-3">
        <Wrench size={18} className="mt-0.5 shrink-0 text-amber-400" />
        <p className="min-w-0 flex-1 text-neutral-200">
          {!slow
            ? 'Google Drive энэ бичлэгийг нийтэд түр хязгаарласан тул файлыг шалгаж чадсангүй. Таны нэвтрэлтээр шалгаад, шаардлагатай бол засах уу?'
            : slow.layout === 'fragmented'
              ? 'Энэ бичлэгийн файл хэсэгчилсэн (fragmented) MP4 тул хөтөч үзэх бүрдээ бүх файлыг татаж, сайтыг удаашруулж байна.'
              : 'Энэ бичлэгийн файлын индекс төгсгөлдөө байгаа тул бичлэг удаан эхэлдэг.'}{' '}
          <span className="text-neutral-400">
            Засахад файлыг{slow ? ` (${formatBytes(slow.size)})` : ''} татаж, засаад Drive дээрх файлыг шинэчилнэ — бичлэгийн
            холбоос, үзэлт, сэтгэгдэл хэвээр үлдэнэ. Зөвхөн та харж байна.
          </span>
        </p>
        {!progress && !tooBigHere && result !== 'unchanged' && (
          <button onClick={start} className="shrink-0 rounded-full bg-amber-400 px-4 py-1.5 font-semibold text-black hover:bg-amber-300">
            {slow ? 'Засах' : 'Шалгаж засах'}
          </button>
        )}
      </div>
      {tooBigHere && <p className="mt-2 text-amber-300">Энэ том файлыг компьютер дээрээс засна уу.</p>}
      {progress && (
        <div className="mt-3">
          <p className="mb-1 text-neutral-300">
            {STAGE[progress.stage]} {(progress.stage === 'download' || progress.stage === 'upload') && `${Math.round(progress.fraction * 100)}%`}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-amber-400 transition-[width]" style={{width: `${progress.fraction * 100}%`}} />
          </div>
          <p className="mt-1 text-xs text-neutral-500">Дуустал энэ хуудсыг хааж болохгүй.</p>
        </div>
      )}
      {result === 'unchanged' && <p className="mt-2 text-amber-300">Энэ файлыг автоматаар засах боломжгүй байна. Эх файлаа дахин оруулна уу.</p>}
      {error && <p className="mt-2 text-red-400">{error}</p>}
    </div>
  );
}
