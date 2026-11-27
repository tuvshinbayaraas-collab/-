// "Зургаас бодлогууд" (topic editor): a photographed page of numbered problems, cut into one clean picture per
// problem. The photo is turned straight and its paper made white, its columns found and read (ocr.ts), the problems
// placed (splitProblems.ts), and each problem's part of the page cut out, so formulas and figures stay as printed.
import {readLines} from './ocr';
import {pdfWords} from './pdf';
import {loadImage} from './photo';
import {findGutter, findSkew, gutterNear, splitProblems, withoutMargins, wordsToLines, type FoundProblem, type OcrLine, type Region} from './splitProblems';

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
  /** Read by the agent: its text is good, so a problem with nothing drawn goes in as text (no picture to store). */
  agent?: boolean;
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

/** The photo as a page to read: no larger than reading needs, turned straight (a PDF's page is), its paper made white. */
export async function preparePage(file: File, signal?: AbortSignal, straight = false) {
  const step = async () => {
    await breathe();
    if (signal?.aborted) throw new DOMException('Болисон', 'AbortError');
  };
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
  const m = straight ? null : darkMap(page);
  const angle = m ? Math.atan(findSkew(m.dark, m.w, m.h)) : 0;
  if (Math.abs(angle) > 0.002) {
    const turned = rotate(page, -angle);
    page.width = page.height = 0;
    page = turned;
  }
  await step();
  whiten(page);
  return page;
}

/**
 * The page's columns: two when there is a gutter (a little slanted if the photo is), each alone with the other painted
 * white, and where the gutter is at each row (`at`, null for one column). With `hint` (where the agent's boxes put the
 * columns apart), a gutter is looked for there when none is found or the one found is elsewhere.
 */
function columns(page: HTMLCanvasElement, hint?: number | null) {
  const W = page.width;
  const H = page.height;
  const map = darkMap(page);
  let gutter = findGutter(map.dark, map.w, map.h);
  if (hint != null && (!gutter || Math.abs(gutter.x - hint * map.k) > map.w * 0.08)) gutter = gutterNear(map.dark, map.w, map.h, hint * map.k);
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
  return {ranges, cols, at: gutter ? at : null};
}

/** Reads the page; `signal` stops it between steps (the dialog was closed, or went on to another page). */
export async function readPage(file: File, onProgress: (progress: number, stage: string) => void, signal?: AbortSignal): Promise<Page> {
  const step = async () => {
    await breathe();
    if (signal?.aborted) throw new DOMException('Болисон', 'AbortError');
  };
  // A PDF made from a document has its words in it, where they are printed: no reading by eye (a scan has none).
  const printed = pdfWords.get(file);
  const words = printed && printed.filter((w) => /[\p{L}\d]/u.test(w.text)).length >= 8 ? printed : null;
  onProgress(0, 'Зургийг тэгшилж байна');
  const page = await preparePage(file, signal, !!words);
  onProgress(0.04, 'Багануудыг хайж байна');
  await step();

  // Two columns: each read on its own (the other one painted out), split along the gutter, a little slanted if need be.
  const W = page.width;
  const H = page.height;
  const {ranges, cols, at} = columns(page);

  let lines: OcrLine[] = [];
  let floor = H;
  if (words) {
    // The PDF's own words (the page drawn as large as it is read here, so where they are holds): the header and footer
    // left out (the last problem then stops above them).
    ({lines, floor} = withoutMargins(
      wordsToLines(
        words,
        (b) => (at && (b.x0 + b.x1) / 2 > at((b.y0 + b.y1) / 2) ? 1 : 0),
      ),
      H,
    ));
  } else
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
    const w = x1 - x0;
    const d = c.getContext('2d', {willReadFrequently: true})!.getImageData(x0, 0, w, H).data;
    // A rule printed down beside the problems (a third of the page long and more) is in none of them.
    const down = new Uint32Array(w);
    for (let p = 0; p < d.length; p += 4) if (lum(d, p) < level) down[(p / 4) % w]++;
    for (let p = 0; p < d.length; p += 4) if (lum(d, p) < level && down[(p / 4) % w] < H * 0.3 && p / 4 / w < floor) rows[Math.floor(p / 4 / w)]++;
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

/** A problem as the agent read it: its number, its part(s) of the page in thousandths of the page's width and height,
 * its text with $math$, and its choices А–Д (A–E) when it has them. */
export interface AgentFound {
  num: number;
  boxes: {x0: number; y0: number; x1: number; y1: number}[];
  text: string;
  choices?: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', string>>;
}
const MARK_OF = {A: 'А', B: 'Б', C: 'В', D: 'Г', E: 'Д'} as const;
/**
 * A problem's parts a., b., c. (or а., б., в.), which the book prints each on its own line, run together into one line
 * by the agent: on their own lines again. Only when they come in order from a. (a lone «a.» may be anything).
 */
function partLines(text: string) {
  for (const marks of ['abcde', 'абвгд']) {
    const at = (m: string) => text.search(new RegExp(`(^|\\s)${m}\\.\\s`));
    const a = at(marks[0]);
    const b = at(marks[1]);
    if (a < 0 || b < 0 || b < a) continue;
    return text.replace(new RegExp(`[ \\t]+(?=[${marks}]\\.\\s)`, 'g'), '\n');
  }
  return text;
}

/** Where the agent marks something drawn in a problem («[зураг]»). */
const DRAWING = /\[\s*зураг\s*\]/i;
const DRAWINGS = /\s*\[\s*зураг\s*\]\s*/gi;

/**
 * A page the agent read (the page as sent, so its boxes fit), as the cutting dialog takes it. The agent knows which
 * problem is where, but its boxes are only roughly placed (often cutting the last line of choices or a column's right
 * edge), so each box is fitted to the print here: it takes its whole column's width, starts at the line nearest its
 * top, and goes down to where the next problem in that column starts (the last one in a column: through the lines
 * that follow on closely). A box across both columns keeps its place, its top and bottom moved out to blank rows. The
 * choices go after the text as printed («А) …»), where the dialog reads them from.
 */
export async function agentPage(url: string, found: AgentFound[]): Promise<Page> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const {c, g} = make(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, 0, 0);
  const W = c.width;
  const H = c.height;
  const level = inkLevel(g.getImageData(0, 0, W, H).data);
  // Two columns when the agent's boxes stand in two: the gutter is looked for between them.
  const px = found.flatMap((f) => f.boxes).map((b) => ({x0: (b.x0 / 1000) * W, x1: (b.x1 / 1000) * W})).filter((b) => !(b.x0 < W * 0.35 && b.x1 > W * 0.65));
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const left = px.filter((b) => (b.x0 + b.x1) / 2 < W / 2);
  const right = px.filter((b) => (b.x0 + b.x1) / 2 >= W / 2);
  const hint = left.length && right.length ? (median(left.map((b) => b.x1)) + median(right.map((b) => b.x0))) / 2 : null;
  const {ranges, cols, at} = columns(c, hint);

  // The print, without long upright strokes (the page's dark edge in a photo, a rule down the gutter, a graph's
  // axis): with them every row would have ink and the lines could not be told apart.
  const all = g.getImageData(0, 0, W, H).data;
  const long = Math.max(8, Math.round(H * 0.03));
  const print = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; ) {
      if (!(lum(all, (y * W + x) * 4) < level)) {
        y++;
        continue;
      }
      let e = y;
      while (e < H && lum(all, (e * W + x) * 4) < level) e++;
      if (e - y <= long) for (let k = y; k < e; k++) print[k * W + x] = 1;
      y = e;
    }
  }
  const side = (x: number, y: number) => (!at ? 0 : x < at(y) ? 0 : 1);

  // Each column's print: across (where its ink runs, not far outside the agent's boxes there) and, inside that, its
  // ink per row, and its lines (rows with ink) with the usual gap and height.
  const fit = cols.map((_, i) => {
    const r = ranges[i];
    const w = Math.max(1, r.x1 - r.x0);
    const ink = new Array<number>(w).fill(0);
    for (let y = 0; y < H; y++) for (let x = r.x0; x < r.x1; x++) if (print[y * W + x] && side(x, y) === i) ink[x - r.x0]++;
    const total = ink.reduce((a, v) => a + v, 0);
    let x0 = 0;
    let x1 = w;
    for (let x = 0, sum = 0; x < w; x++) if ((sum += ink[x]) >= total * 0.005) {
      x0 = x;
      break;
    }
    for (let x = w - 1, sum = 0; x >= 0; x--) if ((sum += ink[x]) >= total * 0.005) {
      x1 = x + 1;
      break;
    }
    const pad = Math.round(W * 0.012);
    x0 = Math.max(r.x0, r.x0 + x0 - pad);
    x1 = Math.min(r.x1, r.x0 + x1 + pad);
    const theirs = found.flatMap((f) => f.boxes).map((b) => ({x0: (b.x0 / 1000) * W, x1: (b.x1 / 1000) * W})).filter((b) => side((b.x0 + b.x1) / 2, H / 2) === i);
    if (theirs.length) {
      x0 = Math.max(x0, Math.round(Math.min(...theirs.map((b) => b.x0)) - W * 0.03));
      x1 = Math.min(x1, Math.round(Math.max(...theirs.map((b) => b.x1)) + W * 0.03));
    }
    // Not the rule down the gutter or the page's dark edge (ink down most of the page, though faint, broken and a little
    // slanted in a photo: looked for a few pixels wide), in the margin beside the print: past it.
    const faint = Math.max(level, 180);
    const stroke = (x: number) => {
      let n = 0;
      for (let y = 0; y < H; y += 2)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < W && side(xx, y) === i && lum(all, (y * W + xx) * 4) < faint) {
            n++;
            break;
          }
        }
      return n * 2 > H * 0.45;
    };
    for (let x = x0; x < Math.min(x1, x0 + pad * 3); x++) if (stroke(x)) x0 = x + 2;
    for (let x = x1 - 1; x >= Math.max(x0, x1 - pad * 3); x--) if (stroke(x)) x1 = x - 1;
    const rows = new Array<number>(H).fill(0);
    for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) if (print[y * W + x] && side(x, y) === i) rows[y]++;
    const lines: {s: number; e: number; left: number}[] = [];
    for (let y = 0, start = -1; y <= H; y++) {
      const on = y < H && rows[y] > 1;
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        const last = lines[lines.length - 1];
        if (last && start - last.e <= 2) last.e = y;
        else lines.push({s: start, e: y, left: x1});
        start = -1;
      }
    }
    // Where each line starts across: a problem's first line starts at the column's margin, with its number.
    for (const l of lines)
      for (let y = l.s; y < l.e; y++)
        for (let x = x0; x < l.left; x++)
          if (print[y * W + x] && side(x, y) === i) {
            l.left = x;
            break;
          }
    const gaps = lines.slice(1).map((l, k) => l.s - lines[k].e).filter((v) => v < H * 0.05).sort((a, b) => a - b);
    const gap = gaps[Math.floor(gaps.length / 2)] ?? Math.round(H * 0.006);
    const near = Math.max(2 * gap, Math.round(H * 0.012));
    const heights = lines.map((l) => l.e - l.s).filter((v) => v < H * 0.04).sort((a, b) => a - b);
    const lineH = Math.max(4, heights[Math.floor(heights.length / 2)] ?? Math.round(H * 0.015));
    const lefts = lines.filter((l) => l.e - l.s < H * 0.04).map((l) => l.left).sort((a, b) => a - b);
    const margin = lefts[Math.floor(lefts.length * 0.1)] ?? x0;
    return {x0, x1, rows, lines, gap, near, lineH, margin};
  });

  // Every box: its column (or both), in pixels.
  const tops = Math.round(H * 0.04);
  const boxes = found.flatMap((f, pi) =>
    f.boxes.map((b, bi) => {
      const x0 = Math.max(0, Math.min(W - 1, Math.round((b.x0 / 1000) * W)));
      const x1 = Math.max(x0 + 1, Math.min(W, Math.round((b.x1 / 1000) * W)));
      const y0 = Math.max(0, Math.min(H - 1, Math.round((b.y0 / 1000) * H)));
      const y1 = Math.max(y0 + 1, Math.min(H, Math.round((b.y1 / 1000) * H)));
      const mid = at ? at((y0 + y1) / 2) : 0;
      const col = !at ? 0 : x0 < mid - W * 0.04 && x1 > mid + W * 0.04 ? -1 : (x0 + x1) / 2 < mid ? 0 : 1;
      return {pi, bi, col, x0, x1, y0, y1, top: y0};
    }),
  );
  const regions = new Map<string, Region>();
  for (let ci = 0; ci < cols.length; ci++) {
    const {x0, x1, rows, lines, gap, near, lineH, margin} = fit[ci];
    const mine = boxes.filter((b) => b.col === ci).sort((a, b) => a.y0 - b.y0);
    // The problem's first line: near the box's top, best at the column's margin (not an indented line of choices) and
    // after more room than between a problem's own lines; with what sits just above it (a fraction's numerator). When the top is well inside something tall (a drawing above touching the problem's first
    // line), the emptiest row a line or so above the agent's top instead.
    for (const b of mine) {
      const inside = lines.find((l) => l.s <= b.y0 && b.y0 < l.e);
      if (inside && b.y0 - inside.s > lineH * 1.5) {
        let min = Infinity;
        for (let y = Math.max(inside.s, b.y0 - Math.round(lineH * 1.5)); y <= b.y0; y++) if (rows[y] < min) {
          min = rows[y];
          b.top = y;
        }
        continue;
      }
      const indented = (l: {left: number}) => l.left - margin > Math.max(W * 0.03, lineH * 2);
      const brk = Math.max(gap * 1.8, lineH * 0.8);
      let best = -1;
      let score = Infinity;
      lines.forEach((l, j) => {
        const off = Math.abs(l.s - b.y0);
        if (off > tops) return;
        const room = j > 0 ? l.s - lines[j - 1].e : lineH * 3;
        const v = off + (indented(l) ? lineH * 3 : 0) - (room > brk ? lineH * 2 : 0);
        if (v < score) {
          score = v;
          best = j;
        }
      });
      while (best > 0 && lines[best].s - lines[best - 1].e <= Math.max(3, gap * 0.6) && indented(lines[best - 1]) && lines[best - 1].e - lines[best - 1].s < lineH) best--;
      b.top = best >= 0 ? lines[best].s : b.y0;
    }
    mine.forEach((b, k) => {
      const next = mine[k + 1];
      let end: number;
      if (next && next.top > b.top) {
        // Down to the next problem: every line starting before it.
        const own = lines.filter((l) => l.s >= b.top && l.s < next.top);
        end = own.length ? own[own.length - 1].e : b.y1;
      } else {
        // The column's last: the lines the agent's box reaches into, and those that follow on closely.
        let li = -1;
        lines.forEach((l, j) => {
          if (l.s >= b.top && l.s < b.y1) li = j;
        });
        while (li >= 0 && li + 1 < lines.length && lines[li + 1].s - lines[li].e <= near) li++;
        end = li >= 0 ? lines[li].e : b.y1;
      }
      const pad = Math.round(H * 0.005);
      const above = k > 0 ? mine[k - 1] : null;
      regions.set(`${b.pi}/${b.bi}`, {col: ci, x0, x1, y0: Math.max(0, b.top - pad, above ? above.top : 0), y1: Math.min(H, end + pad, next && next.top > b.top ? next.top : H)});
    });
  }

  // A box across both columns: kept where the agent put it, its top and bottom moved out to blank rows (a little).
  const inked = (y: number, x0: number, x1: number) => {
    for (let x = x0; x < x1; x += 2) if (print[y * W + x]) return true;
    return false;
  };
  const reach = Math.round(H * 0.02);
  const out = (y: number, x0: number, x1: number, dir: -1 | 1) => {
    let k = y;
    for (let n = 0; n < reach && k > 0 && k < H - 1 && inked(k, x0, x1); n++) k += dir;
    return k;
  };
  for (const b of boxes) if (b.col < 0) regions.set(`${b.pi}/${b.bi}`, {col: -1, x0: b.x0, x1: b.x1, y0: out(b.y0, b.x0, b.x1, -1), y1: out(Math.min(H - 1, b.y1), b.x0, b.x1, 1)});

  // Something drawn in a problem (a graph, a figure, a table): ink that hangs together over more than three lines'
  // height, or two and wide as well. Letters, formulas, fraction bars, braces and integral signs are smaller.
  const step = Math.max(1, Math.round(Math.max(W, H) / 1000));
  const lineAll = fit.map((f) => f.lineH).sort((a, b) => a - b)[0] ?? Math.round(H * 0.015);
  // A drawing's lines are often fainter than the print: lighter ink counts here.
  const light = Math.max(level, 180);
  const drawn = (r: Region) => {
    const lineH = r.col >= 0 ? fit[r.col].lineH : lineAll;
    const x0 = Math.max(0, Math.round(r.x0));
    const y0 = Math.max(0, Math.round(r.y0));
    const gw = Math.max(1, Math.ceil((Math.min(W, Math.round(r.x1)) - x0) / step));
    const gh = Math.max(1, Math.ceil((Math.min(H, Math.round(r.y1)) - y0) / step));
    const on = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++)
        for (let dy = 0; dy < step && !on[gy * gw + gx]; dy++)
          for (let dx = 0; dx < step; dx++) {
            const x = x0 + gx * step + dx;
            const y = y0 + gy * step + dy;
            if (x < W && y < H && (r.col < 0 || side(x, y) === r.col) && lum(all, (y * W + x) * 4) < light) {
              on[gy * gw + gx] = 1;
              break;
            }
          }
    const seen = new Uint8Array(gw * gh);
    const stack: number[] = [];
    for (let i = 0; i < on.length; i++) {
      if (!on[i] || seen[i]) continue;
      let [ax, ay, bx, by] = [i % gw, Math.floor(i / gw), i % gw, Math.floor(i / gw)];
      seen[i] = 1;
      stack.push(i);
      while (stack.length) {
        const j = stack.pop()!;
        const jx = j % gw;
        const jy = Math.floor(j / gw);
        ax = Math.min(ax, jx);
        bx = Math.max(bx, jx);
        ay = Math.min(ay, jy);
        by = Math.max(by, jy);
        for (let ny = jy - 1; ny <= jy + 1; ny++)
          for (let nx = jx - 1; nx <= jx + 1; nx++) {
            const k = ny * gw + nx;
            if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && on[k] && !seen[k]) {
              seen[k] = 1;
              stack.push(k);
            }
          }
      }
      const h = (by - ay + 1) * step;
      const w = (bx - ax + 1) * step;
      // A lone upright stroke is the rule between the columns (or a bar), not a drawing.
      if (w <= step * 2) continue;
      // Tall and thin (a system's brace, a bracket, an integral sign) is print, not a drawing.
      if ((h > lineH * 3 && w > lineH * 1.5) || (h > lineH * 2 && w > lineH * 3)) return true;
    }
    return false;
  };

  // The agent marks a drawing «[зураг]» where it is (agents/split.md); seen here too, for what it may miss.
  const problems: FoundProblem[] = found.map((f, pi) => {
    const plain = (v?: string) => (v ?? '').replace(DRAWINGS, ' ').replace(/[ \t]{2,}/g, ' ').trim();
    // A bare number among formula choices ("6,4" beside "$-0,4$") typeset as math too, so they look alike.
    const num = (v: string) => (/^[-−]?\d+(?:[.,]\d+)?$/.test(v) ? '$' + v.replace('−', '-') + '$' : v);
    const choices = (Object.keys(MARK_OF) as (keyof typeof MARK_OF)[]).filter((k) => plain(f.choices?.[k])).map((k) => `${MARK_OF[k]}) ${num(plain(f.choices![k]))}`);
    const parts = f.boxes.map((_, bi) => regions.get(`${pi}/${bi}`)!);
    const marked = DRAWING.test(f.text) || Object.values(f.choices ?? {}).some((c) => DRAWING.test(c ?? ''));
    const text = [partLines(plain(f.text)), choices.join('  ')].filter(Boolean).join('\n');
    return {num: f.num, text, regions: parts, drawing: marked || parts.some(drawn), choice: Object.values(f.choices ?? {}).some((c) => !!c?.trim())};
  });
  return {canvas: c, cols, rowInk: fit.map((f) => f.rows), lines: [], problems, agent: true};
}
