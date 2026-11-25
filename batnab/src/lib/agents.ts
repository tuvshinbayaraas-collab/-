// The agent («Agent» in the teacher's dashboard) does one job: it reads photographed book pages (or a PDF's) and splits
// them into problems. A topic or a folder of the problem bank sends the pages («Agent-аар хуваах»); every 5 minutes .github/workflows/batnab-agent.yml
// (scripts/agent.mjs) takes the oldest, and Claude reads each page: each problem's number, its part of the page, its
// text and choices. The teacher checks them in the cutting dialog and adds them to the topic or the folder.
//   agentTasks/{id} = {kind: 'split', topic or folder, title, pages, at, status, added? (pages added so far), decidedAt?,
//                      and the runner's: startedAt?, error?, spent? (dollars), log?, result?: {problems: [...], at}}
//   status: new → working → review → done (added); new, review or failed → rejected (dropped); failed → new (again);
//           review → new (split again, after the teacher said what to do better).
//   agentPages/{id}/{n} = page n as sent (a JPEG data URL), deleted once the request is done or dropped.
//   agentRunner = {lastSeen, claude}: when the workflow last ran, and whether it has Claude's key.
//   agentNotes/{id} = {text, at, from? (the request it was said about)}: what the teacher told the agent after checking
//                     its work («Шүүмж»). Every split reads them all, so the agent does better the next time.
//   agentDispatch = {token, at}: a GitHub key the teacher made (fine-grained, this repository, Actions only), so the
//                   site starts the agent the moment pages are sent (GitHub's schedule is often hours late), and the
//                   runner starts the next run while requests wait. Not in the backup.
// Only the teacher reads and writes these; the runner uses the Admin SDK.
import {get, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {db} from './firebase';
import {useLive} from './live';
import type {AgentFound} from './pageSplit';

export type AgentStatus = 'new' | 'working' | 'review' | 'done' | 'rejected' | 'failed';
const STATUSES: AgentStatus[] = ['new', 'working', 'review', 'done', 'rejected', 'failed'];

export const REPO = 'https://github.com/tuvshinbayaraas-collab/-';
/** The agent's page on GitHub, where «Run workflow» starts it now (GitHub's every-5-minutes schedule is often late). */
export const RUN_NOW = `${REPO}/actions/workflows/batnab-agent.yml`;
/** GitHub's API for the agent's workflow: started on the default branch, where its schedule is. */
const WORKFLOW_API = 'https://api.github.com/repos/tuvshinbayaraas-collab/-/actions/workflows/batnab-agent.yml';
/** Where the teacher makes the key: a fine-grained token, named, with Actions: write (the rest is chosen there). */
export const NEW_KEY = 'https://github.com/settings/personal-access-tokens/new?name=Batnab%20agent&description=Starts%20the%20Batnab%20agent&actions=write';
/** A fine-grained GitHub token (a classic one can do far more than start the agent). */
export const isKey = (v: string) => /^github_pat_[A-Za-z0-9_]{20,255}$/.test(v);

/** Whether the site can start the agent itself: null while loading. */
export const useAgentDispatch = () =>
  useLive('agentDispatch', (v): {at: number} | false => {
    const d = v as {token?: unknown; at?: unknown} | null;
    return d && typeof d.token === 'string' ? {at: num(d.at)} : false;
  });

async function dispatch(token: string) {
  const r = await fetch(`${WORKFLOW_API}/dispatches`, {
    method: 'POST',
    // Only headers GitHub lets a web page send (its default API version, as the runner names).
    headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({ref: 'main'}),
  });
  return r.status;
}
const keyError = (status: number) =>
  status === 401
    ? 'GitHub түлхүүрийг хүлээж авсангүй (буруу, эсвэл хугацаа нь дууссан). «Agent» хэсэгт шинийг хадгална уу.'
    : status === 403 || status === 404
      ? 'Энэ түлхүүр Agent-ийг эхлүүлэх эрхгүй байна (сайтын репо, Actions: Read and write). «Agent» хэсгийг үзнэ үү.'
      : `GitHub хариу өгсөнгүй (${status}). Удахгүй өөрөө эхэлнэ, эсвэл «Одоо эхлүүлэх» дарна.`;

/**
 * Starts the agent now, with the teacher's key: 'started', 'none' (no key: GitHub's schedule, or «Одоо эхлүүлэх»),
 * or why it could not.
 */
export async function startAgent(): Promise<{ok: true; how: 'started' | 'none'} | {ok: false; error: string}> {
  const token = (await get(ref(db, 'agentDispatch/token'))).val();
  if (typeof token !== 'string' || !token) return {ok: true, how: 'none'};
  try {
    const status = await dispatch(token);
    return status === 204 ? {ok: true, how: 'started'} : {ok: false, error: keyError(status)};
  } catch {
    return {ok: false, error: 'GitHub-д хүрч чадсангүй. Удахгүй өөрөө эхэлнэ, эсвэл «Одоо эхлүүлэх» дарна.'};
  }
}

/** The teacher's key, kept once it has started the agent (so it is known to work). */
export async function saveDispatchKey(key: string) {
  const token = key.trim();
  if (!isKey(token)) throw new Error('Энэ GitHub-ийн «fine-grained» түлхүүр биш байна: «github_pat_»-аар эхэлдэг.');
  let status: number;
  try {
    status = await dispatch(token);
  } catch {
    throw new Error('GitHub-д хүрч чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.');
  }
  if (status !== 204) throw new Error(keyError(status));
  await set(ref(db, 'agentDispatch'), {token, at: serverTimestamp()});
}
export const removeDispatchKey = () => set(ref(db, 'agentDispatch'), null);

/** The teacher's notes to the agent: how many, how long each (every split reads them all: kept short). */
export const MAX_NOTES = 20;
export const NOTE_LEN = 300;

/** Pages in one request, at most (the rules allow as many). */
export const MAX_PAGES = 10;

export interface AgentProblem extends AgentFound {
  /** Its page, from 0. */
  page: number;
}

/** Where a request's problems go: a topic, or a folder of the problem bank (with its name for the lists). */
export type AgentTarget = {topic: string; title: string} | {folder: string; title: string};

export interface AgentTask {
  id: string;
  topic: string;
  folder: string;
  title: string;
  pages: number;
  at: number;
  status: AgentStatus;
  added: number;
  error?: string;
  startedAt?: number;
  /** What the agent used on it, in dollars at the API's prices. */
  spent: number;
  log: {text: string; at: number}[];
  problems: AgentProblem[];
}

export interface AgentRunner {
  lastSeen: number;
  claude: boolean;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = <T,>(v: unknown) => (Array.isArray(v) ? v : Object.values((v ?? {}) as object)) as T[];

function parseProblem(v: unknown): AgentProblem | null {
  const p = v as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return null;
  const boxes = list<Record<string, unknown>>(p.boxes)
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({x0: num(b.x0), y0: num(b.y0), x1: num(b.x1), y1: num(b.y1)}))
    .filter((b) => b.x1 > b.x0 && b.y1 > b.y0);
  if (!boxes.length) return null;
  const c = (p.choices ?? {}) as Record<string, unknown>;
  const choices = Object.fromEntries((['A', 'B', 'C', 'D', 'E'] as const).filter((k) => typeof c[k] === 'string' && c[k]).map((k) => [k, c[k] as string]));
  return {page: num(p.page), num: num(p.num) || 1, boxes, text: str(p.text), ...(Object.keys(choices).length ? {choices} : {})};
}

export function parseTask(id: string, v: unknown): AgentTask | null {
  const t = v as Record<string, unknown> | null;
  if (!t || typeof t !== 'object' || t.kind !== 'split' || !STATUSES.includes(t.status as AgentStatus)) return null;
  const result = (t.result ?? {}) as {problems?: unknown};
  return {
    id,
    topic: str(t.topic),
    folder: str(t.folder),
    title: str(t.title),
    pages: num(t.pages),
    at: num(t.at),
    status: t.status as AgentStatus,
    added: num(t.added),
    error: str(t.error) || undefined,
    startedAt: num(t.startedAt) || undefined,
    spent: num(t.spent),
    log: list<{text?: unknown; at?: unknown}>(t.log)
      .flatMap((l) => (l && typeof l.text === 'string' ? [{text: l.text, at: num(l.at)}] : []))
      .sort((a, b) => a.at - b.at),
    problems: list(result.problems).flatMap((p) => parseProblem(p) ?? []),
  };
}

/** Every request, newest first; null while loading. */
export const useAgentTasks = (on = true) =>
  useLive(on ? 'agentTasks' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, unknown>)
      .flatMap(([id, t]) => parseTask(id, t) ?? [])
      .sort((a, b) => b.at - a.at),
  );

export interface AgentNote {
  id: string;
  text: string;
  at: number;
  from: string;
}

/** The teacher's notes to the agent, oldest first; null while loading. */
export const useAgentNotes = () =>
  useLive('agentNotes', (v) =>
    Object.entries((v ?? {}) as Record<string, {text?: unknown; at?: unknown; from?: unknown} | null>)
      .flatMap(([id, n]) => (n && typeof n.text === 'string' ? [{id, text: n.text, at: num(n.at), from: str(n.from)}] : []))
      .sort((a, b) => a.at - b.at),
  );
/** A note for every split from now on (`from`: the request it was said about). */
export const addNote = (text: string, from?: string) => set(push(ref(db, 'agentNotes')), {text: text.trim().slice(0, NOTE_LEN), at: serverTimestamp(), ...(from ? {from} : {})});
export const removeNote = (id: string) => set(ref(db, `agentNotes/${id}`), null);

/** When the workflow last ran: null while loading, false if it never has. */
export const useAgentRunner = () =>
  useLive('agentRunner', (v): AgentRunner | false => {
    const r = v as {lastSeen?: unknown; claude?: unknown} | null;
    return r && typeof r.lastSeen === 'number' ? {lastSeen: r.lastSeen, claude: r.claude === true} : false;
  });

/** A page as sent: a JPEG small enough for the database and for Claude to read. */
export function pageData(c: HTMLCanvasElement) {
  for (const q of [0.82, 0.7, 0.55]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length < 1_500_000) return url;
  }
  return c.toDataURL('image/jpeg', 0.45);
}

/** A request's id: lowercase letters and digits only (the rules check it). */
export function newTaskId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Date.now().toString(36) + Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

/**
 * Sends pages to the agent: the pages first, one write each (a page can be over a megabyte), then the request that
 * points at them, so the runner never sees a request whose pages are still on their way.
 */
export async function sendPages(target: AgentTarget, pages: string[]) {
  const id = newTaskId();
  for (const [n, p] of pages.entries()) await set(ref(db, `agentPages/${id}/${n}`), p);
  const where = 'topic' in target ? {topic: target.topic} : {folder: target.folder};
  await set(ref(db, `agentTasks/${id}`), {kind: 'split', ...where, title: target.title.slice(0, 200), pages: pages.length, at: serverTimestamp(), status: 'new'});
  return id;
}

/** A request's pages as sent, in order. */
export async function loadPages(id: string) {
  const v = (await get(ref(db, `agentPages/${id}`))).val();
  return list<unknown>(v).filter((x): x is string => typeof x === 'string');
}

const task = (id: string) => ref(db, `agentTasks/${id}`);
/** One page's problems added to the topic: a request opened again goes on from the next. */
export const pageAdded = (id: string, n: number) => update(task(id), {added: n});
/** All added: done, and its pages no longer kept. */
export const finishTask = (id: string) => update(ref(db), {[`agentTasks/${id}/status`]: 'done', [`agentTasks/${id}/decidedAt`]: serverTimestamp(), [`agentPages/${id}`]: null});
/** Dropped (or stopped before it was read): its pages are not kept either. */
export const dropTask = (id: string) => update(ref(db), {[`agentTasks/${id}/status`]: 'rejected', [`agentTasks/${id}/decidedAt`]: serverTimestamp(), [`agentPages/${id}`]: null});
export const retryTask = (id: string) => update(task(id), {status: 'new', error: null});
/** Split again (nothing of it added yet), now with the teacher's notes: what it found before is dropped. */
export const redoTask = (id: string) => update(task(id), {status: 'new', error: null, result: null, added: null, startedAt: null});
export const removeTask = (id: string) => update(ref(db), {[`agentTasks/${id}`]: null, [`agentPages/${id}`]: null});
