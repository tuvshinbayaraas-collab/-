// (lib/update.ts reloads when a part of an old version fails to load; this notices the new version before that.)
// A new version of the site out while a page stays open (a phone's home-screen app can run for days without a
// reload): the page's own code is old, so what was changed (who may do what) isn't there until it loads again. Every
// so often the page asks the server which entry script it serves now; a different one means a new version: a line
// offers to load it, and a page that was away for a while (not in the middle of a test or an edit) loads it itself.
import {useSyncExternalStore} from 'react';

/** The entry script a page was built with (/assets/index-<hash>.js). */
const ENTRY = /<script\b[^>]*\btype="module"[^>]*\bsrc="(\/assets\/[^"]+\.js)"/;

export const scriptOf = (html: string) => ENTRY.exec(html)?.[1] ?? null;

const own = () => {
  for (const s of document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')) {
    const path = new URL(s.src, location.href).pathname;
    if (path.startsWith('/assets/')) return path;
  }
  return null;
};

let stale = false;
const listeners = new Set<() => void>();
const set = (on: boolean) => {
  stale = on;
  listeners.forEach((l) => l());
};

/** Whether a newer version is out than this page runs. */
export const useStale = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => stale,
  );

/** Pages a reload can't cost much on (answers are saved as they are given; no test, exam, live quiz or editor). */
const SAFE = /^\/(|results|leaderboard|topics|questions|lead|profile|settings|credits|admin)$/;

async function check() {
  const mine = own();
  if (!mine) return;
  try {
    const html = await (await fetch('/', {cache: 'no-store'})).text();
    const theirs = scriptOf(html);
    if (theirs && theirs !== mine) set(true);
  } catch {
    // offline: try again later
  }
}

if (import.meta.env.PROD) {
  let hiddenAt = 0;
  let last = 0;
  const soon = (force = false) => {
    if (!force && Date.now() - last < 2 * 60_000) return Promise.resolve();
    last = Date.now();
    return check();
  };
  setTimeout(() => void soon(), 20_000);
  setInterval(() => void soon(), 15 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    // Back after a while: look now, and on a page where nothing is in progress, load a new version straight away.
    const away = !!hiddenAt && Date.now() - hiddenAt > 10 * 60_000;
    void soon(away).then(() => {
      if (stale && away && safeToReload()) location.reload();
    });
  });
} else {
  // For trying the line out while developing: __batnabNewVersion() in the console.
  (window as unknown as {__batnabNewVersion?: () => void}).__batnabNewVersion = () => set(true);
}

/** Something typed and not yet sent (a question, a note, a poll's text): a reload would lose it. */
const typing = () =>
  [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('textarea, input:not([type]), input[type="text"], input[type="number"]')].some(
    (e) => !e.readOnly && !e.disabled && e.value.trim() !== '',
  );

/** A page where nothing is in progress that a reload would cost (no test, exam, live quiz or editor). */
export const safePage = (path: string) => SAFE.test(path);

const safeToReload = () => safePage(location.pathname) && !typing();
