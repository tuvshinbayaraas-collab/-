import {useState, type ReactNode} from 'react';
import {flushSync} from 'react-dom';

/**
 * The list the question cards go in. Cards off screen are only laid out as they come near it, which makes a
 * 30-question test open much faster on a phone. `full` lays them all out (see useJump).
 */
export function QuestionList({full, children}: {full?: boolean; children: ReactNode}) {
  // Until a card has been on screen its height is estimated (about a typical card's).
  const lazy = '[&>li]:[content-visibility:auto] [&>li]:[contain-intrinsic-size:auto_180px] sm:[&>li]:[contain-intrinsic-size:auto_100px]';
  return <ol className={`mt-4 space-y-4 ${full ? '' : lazy}`}>{children}</ol>;
}

/**
 * Jumping to a question from the number bar. Every card is laid out first, so the scroll lands exactly on it (cards
 * not yet laid out only have an estimated height); `showAll` brings back a question hidden by "only missed".
 */
export function useJump(showAll: () => void) {
  const [full, setFull] = useState(false);
  const jump = (pos: number) => {
    flushSync(() => {
      setFull(true);
      if (!document.getElementById(`q${pos}`)) showAll();
    });
    document.getElementById(`q${pos}`)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };
  return {full, jump};
}
