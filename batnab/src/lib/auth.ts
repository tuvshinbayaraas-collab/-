import {GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User} from 'firebase/auth';
import {useEffect, useState} from 'react';
import {auth} from './firebase';

export function useUser() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );
  return {user, ready};
}

export async function signIn() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    const code = (e as {code?: string}).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    alert(`Нэвтэрч чадсангүй: ${(e as Error).message}`);
  }
}

export const logOut = () => signOut(auth);

export const displayName = (u: User) => (u.displayName || u.email?.split('@')[0] || 'Хэрэглэгч').slice(0, 50);
