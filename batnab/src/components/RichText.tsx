import type {ReactNode} from 'react';
import {CLOCK_RE, parseClock, seekTo} from '../lib/playback';

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/**
 * Plain user text rendered with clickable links, highlighted @mentions and — when `timestamps`
 * is on — "1:23" style times that jump the player on the page to that moment.
 */
export default function RichText({text, timestamps = false}: {text: string; timestamps?: boolean}) {
  const out: ReactNode[] = [];
  text.split(URL_RE).forEach((part, i) => {
    if (i % 2 === 1) {
      out.push(
        <a key={`u${i}`} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-400 hover:underline">
          {part}
        </a>,
      );
      return;
    }
    part.split(/(^|\s)(@[^\s@]+)/g).forEach((p, j) => {
      if (p.startsWith('@')) {
        out.push(
          <span key={`m${i}-${j}`} className="text-blue-400">
            {p}
          </span>,
        );
        return;
      }
      if (!timestamps) {
        out.push(p);
        return;
      }
      p.split(CLOCK_RE).forEach((q, k) => {
        if (k % 2 === 1)
          out.push(
            <button
              key={`t${i}-${j}-${k}`}
              type="button"
              onClick={() => seekTo(parseClock(q))}
              className="text-blue-400 hover:underline"
            >
              {q}
            </button>,
          );
        else if (q) out.push(q);
      });
    });
  });
  return <>{out}</>;
}
