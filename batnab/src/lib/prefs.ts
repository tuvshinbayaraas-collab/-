// A user's own settings (the menu's "Тохиргоо"), kept in users/{uid}/prefs so they follow the account to every
// device. Every one is off by default and stored only while on.
import {ref, set} from 'firebase/database';
import {auth, db} from './firebase';
import {useSession} from './session';

export type PrefKey = 'lbOff' | 'lbHideRank' | 'hideTimer' | 'autoNext' | 'bigText' | 'fullCards';

/**
 * lbOff: keep my scores off the leaderboard. lbHideRank: don't show my place after a test. hideTimer: no running
 * clock while practising. autoNext: go on to the next question after answering. bigText: larger text. fullCards: the
 * home page's daily practice, notebook and questions as cards with their names (off: just the icons).
 */
export type Prefs = Record<PrefKey, boolean>;

export function usePrefs(): Prefs {
  const p = useSession().profile?.prefs ?? {};
  return {lbOff: !!p.lbOff, lbHideRank: !!p.lbHideRank, hideTimer: !!p.hideTimer, autoNext: !!p.autoNext, bigText: !!p.bigText, fullCards: !!p.fullCards};
}

export const savePref = (key: PrefKey, on: boolean) => set(ref(db, `users/${auth.currentUser!.uid}/prefs/${key}`), on || null);
