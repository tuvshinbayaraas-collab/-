// What is folded away on this device (the home page's polls, the teacher's poll sections and results), by an id of
// its own: kept in localStorage, the newest few, so a new poll opens unfolded and old ids don't pile up.
import {useSyncExternalStore} from 'react';

const KEY = 'batnab.folded';
const KEEP = 80;

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-KEEP) : [];
  } catch {
    return [];
  }
}

let folded = read();
const listeners = new Set<() => void>();

function set(id: string, on: boolean) {
  folded = on ? [...folded.filter((x) => x !== id), id].slice(-KEEP) : folded.filter((x) => x !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(folded));
  } catch {
    // storage blocked: for this visit only
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether `id` is folded, and a toggle. */
export function useFolded(id: string): [boolean, () => void] {
  const on = useSyncExternalStore(subscribe, () => folded.includes(id));
  return [on, () => set(id, !on)];
}
