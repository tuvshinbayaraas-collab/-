// The welcome guide: shown when someone opens the site, once per visit, until they tick "Дахин харахгүй".
// Students, the teacher and guests each get their own guide, so each has its own "don't show again".
import {useSyncExternalStore} from 'react';

export type GuideRole = 'guest' | 'student' | 'teacher';

const hiddenKey = (role: GuideRole) => `batnab.guide.hidden.${role}`;
const seenKey = (role: GuideRole) => `batnab.guide.seen.${role}`;

const get = (store: () => Storage, key: string) => {
  try {
    return store().getItem(key) === '1';
  } catch {
    return false;
  }
};
const put = (store: () => Storage, key: string, on: boolean) => {
  try {
    if (on) store().setItem(key, '1');
    else store().removeItem(key);
  } catch {
    // private mode or blocked storage: the guide just shows again next time
  }
};

/** Ticked "Дахин харахгүй" on this device. */
export const guideHidden = (role: GuideRole) => get(() => localStorage, hiddenKey(role));
/** Already shown (and closed) during this visit. */
export const guideSeen = (role: GuideRole) => get(() => sessionStorage, seenKey(role));

export function closeGuide(role: GuideRole, hideForGood: boolean) {
  put(() => localStorage, hiddenKey(role), hideForGood);
  put(() => sessionStorage, seenKey(role), true);
  setOpen(false);
}

let open = false;
const listeners = new Set<() => void>();
const setOpen = (v: boolean) => {
  open = v;
  listeners.forEach((l) => l());
};

export const openGuide = () => setOpen(true);

export const useGuideOpen = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
