// Whether the database is reachable right now (`.info/connected`), shared by everyone who asks. The device can be
// online while the database isn't (a network that blocks it, the server unreachable), and pages then wait on it.
import {onValue, ref} from 'firebase/database';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {db} from './firebase';

let connected = false;
const listeners = new Set<() => void>();
onValue(ref(db, '.info/connected'), (s) => {
  connected = s.val() === true;
  listeners.forEach((l) => l());
});

export const useDbConnected = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => connected,
  );

/** True once the database has been out of reach for `ms` (a short drop isn't worth a message). */
export function useDbLost(ms = 6000) {
  const up = useDbConnected();
  const [lost, setLost] = useState(false);
  useEffect(() => {
    setLost(false);
    if (up) return;
    const t = setTimeout(() => setLost(true), ms);
    return () => clearTimeout(t);
  }, [up, ms]);
  return lost;
}
