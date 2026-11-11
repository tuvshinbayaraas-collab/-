// Classes ("11_6 анги"): classes/{id} = {name, createdAt}; a student's class is users/{uid}/class. The teacher picks a
// class at the top of the dashboard and every tab shows only that class (or all of them).
import {push, ref, serverTimestamp, set, update} from 'firebase/database';
import {useSyncExternalStore} from 'react';
import {db} from './firebase';
import {sharedLive} from './live';

export interface ClassInfo {
  id: string;
  name: string;
  createdAt: number;
}

const classes = sharedLive(
  'classes',
  (v) =>
    Object.entries((v ?? {}) as Record<string, Partial<ClassInfo>>)
      .filter(([, c]) => typeof c?.name === 'string')
      .map(([id, c]) => ({id, name: c.name!, createdAt: typeof c.createdAt === 'number' ? c.createdAt : 0}))
      .sort((a, b) => a.name.localeCompare(b.name, 'mn', {numeric: true})),
  [] as ClassInfo[],
);

/** All classes, by name; null while loading. */
export const useClasses = classes.use;

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 30);

/** Makes a class; `members` (student uids) move into it in the same write. */
export async function createClass(name: string, members: string[]) {
  const n = cleanName(name);
  if (!n) throw new Error('Ангийн нэрээ оруулна уу.');
  const id = push(ref(db, 'classes')).key!;
  await update(ref(db), {[`classes/${id}`]: {name: n, createdAt: serverTimestamp()}, ...Object.fromEntries(members.map((uid) => [`users/${uid}/class`, id]))});
  return id;
}

export const renameClass = (id: string, name: string) => set(ref(db, `classes/${id}/name`), cleanName(name));

/** Removes a class; its students stay (without a class), with all their results. Its class polls go with it. */
export const deleteClass = (id: string, members: string[]) =>
  update(ref(db), {
    [`classes/${id}`]: null,
    [`classPolls/${id}`]: null,
    [`classPollVotes/${id}`]: null,
    ...Object.fromEntries(members.map((uid) => [`users/${uid}/class`, null])),
  });

export const moveToClass = (uid: string, id: string | null) => set(ref(db, `users/${uid}/class`), id);

// The class the teacher has picked on this device ('' = all classes).
const KEY = 'batnab.admin.class';
let picked = (() => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
})();
const pickListeners = new Set<() => void>();

export function pickClass(id: string) {
  picked = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: the choice lasts until the page is reloaded
  }
  pickListeners.forEach((l) => l());
}

/** The picked class, or '' for all (also when the picked one no longer exists). */
export function usePickedClass() {
  const classes = useClasses();
  const id = useSyncExternalStore(
    (l) => {
      pickListeners.add(l);
      return () => pickListeners.delete(l);
    },
    () => picked,
  );
  return classes?.some((c) => c.id === id) ? id : '';
}
