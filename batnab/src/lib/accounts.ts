// Account changes: the teacher creates, renames, blocks and deletes students; students set their nickname and photo.
import {deleteApp, initializeApp} from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {get, ref, serverTimestamp, set, update} from 'firebase/database';
import {auth, db, emulators, firebaseConfig} from './firebase';
import {emailFor, USERNAME_RE} from './session';

/**
 * Creates a student's sign-in account and profile. The account is created in a second, throwaway Firebase app so
 * the teacher stays signed in.
 */
export async function createStudent(name: string, username: string, password: string) {
  name = name.trim().replace(/\s+/g, ' ');
  username = username.trim().toLowerCase();
  if (!name || name.length > 60) throw new Error('Нэрээ оруулна уу (60 хүртэл тэмдэгт).');
  if (!USERNAME_RE.test(username)) throw new Error('Нэвтрэх нэр 3–30 тэмдэгт: латин жижиг үсэг, тоо, _ . -');
  if (password.length < 6) throw new Error('Нууц үг хамгийн багадаа 6 тэмдэгт байна.');

  const app = initializeApp(firebaseConfig, `creator-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const a = initializeAuth(app, {persistence: inMemoryPersistence});
    if (emulators) connectAuthEmulator(a, 'http://127.0.0.1:9099', {disableWarnings: true});
    let uid: string;
    try {
      uid = (await createUserWithEmailAndPassword(a, emailFor(username), password)).user.uid;
    } catch (e) {
      if ((e as {code?: string}).code !== 'auth/email-already-in-use') throw e;
      // An account whose profile was never written (or was deleted) can be taken back with its password.
      try {
        uid = (await signInWithEmailAndPassword(a, emailFor(username), password)).user.uid;
      } catch {
        throw e;
      }
      if ((await get(ref(db, `users/${uid}/username`))).exists()) throw e;
    }
    await signOut(a);
    await set(ref(db, `users/${uid}`), {username, name, createdAt: serverTimestamp()});
    return uid;
  } finally {
    await deleteApp(app).catch(() => {});
  }
}

export const renameStudent = (uid: string, name: string) => set(ref(db, `users/${uid}/name`), name.trim().replace(/\s+/g, ' ').slice(0, 60));
export const setBlocked = (uid: string, blocked: boolean) => set(ref(db, `users/${uid}/disabled`), blocked || null);
/** Removes the profile and all results. The sign-in account stays but can't do anything without a profile. */
export const deleteStudent = (uid: string) => update(ref(db), {[`users/${uid}`]: null, [`results/${uid}`]: null});
export const deleteResult = (uid: string, test: string, id: string) => set(ref(db, `results/${uid}/${test}/${id}`), null);
/** The teacher takes a student's photo down (from the leaderboard podium too). */
export const removePhoto = (uid: string) => update(ref(db), {[`users/${uid}/photo`]: null, [`pub/${uid}`]: null});

function me() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  return uid;
}
export const saveNickname = (nickname: string) => set(ref(db, `users/${me()}/nickname`), nickname.trim().replace(/\s+/g, ' ').slice(0, 30) || null);
export const savePhoto = (photo: string | null) => set(ref(db, `users/${me()}/photo`), photo);

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', ө: 'u', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ү: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'y', ь: 'i', э: 'e', ю: 'yu', я: 'ya',
};

const digits = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b % 10).join('');

/** A login name from the student's given name (the last word): "Батын Болд" → "bold27". */
export function suggestUsername(name: string) {
  const word = name.trim().split(/\s+/).pop() ?? '';
  const latin = [...word.toLowerCase()].map((ch) => CYRILLIC[ch] ?? ch).join('').replace(/[^a-z0-9]/g, '').slice(0, 12);
  return (latin.length >= 2 ? latin : 'student') + digits(2);
}

/** An easy-to-type password without look-alike characters. */
export function randomPassword(length = 6) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => chars[b % chars.length]).join('');
}
