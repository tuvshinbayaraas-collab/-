// Counts how often a student leaves the test page (another tab, another app, another window) and for how long.
import {useEffect, useRef} from 'react';

let asking = 0;

/** confirm() without its dialog counting as leaving the page. */
export function ask(message: string) {
  asking++;
  try {
    return confirm(message);
  } finally {
    setTimeout(() => asking--, 500);
  }
}

/**
 * While `active`, calls `onLeave` when the page is hidden (tab or app switched) or loses focus for more than 3 s
 * (another window), and `onBack(ms)` with the time away when the student returns.
 */
export function useLeaveCounter(active: boolean, onLeave: () => void, onBack: (ms: number) => void) {
  const handlers = useRef({onLeave, onBack});
  handlers.current = {onLeave, onBack};

  useEffect(() => {
    if (!active) return;
    let since: number | null = null;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const leave = () => {
      if (since !== null) return;
      since = Date.now();
      handlers.current.onLeave();
    };
    const back = () => {
      clearTimeout(blurTimer);
      if (since === null) return;
      const ms = Date.now() - since;
      since = null;
      handlers.current.onBack(ms);
    };
    const visibility = () => (document.visibilityState === 'hidden' ? leave() : back());
    const blur = () => {
      if (asking) return;
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => !document.hasFocus() && leave(), 3000);
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', back);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', back);
    };
  }, [active]);
}
