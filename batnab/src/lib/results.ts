// Finished tests of signed-in users: results/{uid}/{pushId}.
import {get, orderByChild, push, query, ref, serverTimestamp, set} from 'firebase/database';
import {useEffect, useState} from 'react';
import {useUser} from './auth';
import {auth, db} from './firebase';

export interface Result {
  id: string;
  test: string;
  score: number;
  total: number;
  seconds: number;
  /** Chosen letters in the test's own question order, '-' for unanswered. */
  answers: string;
  at: number;
}

export async function saveResult(r: Omit<Result, 'id' | 'at'>) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Эхлээд нэвтэрнэ үү');
  await set(push(ref(db, `results/${uid}`)), {...r, at: serverTimestamp()});
}

/** The signed-in user's results, newest first (null while loading). */
export function useMyResults() {
  const {user, ready} = useUser();
  const [results, setResults] = useState<Result[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setResults([]);
      return;
    }
    let alive = true;
    get(query(ref(db, `results/${user.uid}`), orderByChild('at')))
      .then((snap) => {
        const list: Result[] = [];
        snap.forEach((c) => {
          list.push({...(c.val() as Omit<Result, 'id'>), id: c.key!});
        });
        if (alive) setResults(list.reverse());
      })
      .catch(() => alive && setResults([]));
    return () => {
      alive = false;
    };
  }, [ready, user?.uid]);
  return results;
}
