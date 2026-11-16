// What a student sends that mustn't be lost when the connection drops and the app is closed before it comes back: an
// answer in a topic (and in a topic done again), the photo of the working, a day's practice. The database keeps a
// write made without a connection only while the page stays open; so each is kept on the phone too (localStorage),
// from the moment it is sent until the database has it, and whatever is still there is sent again the next time the
// site is open and connected (components/WorkSync).
// Sending again is safe: an answer may be written once only (the rules refuse a second one to the same problem), so a
// refusal means it is there already, or may no longer be sent (the topic closed), and it is dropped either way; a
// day's practice is skipped when the database already has that day or a later one.
import {get, ref, update} from 'firebase/database';
import {useSyncExternalStore} from 'react';
import {db} from './firebase';

interface Item {
  id: string;
  uid: string;
  /** A multi-path update from the database's root; times as the server's ({'.sv': 'timestamp'}). */
  ops: Record<string, unknown>;
  at: number;
  /** This send's own mark: a newer send of the same thing in its place isn't taken off when the older one is saved. */
  n?: number;
  /** Not sent again when the string at `path` is already `atLeast` or later (a day's practice). */
  skipIf?: {path: string; atLeast: string};
}

const KEY = 'batnab.outbox';
/** Older than this, it isn't sent any more (the topic has long moved on). */
const STALE = 30 * 86_400_000;
const MAX = 100;

const listeners = new Set<() => void>();
let version = 0;
const changed = () => {
  version++;
  listeners.forEach((l) => l());
};

function load(): Item[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && typeof x.uid === 'string' && x.ops && typeof x.ops === 'object') : [];
  } catch {
    return [];
  }
}

function save(items: Item[]) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX)));
    else localStorage.removeItem(KEY);
  } catch {
    // No room (a big photo) or no storage: it is still sent while the page stays open.
  }
  changed();
}

const drop = (id: string, n?: number) => save(load().filter((x) => x.id !== id || (n !== undefined && x.n !== n)));
/** Being sent from this page right now: not sent a second time alongside. */
const inFlight = new Map<string, number>();

/**
 * Writes `ops` (paths from the root), kept on the phone until the database has it. Resolves when it is saved, rejects
 * when the database refuses it (then it isn't kept either).
 */
export async function sendKept(uid: string, what: string, ops: Record<string, unknown>, skipIf?: Item['skipIf']) {
  // One per student and thing (a phone may be shared): the newest in place of an older one.
  const id = `${uid}:${what}`;
  const n = Math.random();
  save([...load().filter((x) => x.id !== id), {id, uid, ops, at: Date.now(), n, ...(skipIf ? {skipIf} : {})}]);
  inFlight.set(id, (inFlight.get(id) ?? 0) + 1);
  try {
    await update(ref(db), ops);
  } finally {
    const left = (inFlight.get(id) ?? 1) - 1;
    if (left) inFlight.set(id, left);
    else inFlight.delete(id);
    drop(id, n);
  }
}

let flushing = false;
/** Sends again what the signed-in student left unsent (on this phone), oldest first. */
export async function flushKept(uid: string) {
  if (flushing) return;
  flushing = true;
  try {
    for (const it of load().filter((x) => x.uid === uid && !inFlight.has(x.id))) {
      try {
        if (Date.now() - it.at > STALE) continue;
        if (it.skipIf) {
          const v = (await get(ref(db, it.skipIf.path))).val();
          if (typeof v === 'string' && v >= it.skipIf.atLeast) continue;
        }
        await update(ref(db), it.ops);
      } catch {
        // Refused: there already, or no longer allowed.
      } finally {
        drop(it.id, it.n);
      }
    }
  } finally {
    flushing = false;
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  // Another tab sending (or done sending) changes it too.
  const other = (e: StorageEvent) => e.key === KEY && changed();
  window.addEventListener('storage', other);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', other);
  };
};
let seen = '';
let count = 0;
/** How many of the student's are waiting to be sent. */
export function useKept(uid: string | undefined) {
  return useSyncExternalStore(subscribe, () => {
    const now = `${version}|${uid}`;
    if (seen !== now) {
      seen = now;
      count = uid ? load().filter((x) => x.uid === uid).length : 0;
    }
    return count;
  });
}
