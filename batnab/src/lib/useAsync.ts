import {useEffect, useState} from 'react';

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{data?: T; error?: string; loading: boolean}>({loading: true});
  useEffect(() => {
    let alive = true;
    setState({loading: true});
    load().then(
      (data) => alive && setState({data, loading: false}),
      (e: Error) => alive && setState({error: e.message, loading: false}),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
