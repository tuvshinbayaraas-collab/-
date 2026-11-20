// "Зургаас бодлогууд" (topic editor): a photographed page of numbered problems, cut into one clean picture per
// problem. The photo is turned straight and its paper made white, its columns found and read (ocr.ts), the problems
// placed (splitProblems.ts), and each problem's part of the page cut out, so formulas and figures stay as printed.
import {readLines} from './ocr';
import {loadImage} from './photo';
import {findGutter, findSkew, splitProblems, type FoundProblem, type OcrLine, type Region} from './splitProblems';

/** As sharp as reading needs and a phone handles. */
const MAX = 2000;

export interface Page {
  /** The straightened, whitened page. */
  canvas: HTMLCanvasElement;
  /** Each column alone (the rest of the page white): problems are cut from these. */
  cols: HTMLCanvasElement[];
  /** Each column's dark pixels per row. */
  rowInk: number[][];
  /** What was read: each line, in its column. */
  lines: OcrLine[];
  problems: FoundProblem[];
}

const make = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d', {willReadFrequently: true})!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  return {c, g};
};
const lum = (d: Uint8ClampedArray, i: number) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
/** Lets the page repaint (the progress bar) between the heavy steps. */
const breathe = () => new Promise((r) => setTimeout(r, 0));

/** Luminance below which a pixel counts as ink: well under the page's average. */
function inkLevel(d: Uint8ClampedArray) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4 * 7, n++) sum += lum(d, i);
  return (sum / Math.max(1, n)) * 0.6;
}

/** The page's ink at most 900 px wide (enough to see its slant and columns), and that scale. */
function darkMap(page: HTMLCanvasElement) {
  const k = Math.min(1, 900 / page.width);
  const {c, g} = make(page.width * k, page.height * k);
  g.drawImage(page, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const level = inkLevel(d);
  const dark = new Uint8Array(c.width * c.height);
  for (let i = 0; i < dark.length; i++) dark[i] = lum(d, i * 4) < level ? 1 : 0;
  return {dark, w: c.width, h: c.height, k};
}

function rotate(page: HTMLCanvasElement, a: number) {
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const {c, g} = make(page.width * cos + page.height * sin, page.width * sin + page.height * cos);
  g.translate(c.width / 2, c.height / 2);
  g.rotate(a);
  g.drawImage(page, -page.width / 2, -page.height / 2);
  return c;
}

/**
 * The paper made white and the print kept: each pixel scaled by the paper's colour around it (photos are lit
 * unevenly: a shadow, the page curving), then faint marks dropped and the print made a little darker.
 */
function whiten(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d', {willReadFrequently: true})!;
  const {width: w, height: h} = canvas;
  const image = g.getImageData(0, 0, w, h);
  const d = image.data;
  const T = 32;
  const tw = Math.ceil(w / T);
  const th = Math.ceil(h / T);
  // Each tile's paper: its brightest tenth, per channel.
  const tile = new Float32Array(tw * th * 3);
  const hist = new Uint32Array(256 * 3);
  for (let ty = 0; ty < th; ty++)
    for (let tx = 0; tx < tw; tx++) {
      hist.fill(0);
      let n = 0;
      for (let y = ty * T; y < Math.min(h, ty * T + T); y++)
        for (let x = tx * T; x < Math.min(w, tx * T + T); x++, n++) {
          const i = (y * w + x) * 4;
          hist[d[i]]++;
          hist[256 + d[i + 1]]++;
          hist[512 + d[i + 2]]++;
        }
      for (let ch = 0; ch < 3; ch++) {
        let v = 255;
        for (let seen = 0; v > 0 && seen < n * 0.1; v--) seen += hist[ch * 256 + v];
        tile[(ty * tw + tx) * 3 + ch] = v;
      }
    }
  // A tile that is mostly print (a dark drawing) takes the paper next to it; one far darker than the page's paper
  // (the table under the book, a filled figure) is not paper and stays dark.
  const paper = [0, 1, 2].map((ch) => {
    const vs = Array.from({length: tw * th}, (_, t) => tile[t * 3 + ch]).sort((a, b) => a - b);
    return vs[Math.floor(vs.length * 0.75)] || 255;
  });
  const bg = new Float32Array(tile.length);
  for (let ty = 0; ty < th; ty++)
    for (let tx = 0; tx < tw; tx++)
      for (let ch = 0; ch < 3; ch++) {
        let v = 0;
        for (let y = Math.max(0, ty - 1); y <= Math.min(th - 1, ty + 1); y++) for (let x = Math.max(0, tx - 1); x <= Math.min(tw - 1, tx + 1); x++) v = Math.max(v, tile[(y * tw + x) * 3 + ch]);
        bg[(ty * tw + tx) * 3 + ch] = Math.max(v, paper[ch] * 0.55, 1);
      }
  const curve = new Uint8ClampedArray(1001);
  for (let k = 0; k <= 1000; k++) curve[k] = k >= 880 ? 255 : 255 * Math.pow(k / 880, 1.5);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(th - 1, Math.max(0, (y - T / 2) / T));
    const y0 = Math.floor(fy);
    const y1 = Math.min(th - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(tw - 1, Math.max(0, (x - T / 2) / T));
      const x0 = Math.floor(fx);
      const x1 = Math.min(tw - 1, x0 + 1);
      const wx = fx - x0;
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const b =
          (bg[(y0 * tw + x0) * 3 + ch] * (1 - wx) + bg[(y0 * tw + x1) * 3 + ch] * wx) * (1 - wy) + (bg[(y1 * tw + x0) * 3 + ch] * (1 - wx) + bg[(y1 * tw + x1) * 3 + ch] * wx) * wy;
        d[i + ch] = curve[Math.min(1000, Math.round((d[i + ch] / b) * 1000))];
      }
    }
  }
  g.putImageData(image, 0, 0);
}

/** Reads the page: straightens and whitens it, finds its columns, reads them and places the problems. */
/** Lets a phone have the page's memory back at once (its browser allows only so much for pictures). */
export function releasePage(page: Page) {
  for (const c of [page.canvas, ...page.cols]) c.width = c.height = 0;
}

/** Reads the page; `signal` stops it between steps (the dialog was closed, or went on to another page). */
export async function readPage(file: File, onProgress: (progress: number, stage: string) => void, signal?: AbortSignal): Promise<Page> {
  const step = async () => {
    await breathe();
    if (signal?.aborted) throw new DOMException('Болисон', 'AbortError');
  };
  onProgress(0, 'Зургийг тэгшилж байна');
  const img = await loadImage(file);
  let page: HTMLCanvasElement;
  try {
    const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const {c, g} = make(img.naturalWidth * k, img.naturalHeight * k);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    page = c;
  } finally {
    URL.revokeObjectURL(img.src);
  }
  await step();
  // Level lines read better and cut apart cleanly.
  const m = darkMap(page);
  const angle = Math.atan(findSkew(m.dark, m.w, m.h));
  if (Math.abs(angle) > 0.002) {
    const turned = rotate(page, -angle);
    page.width = page.height = 0;
    page = turned;
  }
  await step();
  whiten(page);
  onProgress(0.04, 'Багануудыг хайж байна');
  await step();

  // Two columns: each read on its own (the other one painted out), split along the gutter, a little slanted if need be.
  const W = page.width;
  const H = page.height;
  const map = darkMap(page);
  const gutter = findGutter(map.dark, map.w, map.h);
  const at = (y: number) => (gutter ? (gutter.x + gutter.slope * (y * map.k - map.h / 2)) / map.k : 0);
  const ranges = gutter
    ? [
        {x0: 0, x1: Math.round(Math.max(at(0), at(H)))},
        {x0: Math.round(Math.min(at(0), at(H))), x1: W},
      ]
    : [{x0: 0, x1: W}];
  const cols = ranges.map((_, i) => {
    const {c, g} = make(W, H);
    g.drawImage(page, 0, 0);
    if (gutter) {
      g.fillStyle = '#fff';
      g.beginPath();
      const edge = i === 0 ? W : 0;
      g.moveTo(at(0), 0);
      g.lineTo(edge, 0);
      g.lineTo(edge, H);
      g.lineTo(at(H), H);
      g.closePath();
      g.fill();
    }
    return c;
  });

  const lines: OcrLine[] = [];
  for (let i = 0; i < cols.length; i++) {
    await step();
    const read = await readLines(cols[i], (p, stage) => onProgress(0.05 + (0.93 * (i + p)) / cols.length, cols.length > 1 ? `${stage} (${i + 1}/${cols.length} багана)` : stage));
    lines.push(...read.map((l) => ({...l, col: i})));
  }
  // Each column's ink per row, between where its text starts and ends (not the page's edge beside it).
  const level = inkLevel(page.getContext('2d', {willReadFrequently: true})!.getImageData(0, 0, W, H).data);
  const quantile = (xs: number[], q: number) => xs.sort((a, b) => a - b)[Math.floor((xs.length - 1) * q)];
  const rowInk = cols.map((c, i) => {
    const mine = lines.filter((l) => l.col === i && l.bbox.x1 - l.bbox.x0 > 30);
    const x0 = Math.max(ranges[i].x0, mine.length ? quantile(mine.map((l) => l.bbox.x0), 0.15) - Math.round(W * 0.01) : ranges[i].x0);
    const x1 = Math.min(ranges[i].x1, mine.length ? quantile(mine.map((l) => l.bbox.x1), 0.9) + Math.round(W * 0.01) : ranges[i].x1);
    const rows: number[] = new Array(H).fill(0);
    if (x1 - x0 < 2) return rows;
    const d = c.getContext('2d', {willReadFrequently: true})!.getImageData(x0, 0, x1 - x0, H).data;
    for (let p = 0; p < d.length; p += 4) if (lum(d, p) < level) rows[Math.floor(p / 4 / (x1 - x0))]++;
    return rows;
  });
  onProgress(0.99, 'Бодлогуудыг салгаж байна');
  return {canvas: page, cols, rowInk, lines, problems: splitProblems(lines, ranges, rowInk)};
}

/** The part without a line running down its left or right edge (the fold between the columns, a printed rule). */
function trimEdges<R extends {x0: number; y0: number; x1: number; y1: number}>(src: HTMLCanvasElement, r: R): R {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const band = Math.min(Math.round(w * 0.06), Math.max(8, Math.round(src.width * 0.015)));
  if (band < 1 || w < band * 4 || h < 8) return r;
  const g = src.getContext('2d', {willReadFrequently: true})!;
  // How much of each of the outer columns of pixels, top to bottom, is dark.
  const dark = (x0: number) => {
    const d = g.getImageData(x0, r.y0, band, h).data;
    const n = new Array<number>(band).fill(0);
    for (let p = 0; p < d.length; p += 4) if (lum(d, p) < 170) n[(p / 4) % band]++;
    return n.map((v) => v / h);
  };
  const right = dark(r.x1 - band);
  const left = dark(r.x0);
  let {x0, x1} = r;
  for (let k = 0; k < band; k++) if (right[k] > 0.5) x1 = Math.min(x1, r.x1 - band + k - 1);
  for (let k = band - 1; k >= 0; k--) if (left[k] > 0.5) x0 = Math.max(x0, r.x0 + k + 2);
  return {...r, x0, x1};
}

/** A problem's picture: its parts of the page (two when it goes on in the next column) one under the other. */
export function cropProblem(page: Page, regions: Region[]) {
  const W = page.canvas.width;
  const H = page.canvas.height;
  const parts = regions
    .map((r) => ({col: r.col, x0: Math.max(0, Math.round(r.x0)), y0: Math.max(0, Math.round(r.y0)), x1: Math.min(W, Math.round(r.x1)), y1: Math.min(H, Math.round(r.y1))}))
    .filter((r) => r.x1 - r.x0 > 4 && r.y1 - r.y0 > 4)
    .map((r) => trimEdges(page.cols[r.col] ?? page.canvas, r));
  const gap = 10;
  const {c, g} = make(Math.max(1, ...parts.map((r) => r.x1 - r.x0)), Math.max(1, parts.reduce((a, r) => a + r.y1 - r.y0, 0) + gap * Math.max(0, parts.length - 1)));
  let y = 0;
  for (const r of parts) {
    g.drawImage(page.cols[r.col] ?? page.canvas, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 0, y, r.x1 - r.x0, r.y1 - r.y0);
    y += r.y1 - r.y0 + gap;
  }
  return c;
}

export const canvasFile = (c: HTMLCanvasElement, name: string) =>
  new Promise<File>((resolve, reject) => c.toBlob((b) => (b ? resolve(new File([b], name, {type: 'image/png'})) : reject(new Error('Зургийг хадгалж чадсангүй.'))), 'image/png'));
