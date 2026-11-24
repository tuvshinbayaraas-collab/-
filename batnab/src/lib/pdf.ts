// A PDF's pages as pictures, for cutting into problems as a photographed page is: each page drawn on white, its longest
// side up to MAX pixels. pdf.js (its legacy build, for older browsers too) loads only when a PDF is opened; its worker,
// fonts and decoders for scanned pages come from /pdfjs/ (vite.config.ts).
import type {PDFDocumentProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';

/** As sharp as reading needs (as a photo is taken in, pageSplit.ts). */
const MAX = 2000;
/** Pages sent or read at once, at most: the teacher picks which. */
export const MAX_PDF_PAGES = 30;

let lib: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;
function pdfjs() {
  lib ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
    return m;
  });
  return lib;
}

export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Opens a PDF; says in words what is wrong with one that won't open. */
export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  try {
    return await m.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/',
      iccUrl: '/pdfjs/iccs/',
    }).promise;
  } catch (e) {
    const name = (e as {name?: string})?.name;
    if (name === 'PasswordException') throw new Error('Энэ PDF нууц үгтэй байна. Нууц үггүйгээр хадгалаад дахин оруулна уу.');
    if (name === 'InvalidPDFException') throw new Error('Энэ файлыг PDF гэж уншиж чадсангүй. Файл бүтэн эсэхийг шалгана уу.');
    throw e;
  }
}

/** Page `n` (from 1) drawn on white. */
export async function renderPage(doc: PDFDocumentProxy, n: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(n);
  try {
    const one = page.getViewport({scale: 1});
    const viewport = page.getViewport({scale: Math.min(6, MAX / Math.max(one.width, one.height))});
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({canvas, viewport, background: '#ffffff'}).promise;
    return canvas;
  } finally {
    page.cleanup();
  }
}

/** Pages `from` to `to` (from 1, at most MAX_PDF_PAGES), one at a time (a phone's memory), each handed on as it is drawn. */
export async function eachPage(doc: PDFDocumentProxy, from: number, to: number, onPage: (c: HTMLCanvasElement, i: number, total: number) => Promise<void>) {
  const last = Math.min(to, doc.numPages, from + MAX_PDF_PAGES - 1);
  for (let n = Math.max(1, from), i = 0; n <= last; n++, i++) await onPage(await renderPage(doc, n), i, last - Math.max(1, from) + 1);
}
