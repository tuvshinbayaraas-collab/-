import {FileText, Loader2} from 'lucide-react';
import {useEffect, useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';
import Sheet from '../../components/Sheet';
import {eachPage, isPdf, MAX_PDF_PAGES, openPdf} from '../../lib/pdf';

const box = 'w-20 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-center tabular-nums outline-none focus:border-blue-500';

/**
 * A PDF chosen for cutting into problems: it is opened here, and the teacher says which pages hold the problems (all of
 * them when there are few; 30 at most at once, so a long book goes a part at a time).
 */
export default function PdfRange({file, action, onPick, onClose}: {file: File; action: string; onPick: (doc: PDFDocumentProxy, from: number, to: number) => void; onClose: () => void}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('');
  useEffect(() => {
    let live = true;
    openPdf(file).then(
      (d) => {
        if (!live) return void d.loadingTask.destroy();
        setDoc(d);
        setTo(String(Math.min(d.numPages, MAX_PDF_PAGES)));
      },
      (e) => live && setError((e as Error).message),
    );
    return () => {
      live = false;
    };
  }, [file]);
  const n = doc?.numPages ?? 0;
  const a = Number(from);
  const b = Number(to);
  const valid = Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b >= a && b <= n && b - a + 1 <= MAX_PDF_PAGES;
  const close = () => {
    void doc?.loadingTask.destroy();
    onClose();
  };
  return (
    <Sheet title="PDF-ийн хуудас сонгох" sub={file.name} onClose={close}>
      {error ? (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : !doc ? (
        <p className="flex items-center gap-2 text-sm text-neutral-300" role="status">
          <Loader2 size={16} className="animate-spin" /> PDF-ийг нээж байна…
        </p>
      ) : (
        <div className="space-y-3" data-pdf-range>
          <p className="flex items-center gap-2 text-sm text-neutral-300">
            <FileText size={16} className="text-neutral-400" /> {n} хуудастай.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input aria-label="Эхний хуудас" type="number" min={1} max={n} value={from} onChange={(e) => setFrom(e.target.value)} className={box} />
            <span>-ээс</span>
            <input aria-label="Сүүлийн хуудас" type="number" min={1} max={n} value={to} onChange={(e) => setTo(e.target.value)} className={box} />
            <span>хүртэлх хуудас</span>
          </div>
          <p className={`text-xs ${valid || !from || !to ? 'text-neutral-500' : 'text-amber-300'}`}>
            Бодлоготой хуудсуудыг л сонгоно. Нэг удаад {MAX_PDF_PAGES} хүртэл хуудас. Урт номыг хэсэг хэсгээр нь оруулна.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700">
              Болих
            </button>
            <button type="button" disabled={!valid} onClick={() => onPick(doc, a, b)} className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50">
              {action}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/**
 * Photos and a PDF for the cutting done on the device («Зургаас бодлогууд»): photos as they are; a PDF's pages, once the
 * teacher has said which, drawn as pictures. `choose` takes what the file picker gave; `sheet` asks for the pages.
 */
export function usePageFiles(onFiles: (files: File[]) => void) {
  const [pdf, setPdf] = useState<{file: File; photos: File[]} | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const choose = (files: File[]) => {
    setError('');
    const pdfs = files.filter(isPdf);
    const photos = files.filter((f) => !isPdf(f) && f.type.startsWith('image/'));
    if (pdfs.length) setPdf({file: pdfs[0], photos});
    else if (photos.length) onFiles(photos);
  };
  const pick = async (doc: PDFDocumentProxy, from: number, to: number) => {
    const photos = pdf?.photos ?? [];
    const name = pdf?.file.name.replace(/\.pdf$/i, '') ?? 'pdf';
    setPdf(null);
    try {
      const out: File[] = [];
      await eachPage(doc, from, to, async (c, i, total) => {
        setBusy(`PDF-ийн хуудас бэлдэж байна ${i + 1}/${total}`);
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
        c.width = c.height = 0;
        if (!blob) throw new Error('Хуудсыг зураг болгож чадсангүй.');
        out.push(new File([blob], `${name}-${from + i}.jpg`, {type: 'image/jpeg'}));
      });
      onFiles([...photos, ...out]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
      void doc.loadingTask.destroy();
    }
  };
  const sheet = pdf ? <PdfRange file={pdf.file} action="Хуваах" onPick={(doc, a, b) => void pick(doc, a, b)} onClose={() => setPdf(null)} /> : null;
  return {choose, sheet, busy, error};
}
