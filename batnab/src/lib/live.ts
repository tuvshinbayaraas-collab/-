// A database path read live: null while loading (or with no path); on an error, what `parse` makes of nothing.
import {onAuthStateChanged} from 'firebase/auth';
import {onValue, ref} from 'firebase/database';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {auth, db} from './firebase';

// Each time someone else signs in or out on the page (after the first sign-in state), what was read before is read
// again: a read refused while signed out (or as a student) stays refused until it is made again, and the one now signed
// in may read more (or less). The first read needs nothing: the database waits for the sign-in state and reads as them.
let signIns = 0;
let who: string | null | undefined;
const onSignIn = new Set<() => void>();
onAuthStateChanged(auth, (u) => {
  const id = u?.uid ?? null;
  if (who !== undefined && id !== who) {
    signIns++;
    onSignIn.forEach((l) => l());
  }
  who = id;
});
const subscribeSignIn = (l: () => void) => {
  onSignIn.add(l);
  return () => onSignIn.delete(l);
};
/** Changes when someone else signs in or out (see above): a read keyed on it is made again then. */
export const useSignIns = () => useSyncExternalStore(subscribeSignIn, () => signIns);

export function useLive<T>(path: string | null | undefined, parse: (v: unknown) => T): T | null {
  const key = `${useSignIns()}|${path}`;
  const [state, setState] = useState<{key: string; value: T} | null>(null);
  useEffect(() => {
    if (!path) return;
    return onValue(
      ref(db, path),
      (s) => setState({key, value: parse(s.val())}),
      () => setState({key, value: parse(null)}),
    );
    // `parse` is a plain function of the value; a new one each render doesn't need a new listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return path && state?.key === key ? state.value : null;
}

/**
 * A path read live for the whole visit and shared by every component that uses it (null while loading; `refused`
 * when it may not be read). Read again, from loading, when someone else signs in or out.
 */
export function sharedLive<T>(path: string, parse: (v: unknown) => T, refused: T) {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  let stop: (() => void) | null = null;
  const listen = () => {
    stop?.();
    stop = onValue(
      ref(db, path),
      (s) => {
        value = parse(s.val());
        emit();
      },
      () => {
        value = refused;
        emit();
      },
    );
  };
  const subscribe = (l: () => void) => {
    if (!stop) {
      listen();
      onSignIn.add(() => {
        value = null;
        emit();
        listen();
      });
    }
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {subscribe, get: () => value, use: () => useSyncExternalStore(subscribe, () => value)};
}

/** An object of id → value as a list of {id, ...value}. */
export const entries = <T,>(v: unknown): (T & {id: string})[] =>
  v && typeof v === 'object' ? Object.entries(v as Record<string, T>).flatMap(([id, x]) => (x && typeof x === 'object' ? [{...x, id}] : [])) : [];

/** Whether something meant for `classes` (none = every class) is for a student of `classId`. */
export const forClass = (classes: Record<string, true> | undefined, classId: string | undefined) => !classes || !Object.keys(classes).length || (!!classId && !!classes[classId]);
