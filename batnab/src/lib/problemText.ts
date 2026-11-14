// Problems typed (or pasted) as text, the way a book prints them: a number, the question (math between $…$), then its
// answer choices a) … e) (or а) … д)), each on its own line or several on one line. The choices go to А–Д in the order
// they come (so a Cyrillic letter typed for the Latin one it looks like does no harm). A line starting with "#" is a
// note and left out; a line that follows a choice goes on with it.
import katex from 'katex';
import {LETTER_CODES, type Letter} from './topics';

export interface TextProblem {
  /** Its number as typed ("18." → 18). */
  no: number;
  text: string;
  choices?: Partial<Record<Letter, string>>;
  /** More choice marks than А–Д (the extra ones are kept in the last choice). */
  extra?: boolean;
}

/** The parts of a line outside math ($…$), for finding the choice marks in them only. */
function outsideMath(line: string) {
  const out: boolean[] = [];
  let inMath = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '$') {
      out.push(!inMath, !inMath);
      i++;
      continue;
    }
    if (line[i] === '$') {
      out.push(false);
      inMath = !inMath;
      continue;
    }
    out.push(!inMath);
  }
  return out;
}

/** Where the choice marks ("a) ", "б. ", "е)") are in a line, outside math, at its start or after a space. */
function marks(line: string) {
  const free = outsideMath(line);
  const out: {at: number; end: number}[] = [];
  const re = /(^|\s)[a-eа-дсе][).]\s+/gi;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const at = m.index + m[1].length;
    if (free[at]) out.push({at, end: m.index + m[0].length});
  }
  return out;
}

/** The problems in `text`, in the order typed. */
export function parseProblems(text: string): TextProblem[] {
  const out: TextProblem[] = [];
  let cur: (TextProblem & {last?: Letter; count: number}) | null = null;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // "12." or "12)" starts a problem ("0.5" doesn't).
    const start = /^(\d{1,3})\s*(?:\.(?!\d)|\))\s*(.*)$/.exec(line);
    let rest = line;
    if (start) {
      cur = {no: Number(start[1]), text: '', count: 0};
      out.push(cur);
      rest = start[2];
    }
    if (!cur || !rest) continue;
    const ms = marks(rest);
    // Before the first choice: the question (or, after a choice, more of that choice).
    const head = (ms.length ? rest.slice(0, ms[0].at) : rest).trim();
    if (head) {
      if (cur.last && cur.choices) cur.choices[cur.last] = `${cur.choices[cur.last]} ${head}`.trim();
      else cur.text = cur.text ? `${cur.text}\n${head}` : head;
    }
    ms.forEach((m, i) => {
      const c = cur!;
      const body = rest.slice(m.end, i + 1 < ms.length ? ms[i + 1].at : undefined).trim();
      if (c.count < LETTER_CODES.length) {
        c.last = LETTER_CODES[c.count++];
        c.choices = {...c.choices, [c.last]: body};
      } else {
        c.extra = true;
        c.choices![c.last!] = `${c.choices![c.last!]} ${rest.slice(m.at, m.end)}${body}`;
      }
    });
  }
  return out.map(({no, text, choices, extra}) => ({no, text, ...(choices ? {choices} : {}), ...(extra ? {extra} : {})}));
}

/** The math in `s` KaTeX can't typeset (each with its error), to show before it's saved. */
export function mathErrors(s: string) {
  const errs: string[] = [];
  for (const m of s.replace(/\\\$/g, '').matchAll(/\$([^$]+)\$/g))
    try {
      katex.renderToString(m[1], {throwOnError: true});
    } catch (e) {
      errs.push(`$${m[1]}$: ${(e as Error).message.replace(/^KaTeX parse error: /, '')}`);
    }
  if ((s.replace(/\\\$/g, '').match(/\$/g) ?? []).length % 2) errs.push('$ тэмдэг дутуу (томьёо хаагдаагүй)');
  return errs;
}

/** What is wrong with each problem as typed: no question, more than five choices, math that won't typeset. */
export function problemWarnings(p: TextProblem) {
  const w: string[] = [];
  if (!p.text.trim()) w.push('өгүүлбэр алга');
  if (p.extra) w.push('5-аас олон сонголт (илүү нь сүүлийнхэд нь нийлсэн)');
  for (const s of [p.text, ...Object.values(p.choices ?? {})]) w.push(...mathErrors(s ?? ''));
  return w;
}
