import katex from 'katex';
import 'katex/dist/katex.min.css';
import {useMemo} from 'react';

/** Text with inline math between $…$, typeset with KaTeX; `display` sets fractions full size. */
export default function MathText({text, className, display}: {text: string; className?: string; display?: boolean}) {
  const html = useMemo(
    () =>
      text
        .split(/(\$[^$]+\$)/g)
        .map((part) =>
          part.length > 1 && part.startsWith('$') && part.endsWith('$')
            ? katex.renderToString((display ? '\\displaystyle ' : '') + part.slice(1, -1), {throwOnError: false})
            : part.replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]!),
        )
        .join(''),
    [text, display],
  );
  return <span className={className} dangerouslySetInnerHTML={{__html: html}} />;
}
