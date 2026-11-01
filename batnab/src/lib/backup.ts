// The teacher's backup ("Нөөц"): everything in the database the teacher can read, in one JSON file, and chosen
// parts of such a file put back. Putting back works record by record (a topic, a student, one result…): what the
// file has goes back to how it was then; what was added since stays. The sign-in accounts themselves (passwords) are
// not in the database, so they are neither saved nor put back.
import {get, ref, update} from 'firebase/database';
import {db} from './firebase';

/** Every part saved: [the database node, how deep its records are (topics/{tid}: 1, results/{uid}/{test}/{id}: 3)]. */
const NODES: [string, number][] = [
  ['settings', 1],
  ['classes', 1],
  ['users', 1],
  ['keys', 1],
  ['topics', 1],
  ['topicImages', 2],
  ['topicKeys', 2],
  ['topicProgress', 3],
  ['topicMarks', 3],
  ['topicWork', 3],
  ['results', 3],
  ['history', 3],
  ['medals', 2],
  ['exams', 1],
  ['examAnswers', 2],
  ['examEvents', 2],
  ['assignments', 1],
  ['announcements', 1],
  ['questions', 2],
  // The students' own (only they may write these): saved, not put back.
  ['mistakes', 0],
  ['mistakeTests', 0],
  ['stats', 0],
  ['leaderboard', 0],
  ['pub', 0],
];

/** What can be put back, in the parts the teacher picks from. */
export const PARTS = [
  {id: 'topics', label: 'Сэдвүүд', sub: 'хичээл, бодлого, зураг, зөв хариулт', nodes: ['topics', 'topicImages', 'topicKeys']},
  {id: 'classes', label: 'Ангиуд', sub: '', nodes: ['classes']},
  {id: 'users', label: 'Сурагчдын бүртгэл', sub: 'нэр, анги (нэвтрэх нууц үг биш)', nodes: ['users']},
  {id: 'work', label: 'Сурагчдын хариулт, дүн', sub: 'тест, сэдэв, багшийн шалгалт, түүх, медаль', nodes: ['results', 'history', 'topicProgress', 'topicMarks', 'topicWork', 'medals']},
  {id: 'tasks', label: 'Даалгавар, мэдээ, асуулт', sub: '', nodes: ['assignments', 'announcements', 'questions']},
  {id: 'keys', label: 'Тестүүдийн түлхүүр', sub: '', nodes: ['keys']},
  {id: 'exams', label: 'Шалгалтууд', sub: 'товлол, хариулт', nodes: ['exams', 'examAnswers', 'examEvents']},
  {id: 'settings', label: 'Тохиргоо', sub: '', nodes: ['settings']},
] as const;
export type PartId = (typeof PARTS)[number]['id'];

export interface Backup {
  app: 'batnab';
  v: 1;
  at: number;
  data: Record<string, unknown>;
}

/** Reads it all (`onStep`: which part, out of how many). */
export async function makeBackup(onStep?: (done: number, total: number) => void): Promise<Backup> {
  const data: Record<string, unknown> = {};
  let done = 0;
  await Promise.all(
    NODES.map(async ([node]) => {
      // A part the rules don't let the teacher read (none now) is left out rather than failing the whole backup.
      const v = await get(ref(db, node)).then(
        (s) => s.val(),
        () => undefined,
      );
      if (v !== undefined && v !== null) data[node] = v;
      onStep?.(++done, NODES.length);
    }),
  );
  return {app: 'batnab', v: 1, at: Date.now(), data};
}

/** The file read back, or why it isn't a backup. */
export function readBackup(text: string): Backup | string {
  let v: Partial<Backup>;
  try {
    v = JSON.parse(text);
  } catch {
    return 'Файлыг уншиж чадсангүй: JSON биш байна.';
  }
  if (!v || v.app !== 'batnab' || v.v !== 1 || typeof v.at !== 'number' || !v.data || typeof v.data !== 'object') return 'Энэ файл Batnab-ийн нөөц биш байна.';
  return v as Backup;
}

/** Each record of a node down to its depth: path → value. */
function records(node: string, value: unknown, depth: number) {
  const out: [string, unknown][] = [];
  const walk = (path: string, v: unknown, left: number) => {
    if (left === 0 || !v || typeof v !== 'object' || Array.isArray(v)) return void out.push([path, v]);
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(`${path}/${k}`, x, left - 1);
  };
  walk(node, value, depth);
  return out;
}

/** How many records each part has in the file. */
export const partCounts = (b: Backup) =>
  Object.fromEntries(
    PARTS.map((p) => [
      p.id,
      p.nodes.reduce((a, node) => {
        const depth = NODES.find(([n]) => n === node)![1];
        return a + (b.data[node] === undefined ? 0 : records(node, b.data[node], depth).length);
      }, 0),
    ]),
  ) as Record<PartId, number>;

/** One write stays under this (a topic's pictures can be large: they go a few at a time). */
const LIMIT = 4_000_000;

/** Puts the chosen parts back; returns how many records were written. */
export async function restoreBackup(b: Backup, parts: PartId[], onStep?: (done: number, total: number) => void) {
  const ops: [string, unknown][] = [];
  for (const p of PARTS.filter((x) => parts.includes(x.id)))
    for (const node of p.nodes) {
      const depth = NODES.find(([n]) => n === node)![1];
      if (b.data[node] !== undefined) ops.push(...records(node, b.data[node], depth));
    }
  // In batches of about LIMIT characters.
  const batches: Record<string, unknown>[] = [];
  let cur: Record<string, unknown> = {};
  let size = 0;
  for (const [path, v] of ops) {
    const n = JSON.stringify(v ?? null).length + path.length;
    if (size && size + n > LIMIT) {
      batches.push(cur);
      cur = {};
      size = 0;
    }
    cur[path] = v;
    size += n;
  }
  if (size) batches.push(cur);
  for (const [i, batch] of batches.entries()) {
    await update(ref(db), batch);
    onStep?.(i + 1, batches.length);
  }
  return ops.length;
}

const LAST = 'batnab.lastBackup';
/** When a backup was last saved from this device. */
export function lastBackup() {
  try {
    return Number(localStorage.getItem(LAST)) || null;
  } catch {
    return null;
  }
}
export function markBackedUp(at: number) {
  try {
    localStorage.setItem(LAST, String(at));
  } catch {
    // private window: no reminder then
  }
}
