// Per-browser state: the viewer's channel name, reactions, history, and delete tokens.

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`batnab.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(`batnab.${key}`, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode / quota) — the feature just won't persist.
  }
}

export type Reaction = 'like' | 'dislike' | null;

export const storage = {
  getChannel: () => read<string>('channel', ''),
  setChannel: (name: string) => write('channel', name),

  getReaction: (id: string) => read<Record<string, Reaction>>('reactions', {})[id] ?? null,
  setReaction: (id: string, r: Reaction) => {
    const all = read<Record<string, Reaction>>('reactions', {});
    if (r) all[id] = r;
    else delete all[id];
    write('reactions', all);
  },
  likedIds: () =>
    Object.entries(read<Record<string, Reaction>>('reactions', {}))
      .filter(([, r]) => r === 'like')
      .map(([id]) => id),

  getHistory: () => read<string[]>('history', []),
  pushHistory: (id: string) => write('history', [id, ...read<string[]>('history', []).filter((x) => x !== id)].slice(0, 200)),
  clearHistory: () => write('history', []),

  getOwnerToken: (id: string) => read<Record<string, string>>('owned', {})[id],
  setOwnerToken: (id: string, token: string) => write('owned', {...read<Record<string, string>>('owned', {}), [id]: token}),
  removeOwnerToken: (id: string) => {
    const all = read<Record<string, string>>('owned', {});
    delete all[id];
    write('owned', all);
  },
};
