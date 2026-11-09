// Problems typed (or pasted) as text, the way a book prints them: a number, the question (math between $…$), then its
// answer choices a) … e) (or а) … д)), each on its own line or several on one line. A line starting with "#" is a
// note and left out; a line that follows a choice goes on with it.
import katex from 'katex';
import {LETTER_CODES, type Letter} from './topics';

export interface TextProblem {
  /** Its number as typed ("18." → 18). */
  no: number;
  text: string;
  choices?: Partial<Record<Letter, string>>;
}

const LATIN = 'abcde';
const CYRILLIC = 'абвгд';
/** Cyrillic letters typed for the Latin ones they look like (a Mongolian keyboard's "с" and "е" for c and e). */
const LOOKALIKE: Record<string, number> = {с: 2, е: 4};

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

/** Where the choice marks ("a) ", "б. ") are in a line, outside math, at its start or after a space. */
function marks(line: string) {
  const free = outsideMath(line);
  const out: {at: number; end: number; letter: Letter}[] = [];
  const re = /(^|\s)([a-eа-дсе])[).]\s+/gi;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const at = m.index + m[1].length;
    if (!free[at]) continue;
    const ch = m[2].toLowerCase();
    const k = LATIN.includes(ch) ? LATIN.indexOf(ch) : CYRILLIC.includes(ch) ? CYRILLIC.indexOf(ch) : LOOKALIKE[ch];
    out.push({at, end: m.index + m[0].length, letter: LETTER_CODES[k]});
  }
  return out;
}

/** The problems in `text`, in the order typed. */
export function parseProblems(text: string): TextProblem[] {
  const out: TextProblem[] = [];
  let cur: (TextProblem & {last?: Letter}) | null = null;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const start = /^(\d{1,3})\s*[.)]\s*(.*)$/.exec(line);
    let rest = line;
    if (start) {
      cur = {no: Number(start[1]), text: ''};
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
      const body = rest.slice(m.end, i + 1 < ms.length ? ms[i + 1].at : undefined).trim();
      cur!.choices = {...cur!.choices, [m.letter]: body};
      cur!.last = m.letter;
    });
  }
  return out.map(({no, text, choices}) => ({no, text, ...(choices ? {choices} : {})}));
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

/** What is wrong with each problem as typed: no question, math that won't typeset. */
export function problemWarnings(p: TextProblem) {
  const w: string[] = [];
  if (!p.text.trim()) w.push('өгүүлбэр алга');
  for (const s of [p.text, ...Object.values(p.choices ?? {})]) w.push(...mathErrors(s ?? ''));
  return w;
}
