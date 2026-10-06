// Per-browser state that doesn't need an account: watch history.

const KEY = 'batnab.history';

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode / quota) — history just won't persist.
  }
}

export const history = {
  get: read,
  push: (id: string) => write([id, ...read().filter((x) => x !== id)].slice(0, 200)),
  clear: () => write([]),
};
