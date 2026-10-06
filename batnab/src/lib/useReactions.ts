import {useEffect, useState} from 'react';
import {api, errorMessage} from './api';
import {signIn, useUser} from './auth';
import type {Reaction} from './types';

export function useReactions(videoId: string) {
  const {user} = useUser();
  const [state, setState] = useState<{likes: number; dislikes: number; mine: Reaction}>({likes: 0, dislikes: 0, mine: null});

  useEffect(() => {
    let alive = true;
    api.reactions(videoId).then((s) => alive && setState(s), () => {});
    return () => {
      alive = false;
    };
  }, [videoId, user?.uid]);

  const toggle = async (next: 'like' | 'dislike') => {
    if (!user) return signIn();
    const prev = state;
    const target: Reaction = prev.mine === next ? null : next;
    setState({
      likes: prev.likes + (target === 'like' ? 1 : 0) - (prev.mine === 'like' ? 1 : 0),
      dislikes: prev.dislikes + (target === 'dislike' ? 1 : 0) - (prev.mine === 'dislike' ? 1 : 0),
      mine: target,
    });
    try {
      await api.react(videoId, target);
    } catch (e) {
      setState(prev);
      alert(errorMessage(e));
    }
  };

  return {...state, toggle};
}
