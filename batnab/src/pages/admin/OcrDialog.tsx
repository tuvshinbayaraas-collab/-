import {Loader2} from 'lucide-react';
import {useEffect, useState} from 'react';
import Sheet from '../../components/Sheet';
import {Rich} from '../../components/TopicParts';
import ZoomView from '../../components/ZoomView';
import {readText} from '../../lib/ocr';

export interface OcrAction {
  label: string;
  run: (text: string) => void | Promise<void>;
  primary?: boolean;
}

/**
 * "Зургаас бичвэр": reads the picture's text, shows it next to the picture to fix by hand (formulas go in $…$), and
 * hands it to one of `actions` (add under the picture, replace it, add to the problem…).
 */
export default function OcrDialog({image, actions, onClose}: {image: string | Blob; actions: OcrAction[]; onClose: () => void}) {
  const [url] = useState(() => (typeof image === 'string' ? image : URL.createObjectURL(image)));
  const [text, setText] = useState<string | null>(null);
  const [progress, setProgress] = useState({p: 0, stage: 'Бэлдэж байна'});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => () => void (typeof image !== 'string' && URL.revokeObjectURL(url)), [image, url]);
  useEffect(() => {
    let live = true;
    setError('');
    setText(null);
    readText(image, (p, stage) => live && setProgress({p, stage}))
      .then((t) => live && setText(t))
      .catch((e) => live && setError(/fetch|network|load/i.test(String(e?.message ?? e)) ? 'Интернэт холболтоо шалгаад дахин оролдоно уу.' : `Уншиж чадсангүй: ${e?.message ?? e}`));
    return () => {
      live = false;
    };
  }, [image, attempt]);

  const act = async (a: OcrAction) => {
    if (text === null) return;
    setBusy(true);
    try {
      await a.run(text.trim());
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Sheet title="Зургаас бичвэр гаргах" sub="Зураг дээрх бичвэрийг уншаад засах боломжтой бичвэр болгоно." onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={() => setZoom(true)} className="block max-h-[40vh] overflow-hidden rounded-xl bg-white md:max-h-[60vh]" aria-label="Зургийг томоор харах">
          <img src={url} alt="" className="mx-auto max-h-[40vh] w-auto max-w-full object-contain md:max-h-[60vh]" />
        </button>
        <div className="min-w-0">
          {error ? (
            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
              {error}
              <button onClick={() => setAttempt((n) => n + 1)} className="mt-3 block rounded-full bg-neutral-800 px-4 py-1.5 font-medium text-neutral-100 hover:bg-neutral-700">
                Дахин оролдох
              </button>
            </div>
          ) : text === null ? (
            <div className="rounded-xl bg-neutral-800/50 p-4" role="status">
              <p className="flex items-center gap-2 text-sm text-neutral-300">
                <Loader2 size={16} className="animate-spin" /> {progress.stage}… {Math.round(progress.p * 100)}%
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full rounded-full bg-violet-400 transition-[width]" style={{width: `${Math.round(progress.p * 100)}%`}} />
              </div>
              <p className="mt-3 text-xs text-neutral-500">Анх удаа хэлний өгөгдлийг (≈4 MB) татна, дараагийн удаа шууд эхэлнэ.</p>
            </div>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                aria-label="Уншсан бичвэр"
                placeholder="Бичвэр олдсонгүй. Зураг тод, бичвэр нь хэвтээ байгаа эсэхийг шалгана уу."
                className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-amber-200/80">Үсэг, тоо, томьёог зурагтай тулгаж засна уу. Томьёог $…$ дотор бичнэ: $x^2$, $\frac{"{1}{2}"}$.</p>
              {text.includes('$') && (
                <div className="mt-2 rounded-xl border border-dashed border-neutral-700 p-3">
                  <p className="mb-1 text-[11px] uppercase tracking-wider text-neutral-500">Ингэж харагдана</p>
                  <Rich text={text} className="text-sm" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700">
          Болих
        </button>
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => act(a)}
            disabled={busy || !text?.trim()}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${a.primary ? 'bg-blue-500 text-black hover:bg-blue-400' : 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {zoom && <ZoomView url={url} onClose={() => setZoom(false)} />}
    </Sheet>
  );
}
