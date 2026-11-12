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
  /** Whether each attempt shows a question's choices in an order of its own (on unless turned off). */
  shuffleChoices: boolean;
  /** Whether students may ask their class a poll of their own (lib/classPolls). */
  studentPolls: boolean;
  /** The class leader's powers (lib/lead): reminders, notes, reports of a mistake, answering classmates' questions. */
  leadRemind: boolean;
  leadNotes: boolean;
  leadReports: boolean;
  leadHelp: boolean;
}

const DEFAULTS: Settings = {trial: '1A', retakes: true, leaderboard: true, photos: true, shuffleChoices: true, studentPolls: true, leadRemind: true, leadNotes: true, leadReports: true, leadHelp: true};

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
        shuffleChoices: v.shuffleChoices !== false,
        studentPolls: v.studentPolls !== false,
        leadRemind: v.leadRemind !== false,
        leadNotes: v.leadNotes !== false,
        leadReports: v.leadReports !== false,
        leadHelp: v.leadHelp !== false,
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

/** The settings once they are in (the defaults if they haven't come within `ms`, say offline). */
export function settingsReady(ms = 4000): Promise<Settings> {
  start();
  if (current) return Promise.resolve(current);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      listeners.delete(done);
      resolve(current ?? DEFAULTS);
    };
    const timer = setTimeout(done, ms);
    listeners.add(done);
  });
}

export const saveSetting = <K extends keyof Settings>(name: K, value: Settings[K]) => set(ref(db, `settings/${name}`), value);
