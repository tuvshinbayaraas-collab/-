// A database path read live: null while loading (or with no path); on an error, what `parse` makes of nothing.
import {onValue, ref} from 'firebase/database';
import {useEffect, useState} from 'react';
import {db} from './firebase';

export function useLive<T>(path: string | null | undefined, parse: (v: unknown) => T): T | null {
  const [state, setState] = useState<{path: string; value: T} | null>(null);
  useEffect(() => {
    if (!path) return;
    return onValue(
      ref(db, path),
      (s) => setState({path, value: parse(s.val())}),
      () => setState({path, value: parse(null)}),
    );
    // `parse` is a plain function of the value; a new one each render doesn't need a new listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return path && state?.path === path ? state.value : null;
}

/** An object of id → value as a list of {id, ...value}. */
export const entries = <T,>(v: unknown): (T & {id: string})[] =>
  v && typeof v === 'object' ? Object.entries(v as Record<string, T>).flatMap(([id, x]) => (x && typeof x === 'object' ? [{...x, id}] : [])) : [];

/** Whether something meant for `classes` (none = every class) is for a student of `classId`. */
export const forClass = (classes: Record<string, true> | undefined, classId: string | undefined) => !classes || !Object.keys(classes).length || (!!classId && !!classes[classId]);
