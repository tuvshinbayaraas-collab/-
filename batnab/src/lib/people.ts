// The students' directory, for finding a classmate by name and opening their profile:
//   people/{uid} = {name, cls?, frame?, about?, badges?}   every signed-in student reads it. name is the public one
//                                              (nickname, or @login name); the teacher's page keeps name, class, frame
//                                              and «Миний тухай» for everyone, the student's own page too (and the
//                                              badges they earned, from their profile page). Not there while they
//                                              hide their profile (users/{uid}/prefs/profileHidden).
//   users/{uid}/about                          «Миний тухай»: a few words of their own (the teacher may take it down)
// Real names: only to classmates, from classRoster/{class} (lib/lead).
import {ref, set, update} from 'firebase/database';
import {auth, db} from './firebase';
import {useLive} from './live';
import {publicName} from './leaderboard';
import type {Profile} from './session';

export const ABOUT_MAX = 150;

export interface Person {
  uid: string;
  name: string;
  cls?: string;
  frame?: string;
  about?: string;
  badges: string[];
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const parse = (uid: string, v: unknown): Person | null => {
  const x = v as Record<string, unknown> | null;
  const name = str(x?.name);
  return x && name ? {uid, name, cls: str(x.cls), frame: str(x.frame), about: str(x.about), badges: (str(x.badges) ?? '').split(',').filter(Boolean)} : null;
};

/** Everyone in the directory (null while loading). */
export const usePeople = (on = true) =>
  useLive(on ? 'people' : null, (v) => Object.entries((v ?? {}) as Record<string, unknown>).flatMap(([uid, x]) => parse(uid, x) ?? []));

/** One student's entry (null while loading, undefined when there is none). */
export const usePerson = (uid: string | undefined) => useLive(uid ? `people/${uid}` : null, (v) => parse(uid!, v) ?? undefined);

/** What the directory says of a student, from their profile (the badges are their own page's to add). */
export const entryOf = (p: Profile) => ({name: publicName(p), cls: p.class ?? null, frame: p.frame ?? null, about: p.about?.trim() || null});

/** The signed-in student's own entry, brought up to date (with their badges, when given); taken out while hidden. */
export function syncMine(p: Profile, badges?: string[]) {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.resolve();
  if (p.prefs?.profileHidden) return set(ref(db, `people/${uid}`), null);
  return update(ref(db, `people/${uid}`), {...entryOf(p), ...(badges ? {badges: badges.join(',')} : {})});
}

/** «Миний тухай»: saved on the profile, then into the directory. */
export async function saveAbout(p: Profile, text: string) {
  const uid = auth.currentUser!.uid;
  const about = text.trim().replace(/\s+/g, ' ').slice(0, ABOUT_MAX);
  await set(ref(db, `users/${uid}/about`), about || null);
  await syncMine({...p, about: about || undefined}).catch(() => {});
}

/** The teacher takes a student's «Миний тухай» down. */
export const removeAbout = (uid: string) => update(ref(db), {[`users/${uid}/about`]: null, [`people/${uid}/about`]: null});
