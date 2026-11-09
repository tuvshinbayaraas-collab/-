import katex from 'katex';
import 'katex/dist/katex.min.css';
import {useMemo} from 'react';

// "\$" is a dollar sign, not the start or end of math: kept aside while the text is cut.
const DOLLAR = '\u0000';

/** Text with inline math between $…$ ("\$" for a dollar sign), typeset with KaTeX; `display` sets fractions full size. */
export default function MathText({text, className, display}: {text: string; className?: string; display?: boolean}) {
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
    return parts
      .map((part, i) => {
        if (!isMath(part)) return plain(part);
        const math = katex.renderToString((display ? '\\displaystyle ' : '') + part.slice(1, -1).split(DOLLAR).join('\\$'), {throwOnError: false});
        // A Mongolian ending on short math ("$x$-ийг", "$0$-ээс") stays on its line (a long formula may still wrap).
        const suffix = part.length <= 14 ? /^-[\p{L}]+/u.exec(parts[i + 1] ?? '') : null;
        if (!suffix) return math;
        parts[i + 1] = parts[i + 1].slice(suffix[0].length);
        return `<span style="white-space:nowrap">${math}${plain(suffix[0])}</span>`;
      })
      .join('');
  }, [text, display]);
  return <span className={className} dangerouslySetInnerHTML={{__html: html}} />;
}
