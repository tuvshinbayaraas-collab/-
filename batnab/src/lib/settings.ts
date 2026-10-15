// Site settings the teacher controls (settings/…, readable by everyone).
import {onValue, ref, set} from 'firebase/database';
import {useSyncExternalStore} from 'react';
import {db} from './firebase';

export interface Settings {
  /** The test guests may try without an account; '' for none. */
  trial: string;
  /** Whether students may take a test again. */
  retakes: boolean;
  /** Whether the weekly leaderboard (and its medals) is on. */
  leaderboard: boolean;
  /** Whether students may put up their own photo (off: only ready-made pictures, photos already up are hidden). */
  photos: boolean;
}

const DEFAULTS: Settings = {trial: '1A', retakes: true, leaderboard: true, photos: true};

let current: Settings | null = null;
const listeners = new Set<() => void>();
let started = false;

function start() {
  if (started) return;
  started = true;
  onValue(
    ref(db, 'settings'),
    (s) => {
      const v = (s.val() ?? {}) as Partial<Settings>;
      current = {
        trial: typeof v.trial === 'string' ? v.trial : DEFAULTS.trial,
        retakes: v.retakes !== false,
        leaderboard: v.leaderboard !== false,
        photos: v.photos !== false,
      };
      listeners.forEach((l) => l());
    },
    () => {
      current = DEFAULTS;
      listeners.forEach((l) => l());
    },
  );
}

const subscribe = (l: () => void) => {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether a photo (not a ready-made picture) may be shown to classmates right now. */
export const photosAllowed = () => current?.photos !== false;

/** Null while loading. */
export const useSettings = () => useSyncExternalStore(subscribe, () => current);

export const saveSetting = <K extends keyof Settings>(name: K, value: Settings[K]) => set(ref(db, `settings/${name}`), value);
