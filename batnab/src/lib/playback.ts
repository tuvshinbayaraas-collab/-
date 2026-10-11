// Per-viewer playback preferences and cross-component player commands.

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`batnab.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(`batnab.${key}`);
    else localStorage.setItem(`batnab.${key}`, JSON.stringify(value));
  } catch {
    // storage unavailable — preference just won't stick
  }
}

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const prefs = {
  speed: () => read<number>('speed', 1),
  setSpeed: (s: number) => write('speed', s),
  autoplay: () => read<boolean>('autoplay', true),
  setAutoplay: (on: boolean) => write('autoplay', on),
};

/** Where the viewer stopped, so the video can pick up from there next time. */
export const resume = {
  get: (id: string) => read<number>(`pos.${id}`, 0),
  save: (id: string, t: number, duration: number) => {
    // Not worth remembering the first few seconds or the very end.
    if (t < 10 || (duration && t > duration - 10)) write(`pos.${id}`, null);
    else write(`pos.${id}`, Math.floor(t));
  },
  clear: (id: string) => write(`pos.${id}`, null),
};

const SEEK_EVENT = 'batnab:seek';

/** Ask the player on the page to jump to a time (used by timestamps in comments and descriptions). */
export function seekTo(seconds: number) {
  window.dispatchEvent(new CustomEvent<number>(SEEK_EVENT, {detail: seconds}));
}

export function onSeek(fn: (seconds: number) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<number>).detail);
  window.addEventListener(SEEK_EVENT, handler);
  return () => window.removeEventListener(SEEK_EVENT, handler);
}

/** "1:23" / "1:02:03" -> seconds. */
export function parseClock(text: string): number {
  return text.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

export function formatClock(total: number): string {
  const t = Math.max(0, Math.floor(total || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Matches 0:45, 12:03, 1:02:03 (not inside longer numbers). */
export const CLOCK_RE = /(?<![\d:])((?:\d{1,2}:)?\d{1,2}:[0-5]\d)(?![\d:])/g;
