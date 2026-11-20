// Counts how often a student leaves the test page and for how long: another tab or app, another window over it, the
// page closed or reloaded, another page of the site. Being away is also kept in the browser's storage (`store`), so a
// page closed or reloaded while away still counts the time away when it comes back.
import {useEffect, useRef} from 'react';

/** Why the page was left: another tab or app, another window, the page closed or reloaded, another page of the site. */
export type LeaveWhy = 't' | 'w' | 'c' | 'n';
export const WHY_LABEL: Record<LeaveWhy, string> = {
  t: 'өөр таб эсвэл апп',
  w: 'өөр цонх',
  c: 'хуудсыг хаасан эсвэл дахин ачаалсан',
  n: 'сайтын өөр хуудас',
};

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

interface Out {
  at: number;
  why: LeaveWhy;
}
const readOut = (store: string): Out | null => {
  try {
    const v = JSON.parse(localStorage.getItem(store) ?? 'null') as Out | null;
    return v && typeof v.at === 'number' ? v : null;
  } catch {
    return null;
  }
};
const writeOut = (store: string, v: Out | null) => {
  try {
    if (v) localStorage.setItem(store, JSON.stringify(v));
    else localStorage.removeItem(store);
  } catch {
    // private window: only this page's memory counts
  }
};

/**
 * While `active`: `onLeave(why)` when the page is hidden (tab or app switched), loses focus for more than 2 s (another
 * window), is closed or reloaded, or is left for another page of the site (this component goes while still active);
 * `onWhy(why)` when it turns out it was closing after all; `onBack(ms)` with the time away on returning, also after a
 * reload or on coming back to the page later.
 */
export function useLeaveCounter(active: boolean, onLeave: (why: LeaveWhy) => void, onBack: (ms: number) => void, opts: {store?: string; onWhy?: (why: LeaveWhy) => void} = {}) {
  const handlers = useRef({onLeave, onBack, onWhy: opts.onWhy});
  handlers.current = {onLeave, onBack, onWhy: opts.onWhy};
  const store = opts.store;
  const since = useRef<Out | null>(null);
  const live = useRef(active);
  live.current = active;

  const leave = (why: LeaveWhy) => {
    if (since.current) return;
    since.current = {at: Date.now(), why};
    if (store) writeOut(store, since.current);
    handlers.current.onLeave(why);
  };
  const leaveRef = useRef(leave);
  leaveRef.current = leave;

  useEffect(() => {
    if (!active) return;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const back = () => {
      clearTimeout(blurTimer);
      const out = since.current;
      if (!out || document.visibilityState === 'hidden') return;
      since.current = null;
      if (store) writeOut(store, null);
      handlers.current.onBack(Math.max(0, Date.now() - out.at));
    };
    // Left before this page was (re)opened: closed, reloaded, or another page of the site. It's back now.
    const before = store ? readOut(store) : null;
    if (before && !since.current) {
      since.current = before;
      back();
    }
    const visibility = () => (document.visibilityState === 'hidden' ? leaveRef.current('t') : back());
    const blur = () => {
      if (asking) return;
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => !document.hasFocus() && document.visibilityState === 'visible' && leaveRef.current('w'), 2000);
    };
    // Closing or reloading (the page is hidden just before or after this): the leave counted is a closing one. Kept
    // for coming back (another site opened in this tab), it stays one to another tab or app.
    const hide = (e: PageTransitionEvent) => {
      const why = e.persisted ? 't' : 'c';
      const out = since.current;
      if (!out) return leaveRef.current(why);
      if (out.why !== why && Date.now() - out.at < 1500) {
        since.current = {...out, why};
        if (store) writeOut(store, since.current);
        handlers.current.onWhy?.(why);
      }
    };
    // Back from the browser's back/forward cache.
    const show = (e: PageTransitionEvent) => e.persisted && back();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', back);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', back);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, [active, store]);

  // Gone while still active, to another page of the site: away until this page is opened again. Gone without the
  // address changing (signed out, the exam moved by the teacher, an error shown) is not leaving.
  useEffect(() => {
    const here = location.pathname + location.search;
    return () => {
      if (live.current && location.pathname + location.search !== here) leaveRef.current('n');
    };
  }, []);
}
