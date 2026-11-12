// Classes ("11_6 анги"): classes/{id} = {name, createdAt}; a student's class is users/{uid}/class. The teacher picks a
// class at the top of the dashboard and every tab shows only that class (or all of them).
import {get, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {useSyncExternalStore} from 'react';
import {db} from './firebase';
import {outOfClass} from './lead';
import {sharedLive} from './live';

export interface ClassInfo {
  id: string;
  name: string;
  createdAt: number;
  /** How many students it has (kept by the teacher's page, for the class leader's counts). */
  n?: number;
}

const classes = sharedLive(
  'classes',
  (v) =>
    Object.entries((v ?? {}) as Record<string, Partial<ClassInfo>>)
      .filter(([, c]) => typeof c?.name === 'string')
      .map(([id, c]) => ({id, name: c.name!, createdAt: typeof c.createdAt === 'number' ? c.createdAt : 0, ...(typeof c.n === 'number' ? {n: c.n} : {})}))
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

/**
 * Removes a class; its students stay (without a class), with all their results. Its class polls go with it, and the
 * class leaders' things for it (notes, reminders, questions shown to them, who has started what, its list).
 */
export async function deleteClass(id: string, members: string[]) {
  return update(ref(db), {
    [`classes/${id}`]: null,
    [`classPolls/${id}`]: null,
    [`classPollVotes/${id}`]: null,
    [`classNotes/${id}`]: null,
    [`classReminders/${id}`]: null,
    [`classNudges/${id}`]: null,
    [`classWork/${id}`]: null,
    [`classRoster/${id}`]: null,
    [`helpQueue/${id}`]: null,
    ...Object.fromEntries(members.map((uid) => [`users/${uid}/class`, null])),
  });
}

/** Moves a student to another class (or none): out of the old class's lists for its class leaders (lib/lead) too. */
export async function moveToClass(uid: string, id: string | null) {
  const now = (await get(ref(db, `users/${uid}/class`))).val() ?? null;
  if (now === id) return;
  return update(ref(db), {...(await outOfClass(uid, now)), [`users/${uid}/class`]: id});
}

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
