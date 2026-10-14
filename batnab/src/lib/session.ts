// Who is signed in: the Firebase user, their profile (users/{uid}, written by the teacher) and whether
// they are the teacher (admins/{uid}). Accounts are username + password; the teacher creates them.
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import {onValue, ref} from 'firebase/database';
import {useSyncExternalStore} from 'react';
import {auth, db} from './firebase';

export interface Profile {
  /** Login name, lower case. */
  username: string;
  /** Real name, set by the teacher. */
  name: string;
  /** Set by the student. */
  nickname?: string;
  /** Small JPEG data URL, set by the student. */
  photo?: string;
  createdAt?: number;
  disabled?: boolean;
}

export interface Session {
  /** False until the sign-in state and the profile are known. */
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  admin: boolean;
}

let state: Session = {ready: false, user: null, profile: null, admin: false};
const listeners = new Set<() => void>();
const emit = (s: Session) => {
  state = s;
  listeners.forEach((l) => l());
};

let stop: (() => void)[] = [];
onAuthStateChanged(auth, (user) => {
  stop.forEach((f) => f());
  stop = [];
  if (!user) return emit({ready: true, user: null, profile: null, admin: false});
  emit({ready: false, user, profile: null, admin: false});
  let profile: Profile | null | undefined;
  let admin: boolean | undefined;
  const update = () => profile !== undefined && admin !== undefined && emit({ready: true, user, profile, admin});
  stop.push(
    onValue(
      ref(db, `users/${user.uid}`),
      (s) => ((profile = s.val()), update()),
      () => ((profile = null), update()),
    ),
    onValue(
      ref(db, `admins/${user.uid}`),
      (s) => ((admin = s.val() === true), update()),
      () => ((admin = false), update()),
    ),
  );
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useSession = () => useSyncExternalStore(subscribe, () => state);

/** A student who may take tests and save results. */
export const isStudent = (s: Session) => !!s.user && !!s.profile && !s.profile.disabled;

// Firebase Auth needs an e-mail address; usernames map to addresses on the site's own domain (nothing is ever sent there).
export const emailFor = (username: string) => `${username.trim().toLowerCase()}@batnab.web.app`;
export const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;

export function authError(e: unknown) {
  const code = (e as {code?: string}).code ?? '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/invalid-login-credentials'].includes(code))
    return 'Нэвтрэх нэр эсвэл нууц үг буруу байна.';
  if (code === 'auth/too-many-requests') return 'Хэт олон удаа оролдлоо. Хэсэг хүлээгээд дахин оролдоно уу.';
  if (code === 'auth/network-request-failed') return 'Интернэт холболтоо шалгана уу.';
  if (code === 'auth/weak-password') return 'Нууц үг хамгийн багадаа 6 тэмдэгт байна.';
  if (code === 'auth/email-already-in-use') return 'Энэ нэвтрэх нэр бүртгэлтэй байна.';
  if (code === 'auth/operation-not-allowed')
    return 'Нэвтрэх нэр, нууц үгээр нэвтрэх тохиргоо идэвхгүй байна (Firebase Console → Authentication → Sign-in method → Email/Password).';
  return (e as Error).message || String(e);
}

export async function logIn(username: string, password: string) {
  await signInWithEmailAndPassword(auth, emailFor(username), password);
}

export const logOut = () => signOut(auth);

export async function changePassword(current: string, next: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Нэвтэрнэ үү');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  await updatePassword(user, next);
}

/** What the student calls themselves, falling back to the real name. */
export const shownName = (p: Profile | null | undefined) => (p?.nickname?.trim() || p?.name || p?.username || 'Хэрэглэгч').slice(0, 60);
