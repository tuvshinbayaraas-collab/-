// A problem's picture often has much empty paper around the problem (or a wide blank band inside it): shown at the
// card's width, the print then comes out small. The empty paper is cut away so the print fills the width: the margins
// around the print, and a blank band across the picture taller than about two lines made one line high. Nothing else
// is moved or changed; a photo or a dark picture is left as it is.

export interface Trimmed {
  url: string;
  width: number;
  height: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Runs of `true` in `on`, as [start, end) pairs. */
function runs(on: (i: number) => boolean, n: number) {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const v = i < n && on(i);
    if (v && start < 0) start = i;
    if (!v && start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  }
  return out;
}

/**
 * Which pixels are print: each pixel's brightness against the paper's around it (the brightest tenth of each 32 px
 * square, or of a neighbour where print fills the square — light falls unevenly on a photographed page), then the
 * level between paper and print (Otsu's). Null when it doesn't look like print on paper.
 */
function inkOf(px: Uint8ClampedArray, W: number, H: number) {
  const lum = new Uint8Array(W * H);
  let dim = 0;
  for (let i = 0; i < lum.length; i++) {
    lum[i] = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000;
    if (lum[i] < 110) dim++;
  }
  // A photo or a dark picture (much of it dark to begin with) isn't print on paper.
  if (dim > W * H * 0.3) return null;
  const B = 32;
  const gw = Math.ceil(W / B);
  const gh = Math.ceil(H / B);
  const level = new Float32Array(gw * gh);
  const hist = new Uint32Array(256);
  for (let by = 0; by < gh; by++)
    for (let bx = 0; bx < gw; bx++) {
      hist.fill(0);
      let n = 0;
      for (let y = by * B; y < Math.min(H, by * B + B); y++)
        for (let x = bx * B; x < Math.min(W, bx * B + B); x++) {
          hist[lum[y * W + x]]++;
          n++;
        }
      let k = 255;
      for (let seen = 0; k > 0 && (seen += hist[k]) < n * 0.1; ) k--;
      level[by * gw + bx] = k;
    }
  const paper = new Float32Array(gw * gh);
  for (let by = 0; by < gh; by++)
    for (let bx = 0; bx < gw; bx++) {
      let p = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = bx + dx;
          const cy = by + dy;
          if (cx >= 0 && cy >= 0 && cx < gw && cy < gh) p = Math.max(p, level[cy * gw + cx]);
        }
      paper[by * gw + bx] = Math.max(60, p);
    }
  const norm = new Uint8Array(W * H);
  const all = new Uint32Array(256);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = Math.min(255, (lum[y * W + x] * 255) / paper[Math.floor(y / B) * gw + Math.floor(x / B)]);
      norm[y * W + x] = v;
      all[v | 0]++;
    }
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * all[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let t = 128;
  for (let i = 0; i < 256; i++) {
    wB += all[i];
    if (!wB) continue;
    const wF = norm.length - wB;
    if (!wF) break;
    sumB += i * all[i];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      t = i;
    }
  }
  // Too little contrast between paper and print, or most of it dark: not print on paper.
  if (t > 235) return null;
  const ink = new Uint8Array(W * H);
  let dark = 0;
  for (let i = 0; i < norm.length; i++)
    if (norm[i] < t) {
      ink[i] = 1;
      dark++;
    }
  if (dark < W * H * 0.0005 || dark > W * H * 0.35) return null;
  return ink;
}

/** The parts of the picture to keep: the print's box with a margin, and the rows to keep within it. */
export function plan(ink: Uint8Array, W: number, H: number) {
  const rowInk = new Uint32Array(H);
  const colInk = new Uint32Array(W);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (ink[y * W + x]) {
        rowInk[y]++;
        colInk[x]++;
      }
  // A speck of dust doesn't count as print.
  const rows = runs((y) => rowInk[y] >= Math.max(1, W * 0.0015), H).filter(([a, b]) => b - a >= 2);
  const cols = runs((x) => colInk[x] >= Math.max(1, H * 0.0015), W).filter(([a, b]) => b - a >= 2);
  if (!rows.length || !cols.length) return null;
  const lineH = Math.max(8, median(rows.map(([a, b]) => b - a)));
  const m = Math.round(Math.min(30, Math.max(6, lineH * 0.45)));
  const x0 = Math.max(0, cols[0][0] - m);
  const x1 = Math.min(W, cols[cols.length - 1][1] + m);
  const y0 = Math.max(0, rows[0][0] - m);
  const y1 = Math.min(H, rows[rows.length - 1][1] + m);
  // Blank bands between rows of print taller than about two lines become one line high.
  const keep: [number, number][] = [];
  let from = y0;
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i][0] - rows[i - 1][1];
    if (gap > lineH * 2.2) {
      const cut0 = rows[i - 1][1] + Math.round(lineH / 2);
      keep.push([from, cut0]);
      from = rows[i][0] - Math.round(lineH / 2);
    }
  }
  keep.push([from, y1]);
  const height = keep.reduce((n, [a, b]) => n + b - a, 0);
  return {x0, x1, keep, height, saved: 1 - ((x1 - x0) * height) / (W * H)};
}

const load = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/** The picture at `url` with its empty paper cut away (the picture itself when there is little to cut, or it isn't print). */
async function trim(url: string): Promise<Trimmed> {
  const img = await load(url);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const same = {url, width: W, height: H};
  if (W < 40 || H < 20) return same;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', {willReadFrequently: true});
  if (!g) return same;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.drawImage(img, 0, 0);
  const ink = inkOf(g.getImageData(0, 0, W, H).data, W, H);
  c.width = c.height = 0;
  const p = ink && plan(ink, W, H);
  // Not worth it for a few per cent.
  if (!p || p.saved < 0.08) return same;
  const out = document.createElement('canvas');
  out.width = p.x1 - p.x0;
  out.height = p.height;
  const o = out.getContext('2d')!;
  let y = 0;
  for (const [a, b] of p.keep) {
    o.drawImage(img, p.x0, a, out.width, b - a, 0, y, out.width, b - a);
    y += b - a;
  }
  const jpeg = url.startsWith('data:image/jpeg');
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, jpeg ? 'image/jpeg' : 'image/png', 0.9));
  if (!blob) return same;
  return {url: URL.createObjectURL(blob), width: out.width, height: out.height};
}

// Trimmed pictures, the last few kept (a topic's problems are seen again on going back).
const cache = new Map<string, Promise<Trimmed>>();

/** `url`'s picture with its empty paper cut away; on any trouble, the picture itself. */
export function trimmed(url: string) {
  let p = cache.get(url);
  if (!p) {
    p = trim(url).catch(() => ({url, width: 0, height: 0}));
    cache.set(url, p);
    // Dropped from here only: a picture still on the page keeps its own.
    if (cache.size > 60) cache.delete(cache.keys().next().value!);
  }
  return p;
}
