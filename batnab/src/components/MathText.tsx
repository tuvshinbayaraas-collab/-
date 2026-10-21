import katex from 'katex';
import 'katex/dist/katex.min.css';
import {useMemo} from 'react';

// "\$" is a dollar sign, not the start or end of math: kept aside while the text is cut.
const DOLLAR = '\u0000';

/** Text with inline math between $…$ ("\$" for a dollar sign), typeset with KaTeX; `display` sets fractions full size. */
export default function MathText({text, className, display}: {text: string; className?: string; display?: boolean}) {
  const html = useMemo(
    () =>
      text
        .replace(/\u0000/g, '')
        .replace(/\\\$/g, DOLLAR)
        .split(/(\$[^$]+\$)/g)
        .map((part) =>
          part.length > 1 && part.startsWith('$') && part.endsWith('$')
            ? katex.renderToString((display ? '\\displaystyle ' : '') + part.slice(1, -1).split(DOLLAR).join('\\$'), {throwOnError: false})
            : part.split(DOLLAR).join('$').replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]!),
        )
        .join(''),
    [text, display],
  );
  return <span className={className} dangerouslySetInnerHTML={{__html: html}} />;
}
