// The test someone is taking, kept in this browser so a reload keeps the order and the answers.

export interface Attempt {
  /** Question indexes in the order they are shown (shuffled for every attempt). */
  order: number[];
  /** Chosen answer per question (by original index), 0 = А … 4 = Д. */
  answers: (number | null)[];
  started: number;
  finished?: number;
  /** Set once the result is stored for a signed-in user. */
  saved?: boolean;
}

const key = (testId: string) => `batnab.attempt.${testId}`;

function shuffled(count: number) {
  const order = Array.from({length: count}, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export const newAttempt = (count: number): Attempt => ({order: shuffled(count), answers: Array(count).fill(null), started: Date.now()});

export function loadAttempt(testId: string, count: number): Attempt | null {
  try {
    const a = JSON.parse(localStorage.getItem(key(testId)) ?? 'null') as Attempt | null;
    if (!a || a.order?.length !== count || a.answers?.length !== count) return null;
    return a;
  } catch {
    return null;
  }
}

export function saveAttempt(testId: string, a: Attempt) {
  try {
    localStorage.setItem(key(testId), JSON.stringify(a));
  } catch {
    // storage full or blocked: the attempt still works until the page is closed
  }
}

export function clearAttempt(testId: string) {
  try {
    localStorage.removeItem(key(testId));
  } catch {
    // ignore
  }
}

export const inProgress = (testId: string, count: number) => {
  const a = loadAttempt(testId, count);
  return !!a && !a.finished;
};

export const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};
