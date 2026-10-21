import {useEffect, useState} from 'react';
import {loadTest} from '../../tests';
import type {Test} from '../../tests/types';

/** The questions of a test, once loaded. */
export function useTest(id: string) {
  const [test, setTest] = useState<Test | null>(null);
  useEffect(() => {
    let alive = true;
    loadTest(id)?.then((t) => alive && setTest(t));
    return () => {
      alive = false;
    };
  }, [id]);
  return test?.id === id ? test : null;
}
