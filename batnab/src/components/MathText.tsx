import katex from 'katex';
import 'katex/dist/katex.min.css';
import {useMemo} from 'react';

// "\$" is a dollar sign, not the start or end of math: kept aside while the text is cut.
const DOLLAR = '\u0000';

/** Math that is hard to read small (a fraction, a limit, a sum, an integral, a system, a matrix): full size in text. */
const TALL = /\\(d?frac|lim|sum|int|iint|prod|binom|begin\{(cases|[pbvBV]?matrix|array)\})/;
/** A comma between digits is the decimal mark ("3,1"): no space after it, as KaTeX puts after a list's comma ("3, 1"). */
const decimals = (tex: string) => tex.replace(/(\d),(?=\d)/g, '$1{,}');

/**
 * Text with inline math between $…$ ("\$" for a dollar sign), typeset with KaTeX; `display` sets fractions full size
 * ('tall': only the math that is hard to read small).
 */
export default function MathText({text, className, display}: {text: string; className?: string; display?: boolean | 'tall'}) {
  const html = useMemo(() => {
    const parts = text
      .replace(/\u0000/g, '')
      .replace(/\\\$/g, DOLLAR)
      .split(/(\$[^$]+\$)/g);
    const isMath = (part: string) => part.length > 1 && part.startsWith('$') && part.endsWith('$');
    const plain = (part: string) =>
      part
        .split(DOLLAR)
        .join('$')
        .replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]!);
    let html = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!isMath(part)) {
        html += plain(part);
        continue;
      }
      const tex = decimals(part.slice(1, -1).split(DOLLAR).join('\\$'));
      const math = katex.renderToString((display === true || (display === 'tall' && TALL.test(tex)) ? '\\displaystyle ' : '') + tex, {throwOnError: false});
      // A Mongolian ending on short math ("$x$-ийг", "$0$-ээс") stays on its line (a long formula may still wrap).
      const suffix = part.length <= 14 ? /^-\p{L}+/u.exec(parts[i + 1] ?? '') : null;
      if (suffix) {
        html += `<span style="white-space:nowrap">${math}${plain(suffix[0])}</span>`;
        parts[i + 1] = parts[i + 1].slice(suffix[0].length);
      } else html += math;
    }
    return html;
  }, [text, display]);
  return <span className={className} dangerouslySetInnerHTML={{__html: html}} />;
}
