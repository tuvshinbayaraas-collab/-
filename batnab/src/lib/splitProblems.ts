// Splitting a photographed page of numbered problems ("1. …", "2. …", in one or two columns) into one picture (and the
// read text) per problem, from the OCR'd lines of each column. Pure functions: tuned on real book pages.

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface OcrLine {
  col: number;
  text: string;
  bbox: Box;
  words: {text: string; bbox: Box}[];
}
/** A part of the page, in a column. */
export interface Region extends Box {
  col: number;
}
export interface FoundProblem {
  num: number;
  /** Its number wasn't read: placed by the gaps between lines (worth a look). */
  guessed?: boolean;
  /** The read text, without its number. */
  text: string;
  /** The parts of the page it covers, in reading order (two when it goes on in the next column). */
  regions: Region[];
}

/** A "word" that is only marks: the page edge's shadow, the column rule, specks. */
const JUNK = /^[\s|!¦[\](){}~:;'"`.,·•_\-–—]*$/;
const real = (l: OcrLine) => l.words.filter((w) => !JUNK.test(w.text));

/**
 * The number a line starts with: "12." (also "12," "12)", which count for less; "418." or "4.18." read for ".18."
 * give 18), or null.
 */
export function leadNumber(text: string): {n: number; sure: boolean} | null {
  const m = /^[^\p{L}\d]{0,4}(?:\d[.,])?(\d{1,3})\s?([.,)])/u.exec(text);
  if (!m) return null;
  const n = Number(m[1].length === 3 ? m[1].slice(-2) : m[1]);
  return n >= 1 && n <= 99 ? {n, sure: m[2] === '.'} : null;
}

/** Letters a digit is misread as, at the start of a line ("Т." for "7."). */
const LOOKALIKE: Record<string, string> = {Т: '7', T: '7', З: '3', з: '3', б: '6', О: '0', о: '0', O: '0', o: '0', I: '1', l: '1', S: '5', g: '9'};

/**
 * Whether the line starts with this number followed by a space or a mark: also read as "3 0,008" (for "3. 0,008"),
 * "Т." (for "7."), "4.18." (a speck before "18.").
 */
function startsWith(text: string, n: number) {
  if (new RegExp(`^[^\\p{L}\\d]{0,4}(?:\\d[.,])?\\d?${n}(?:[\\s.,)]|$)`, 'u').test(text)) return true;
  // Its tens lost ("Т." or "7." for "17."), and only with the full stop after it.
  const m = /^[^\p{L}\d]{0,4}([\p{L}\d]{1,2})([.,)])/u.exec(text);
  if (!m) return false;
  const read = [...m[1]].map((ch) => LOOKALIKE[ch] ?? ch).join('');
  return read === String(n) || (n >= 10 && m[2] === '.' && read === String(n % 10));
}

/** The line without its number: "12. …", "3 …", "Т. …" (for 7); a guessed problem's misread number ("8," for 6) too. */
function unnumber(text: string, n: number, guessed?: boolean) {
  const m = /^[^\p{L}\d]{0,4}([\p{L}\d]{1,3})(?:\s?[.,)]|\s)\s*/u.exec(text);
  if (!m) return text;
  const read = [...m[1]].map((ch) => LOOKALIKE[ch] ?? ch).join('');
  return read.endsWith(String(n)) || (guessed && /^\d+$/.test(read) && leadNumber(text)) ? text.slice(m[0].length) : text;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * The problems on a page, from its read lines (each with its column) and the columns. With `rowInk` (each column's
 * dark pixels per row), a column's last problem also takes in a figure below its last line that held no text.
 */
export function splitProblems(lines: OcrLine[], cols: {x0: number; x1: number}[], rowInk?: number[][]): FoundProblem[] {
  const read = lines.filter((l) => l.col < cols.length && real(l).length);
  if (!read.length) return [];
  const width = cols.map((c) => c.x1 - c.x0);
  const tol = (c: number) => Math.max(18, width[c] * 0.05);
  // Each column's left margin: where most of its lines start (a problem's number sits there).
  const margin = cols.map((_, c) => {
    const xs = read
      .filter((l) => l.col === c)
      .map((l) => real(l)[0].bbox.x0)
      .sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length * 0.15)] : 0;
  });
  // Each line as its words, less specks out in the margin before them (the page's edge, a "+." left of "3."), and
  // its box from those (marks at the page's edge would stretch it). Reading order: column by column, top to bottom.
  const ordered: OcrLine[] = cols.flatMap((_, c) =>
    read
      .filter((l) => l.col === c)
      .map((l) => {
        const ws = real(l);
        let k = 0;
        while (k < ws.length - 1 && ws[k].bbox.x0 < margin[c] - tol(c) && ws[k].text.length <= 3 && !leadNumber(ws[k].text)) k++;
        const kept = ws.slice(k);
        const bbox = {
          x0: kept[0].bbox.x0,
          y0: Math.min(...kept.map((w) => w.bbox.y0)),
          x1: Math.max(...kept.map((w) => w.bbox.x1)),
          y1: Math.max(...kept.map((w) => w.bbox.y1)),
        };
        return {col: c, text: kept.map((w) => w.text).join(' '), words: kept, bbox};
      })
      .sort((a, b) => a.bbox.y0 - b.bbox.y0),
  );
  const startX = (l: OcrLine) => l.bbox.x0;
  const text = (l: OcrLine) => l.text;
  const atMargin = (l: OcrLine) => Math.abs(startX(l) - margin[l.col] - tol(l.col) / 2) <= tol(l.col) * 1.5;
  const height = median(ordered.map((l) => l.bbox.y1 - l.bbox.y0)) || 20;
  // The usual space between two lines of a column.
  const gapAbove = (i: number) => (i > 0 && ordered[i - 1].col === ordered[i].col ? ordered[i].bbox.y0 - ordered[i - 1].bbox.y1 : Infinity);
  const lineGap = Math.max(median(ordered.map((_, i) => gapAbove(i)).filter((g) => g < Infinity).map((g) => Math.max(0, g))), height * 0.3);
  // A problem's first line can sit below a fraction's top or a formula beside it: with the indented lines just above.
  const top = (i: number, floor = 0) => {
    const l = ordered[i];
    let t = i;
    while (t - 1 >= floor && ordered[t - 1].col === l.col && startX(ordered[t - 1]) > startX(l) + tol(l.col) / 2 && l.bbox.y0 - ordered[t - 1].bbox.y1 < height * 0.8) t--;
    return t;
  };

  // 1. Lines that clearly start a problem; the longest run of them whose numbers go up (by 1–3), "12." before "12,".
  const cand = ordered.flatMap((l, i) => {
    const n = atMargin(l) ? leadNumber(text(l)) : null;
    return n === null ? [] : [{i, n: n.n, w: n.sure ? 3 : 2}];
  });
  if (!cand.length) return [];
  const best: number[] = cand.map((c) => c.w);
  const prev: number[] = cand.map(() => -1);
  for (let a = 0; a < cand.length; a++)
    for (let b = 0; b < a; b++)
      if (cand[a].n > cand[b].n && cand[a].n - cand[b].n <= 3 && best[b] + cand[a].w > best[a]) {
        best[a] = best[b] + cand[a].w;
        prev[a] = b;
      }
  let end = best.indexOf(Math.max(...best));
  const chain: {i: number; n: number; guessed?: boolean}[] = [];
  for (; end >= 0; end = prev[end]) chain.unshift(cand[end]);

  // 2. The numbers the run skipped (read as "3 0,008", "Т." or "~. 3"): the expected number at the margin, between its
  // neighbours; and before the first / after the last.
  type Start = {i: number; n: number; guessed?: boolean};
  const find = (n: number, from: number, to: number) => {
    for (let i = from; i < to; i++) if (atMargin(ordered[i]) && startsWith(text(ordered[i]), n)) return i;
    return -1;
  };
  // Numbers not read at all: at the widest gaps above a line at the margin between two found ones (more so a line
  // starting with some number, "8," for "6."), in order.
  const guess = (ns: number[], after: number, before: number): Start[] => {
    const spots = ordered
      .map((_, i) => ({i, gap: gapAbove(top(i, after + 1))}))
      .filter(({i, gap}) => i > after + 1 && i < before && gap < Infinity && gap > lineGap * 1.5 && atMargin(ordered[i]))
      .map((s) => ({...s, score: s.gap * (leadNumber(text(ordered[s.i])) ? 2 : 1)}))
      .sort((a, b) => b.score - a.score)
      .slice(0, ns.length)
      .sort((a, b) => a.i - b.i);
    return spots.map((p, j) => ({i: p.i, n: ns[j + ns.length - spots.length], guessed: true}));
  };
  const starts: Start[] = [];
  for (let k = 0; k < chain.length; k++) {
    if (k === 0) {
      const before: Start[] = [];
      for (let n = chain[0].n - 1, to = chain[0].i; n >= 1; n--) {
        const i = find(n, 0, to);
        if (i < 0) break;
        before.unshift({i, n});
        to = i;
      }
      starts.push(...before);
    } else {
      let last = starts[starts.length - 1];
      let missing: number[] = [];
      for (let n = last.n + 1; n < chain[k].n; n++) {
        const i = find(n, last.i + 1, chain[k].i);
        if (i < 0) {
          missing.push(n);
          continue;
        }
        starts.push(...guess(missing, last.i, i));
        last = {i, n};
        starts.push(last);
        missing = [];
      }
      starts.push(...guess(missing, last.i, chain[k].i));
    }
    starts.push(chain[k]);
  }
  for (let n = starts[starts.length - 1].n + 1; ; n++) {
    const i = find(n, starts[starts.length - 1].i + 1, ordered.length);
    if (i < 0) break;
    starts.push({i, n});
  }
  const numbered = new Set(starts.map((s) => ordered[s.i]));
  for (let k = 0; k < starts.length; k++) starts[k] = {...starts[k], i: top(starts[k].i, k > 0 ? starts[k - 1].i + 1 : 0)};

  // 3. Each problem: its lines up to the next one; per column, the column's width from its first line to the next
  // problem (or its last line, leaving out a page number or footer set apart at the bottom).
  const pad = Math.round(height * 0.5);
  const short = (l: OcrLine) => l.bbox.x1 - startX(l) < width[l.col] * 0.5;
  const colBox = cols.map((c, ci) => {
    // From the margin (a number hanging a little before it too), not from specks at the page's edge.
    const ls = ordered.filter((l) => l.col === ci && startX(l) >= margin[ci] - tol(ci) * 1.5);
    if (!ls.length) return c;
    return {x0: Math.max(c.x0, Math.min(...ls.map(startX)) - pad), x1: Math.min(c.x1, Math.max(...ls.map((l) => l.bbox.x1)) + pad)};
  });
  return starts.map((s, k) => {
    const next = starts[k + 1];
    const own = ordered.slice(s.i, next ? next.i : ordered.length);
    const regions: Region[] = [];
    for (const c of [...new Set(own.map((l) => l.col))]) {
      let part = own.filter((l) => l.col === c);
      // Going on at the top of the next column — unless that's only a short heading ("ТЕСТ 3.Б").
      if (c !== ordered[s.i].col && part.every(short)) continue;
      const nextHere = next && ordered[next.i].col === c ? ordered[next.i] : null;
      let floor = Infinity;
      if (!nextHere) {
        // A footer: short lines after a wide gap at the end of the column.
        const cut = part.findIndex((l, j) => j > 0 && l.bbox.y0 - part[j - 1].bbox.y1 > lineGap * 3 + height && part.slice(j).every(short));
        if (cut > 0) {
          floor = part[cut].bbox.y0 - pad;
          part = part.slice(0, cut);
        }
      }
      if (!part.length) continue;
      let y1 = nextHere ? nextHere.bbox.y0 - Math.round(pad / 2) : Math.max(...part.map((l) => l.bbox.y1));
      const rows = rowInk?.[c];
      if (!nextHere && rows) {
        // Ink going on below (a graph, a drawing), with no gap wider than two lines, short of the footer.
        const end = Math.min(rows.length, floor);
        for (let y = y1, last = y1; y < end && y - last <= height * 2; y++)
          if (rows[y] > 2) {
            last = y;
            y1 = y;
          }
      }
      regions.push({
        col: c,
        x0: colBox[c].x0,
        x1: colBox[c].x1,
        y0: Math.max(0, Math.min(...part.map((l) => l.bbox.y0)) - pad),
        y1: nextHere ? y1 : y1 + pad,
      });
    }
    const read = own
      .map((l) => (numbered.has(l) ? unnumber(text(l), s.n, s.guessed) : text(l)))
      .join('\n');
    return {num: s.n, text: read, regions, ...(s.guessed ? {guessed: true} : {})};
  });
}

// ---- the page's picture: `dark[y * w + x]` is 1 where there is ink ----

/**
 * How much the page's lines slope (dy/dx: the photo taken a little turned): the slope that lines the ink up into the
 * sharpest rows.
 */
export function findSkew(dark: Uint8Array, w: number, h: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  // Enough ink to tell (every pixel of a dark page would only be slower).
  const step = Math.max(1, Math.round(dark.reduce((a, v) => a + v, 0) / 150000));
  for (let i = 0, k = 0; i < dark.length; i++)
    if (dark[i] && k++ % step === 0) {
      xs.push((i % w) - w / 2);
      ys.push(Math.floor(i / w));
    }
  const off = Math.round(h / 2);
  const rows = new Float64Array(h * 2);
  let best = 0;
  let bestScore = -1;
  for (let deg = -4; deg <= 4.001; deg += 0.1) {
    const t = Math.tan((deg * Math.PI) / 180);
    rows.fill(0);
    for (let k = 0; k < xs.length; k++) {
      const r = Math.round(ys[k] - t * xs[k]) + off;
      if (r >= 0 && r < rows.length) rows[r]++;
    }
    let score = 0;
    for (const v of rows) score += v * v;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/**
 * Where the page splits into two columns: the straightest band with (almost) no ink down its middle, a little slanted
 * when the photo is (`x` at mid-height, moving `slope` per row down). Null for one column.
 */
export function findGutter(dark: Uint8Array, w: number, h: number): {x: number; slope: number} | null {
  const win = Math.max(6, Math.round(w / 100));
  const lo = Math.round(w * 0.35);
  const hi = Math.round(w * 0.65) - win;
  let best: {x: number; slope: number; ratio: number} | null = null;
  for (let k = -6; k <= 6; k++) {
    const slope = k * 0.005;
    const raw = new Array<number>(w).fill(0);
    for (let y = 0; y < h; y += 2) {
      const dx = Math.round(slope * (y - h / 2));
      for (let x = Math.max(0, lo - 4); x < Math.min(w, hi + win + 4); x++) if (x + dx >= 0 && x + dx < w && dark[y * w + x + dx]) raw[x]++;
    }
    // A rule printed between the columns is a thin stroke: each x's median with its neighbours leaves it out.
    const ink = raw.map((_, x) => (x >= lo && x < hi + win ? median(raw.slice(x - 3, x + 4)) : 0));
    let total = 0;
    let min = Infinity;
    let at = 0;
    for (let x = lo; x <= hi; x++) {
      let sum = 0;
      for (let j = 0; j < win; j++) sum += ink[x + j];
      total += sum;
      if (sum < min) {
        min = sum;
        at = x + Math.round(win / 2);
      }
    }
    const ratio = min / Math.max(1, total / (hi - lo + 1));
    if (!best || ratio < best.ratio) best = {x: at, slope, ratio};
  }
  if (!best || best.ratio >= 0.3) return null;
  // Two columns have text on both sides: not one column with blank space beside its shorter lines. Measured as how
  // much of the width has ink (a dark shadow at the page's edge is narrow, however dark).
  const ink = new Array<number>(w).fill(0);
  for (let i = 0; i < dark.length; i++) if (dark[i]) ink[i % w]++;
  const inked = ink.map((v) => v > h * 0.02);
  const left = inked.filter((v, x) => v && x < best.x).length;
  const total = inked.filter(Boolean).length;
  return left >= total * 0.25 && left <= total * 0.75 ? {x: best.x, slope: best.slope} : null;
}

/** The widest run of blank rows inside y0…y1 (where to split a box holding two problems), from each row's ink. */
export function widestGap(rowInk: number[], y0: number, y1: number) {
  let best = {at: Math.round((y0 + y1) / 2), len: 0};
  const lo = y0 + Math.round((y1 - y0) * 0.1);
  const hi = y1 - Math.round((y1 - y0) * 0.1);
  for (let y = lo, start = -1; y <= hi; y++) {
    const blank = (rowInk[y] ?? 0) <= 1;
    if (blank && start < 0) start = y;
    if ((!blank || y === hi) && start >= 0) {
      if (y - start > best.len) best = {at: Math.round((start + y) / 2), len: y - start};
      start = -1;
    }
  }
  return best.at;
}

/** Choice marks read in the text ("А)", "Б)", "B)"…): two or more and it's an А–Д problem even when the choices' formulas were not read. */
export const hasChoices = (text: string) => (text.match(/(?:^|[\s|(])[АAаБ6бВBвГTIгДDд]\s?\)/g) ?? []).length >= 2;

/**
 * Whether the read text can stand for the problem: mostly real words and plain numbers. Formulas (fractions, roots,
 * powers) and figures come out as broken bits, and those problems are better kept as the picture.
 */
export function readsWell(text: string) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return false;
  const good = tokens.filter((t) => /^[(«"]?(?:[\p{Script=Cyrillic}]{2,}|\d+(?:[.,]\d+)?|[А-ЯA-Z]\)|[a-zA-Z]|[=+\-:?])[)»".,?!:;]*$/u.test(t)).length;
  return good / tokens.length >= 0.85;
}

/** Choices А)–Д) in a problem's read text, when at least four are found in order: the question and the choices. */
export function parseChoices(text: string): {stem: string; choices: string[]} | null {
  const marks = [/[АAа]/, /[Б6б]/, /[ВBв]/, /[ГTIг]/, /[ДDд]/];
  const found: {k: number; at: number; len: number}[] = [];
  const re = /(^|[\s|])([^\s|])\s?\)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const k = found.length;
    if (k < 5 && marks[k].test(m[2])) found.push({k, at: m.index + m[1].length, len: m[0].length - m[1].length});
  }
  if (found.length < 4) return null;
  const choices = found.map((f, j) => text.slice(f.at + f.len, j + 1 < found.length ? found[j + 1].at : undefined).replace(/\s+/g, ' ').trim());
  return {stem: text.slice(0, found[0].at).trim(), choices};
}
