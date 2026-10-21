// Reading the text in a picture (OCR) for the topic editor: Tesseract in a web worker, Mongolian and English. Its files
// come from this site's /ocr/ (vite.config.ts); the language data is kept in the browser after the first time, so later
// pictures start at once.
import type {Worker} from 'tesseract.js';

const STAGES: Record<string, string> = {
  'loading tesseract core': 'Програмыг ачаалж байна',
  'initializing tesseract': 'Бэлдэж байна',
  'loading language traineddata': 'Монгол, англи хэлний өгөгдлийг ачаалж байна',
  'initializing api': 'Бэлдэж байна',
  'recognizing text': 'Бичвэрийг уншиж байна',
};

let worker: Promise<Worker> | null = null;
let report: ((progress: number, stage: string) => void) | null = null;
let jobs: Promise<unknown> = Promise.resolve();

/** One reading at a time (the worker reads one picture after another anyway), so each shows its own progress. */
function job<T>(onProgress: ((progress: number, stage: string) => void) | undefined, run: (w: Worker) => Promise<T>) {
  const out = jobs.then(async () => {
    report = onProgress ?? null;
    try {
      return await run(await getWorker());
    } finally {
      report = null;
    }
  });
  jobs = out.catch(() => {});
  return out;
}

function getWorker() {
  // Absolute addresses: the worker runs from a blob: URL, against which /ocr/… would not resolve.
  const base = `${location.origin}/ocr`;
  worker ??= import('tesseract.js')
    .then(({createWorker}) =>
      createWorker(['mon', 'eng'], undefined, {
        workerPath: `${base}/worker.min.js`,
        corePath: `${base}/`,
        langPath: base,
        logger: (m) => report?.(m.progress, STAGES[m.status] ?? 'Ажиллаж байна'),
      }),
    )
    .catch((e) => {
      worker = null;
      throw e;
    });
  return worker;
}

/**
 * The picture's text, tidied: a word broken over two lines is joined, the lines of a paragraph become one (so a long
 * sentence reads as one), blank lines stay between paragraphs.
 */
export function readText(image: string | Blob, onProgress?: (progress: number, stage: string) => void) {
  return job(onProgress, async (w) => tidy((await w.recognize(image)).data.text));
}

/** The lines read in a picture, each with where it is and where its words are. */
export async function readLines(image: HTMLCanvasElement, onProgress?: (progress: number, stage: string) => void) {
  // As a file: a canvas the browser can't turn into one (out of memory on a phone) fails here instead of never
  // finishing in the worker.
  const file = await new Promise<Blob>((resolve, reject) => image.toBlob((b) => (b ? resolve(b) : reject(new Error('Зураг хэт том байна.'))), 'image/png'));
  return job(onProgress, async (w) => {
    const {data} = await w.recognize(file, {}, {blocks: true, text: false});
    return (data.blocks ?? []).flatMap((b) =>
      b.paragraphs.flatMap((p) =>
        p.lines.map((l) => ({
          text: l.text.trim(),
          bbox: l.bbox,
          words: l.words.map((w) => ({text: w.text, bbox: w.bbox})),
        })),
      ),
    );
  });
}

export function tidy(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/(\p{L})[-‐]\n(\p{Ll})/gu, '$1$2')
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Long text as lesson paragraphs of at most `max` characters, split between paragraphs (or sentences). */
export function chunks(text: string, max: number) {
  const out: string[] = [];
  let cur = '';
  const pieces = text.split(/\n\n/).flatMap((p) => (p.length <= max ? [p] : p.match(new RegExp(`[^]{1,${max}}(?=\\s|$)`, 'g')) ?? [p.slice(0, max)]));
  for (const p of pieces) {
    if (cur && cur.length + 2 + p.length > max) {
      out.push(cur);
      cur = p;
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out.map((c) => c.trim()).filter(Boolean);
}
