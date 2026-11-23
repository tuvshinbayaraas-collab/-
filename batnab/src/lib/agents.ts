// The teacher's agents («Agent» in the teacher's dashboard). The teacher writes what to change on the site; on GitHub
// (.github/workflows/batnab-agent.yml with scripts/agent.mjs), every 10 minutes, the managing agent hands it to the team
// whose lead does the work, on a branch of its own. The site changes only when the teacher pushes it.
//   agentTasks/{id} = {text, at, status, notes?: {nid: {text, at}}, decidedAt?, error?, and the runner's own:
//                      route?: {team, why}, log?: {lid: {text, at}}, startedAt?, spent? (dollars, all rounds),
//                      result?: {summary, files: ["M\tpath"…], restored?: [path…], branch, commit, preview?, at},
//                      pushedAt?, pushedCommit?, cleaned?}
//   status: new → working → review → approved → pushing → pushed. From review the teacher adds a word (back to new:
//           the lead goes on from its work) or turns it down (rejected, then cleaned up); failed is tried again (new) or
//           dropped (rejected).
//   agentRunner = {lastSeen, claude}: when the workflow last ran, and whether it has Claude's key.
// Only the teacher reads and writes these; the runner uses the Admin SDK.
import {push, ref, remove, serverTimestamp, set, update} from 'firebase/database';
import {db} from './firebase';
import {useLive} from './live';

export type AgentStatus = 'new' | 'working' | 'review' | 'approved' | 'pushing' | 'pushed' | 'rejected' | 'failed';
const STATUSES: AgentStatus[] = ['new', 'working', 'review', 'approved', 'pushing', 'pushed', 'rejected', 'failed'];

/** The teams the managing agent hands work to, as batnab/agents/<team>.md has them. */
export const TEAMS: Record<string, string> = {tests: 'Тест, бодлого', games: 'Тоглоом', design: 'Дизайн, текст', data: 'Өгөгдөл, аюулгүй байдал', general: 'Ерөнхий'};

export const REPO = 'https://github.com/tuvshinbayaraas-collab/-';
export const SITE_BRANCH = 'claude/youtube-site-batnab-jfgjry';
/** As the database rules allow. */
export const MAX_TEXT = 4000;
export const MAX_NOTE = 2000;

export interface AgentNote {
  text: string;
  at: number;
}

export interface AgentResult {
  summary: string;
  /** "M\tbatnab/src/…" as git lists them: A added, M changed, D deleted. */
  files: string[];
  /** Files the agent changed but may not: put back as they were. */
  restored: string[];
  branch: string;
  commit: string;
  preview?: string;
  at: number;
}

export interface AgentTask {
  id: string;
  text: string;
  at: number;
  status: AgentStatus;
  notes: AgentNote[];
  route?: {team: string; why: string};
  log: AgentNote[];
  result?: AgentResult;
  error?: string;
  startedAt?: number;
  decidedAt?: number;
  pushedAt?: number;
  pushedCommit?: string;
  cleaned: boolean;
  /** What the agents cost on it, in dollars. */
  spent: number;
}

export interface AgentRunner {
  lastSeen: number;
  claude: boolean;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? v : Object.values((v ?? {}) as object)).filter((x): x is string => typeof x === 'string');
const notes = (v: unknown) =>
  Object.values((v ?? {}) as Record<string, {text?: unknown; at?: unknown}>)
    .flatMap((n) => (n && typeof n.text === 'string' ? [{text: n.text, at: num(n.at)}] : []))
    .sort((a, b) => a.at - b.at);

export function parseTask(id: string, v: unknown): AgentTask | null {
  const t = v as Record<string, unknown> | null;
  if (!t || typeof t !== 'object' || typeof t.text !== 'string' || !STATUSES.includes(t.status as AgentStatus)) return null;
  const r = t.result as Record<string, unknown> | undefined;
  const route = t.route as {team?: unknown; why?: unknown} | undefined;
  return {
    id,
    text: t.text,
    at: num(t.at),
    status: t.status as AgentStatus,
    notes: notes(t.notes),
    route: route && typeof route.team === 'string' ? {team: route.team, why: str(route.why)} : undefined,
    log: notes(t.log),
    result:
      r && typeof r === 'object'
        ? {summary: str(r.summary), files: list(r.files), restored: list(r.restored), branch: str(r.branch), commit: str(r.commit), preview: str(r.preview) || undefined, at: num(r.at)}
        : undefined,
    error: str(t.error) || undefined,
    startedAt: num(t.startedAt) || undefined,
    decidedAt: num(t.decidedAt) || undefined,
    pushedAt: num(t.pushedAt) || undefined,
    pushedCommit: str(t.pushedCommit) || undefined,
    cleaned: t.cleaned === true,
    spent: num(t.spent),
  };
}

/** Every request, newest first; null while loading. */
export const useAgentTasks = (on = true) =>
  useLive(on ? 'agentTasks' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, unknown>)
      .flatMap(([id, t]) => parseTask(id, t) ?? [])
      .sort((a, b) => b.at - a.at),
  );

/** When the workflow last ran: null while loading, false if it never has. */
export const useAgentRunner = () =>
  useLive('agentRunner', (v): AgentRunner | false => {
    const r = v as {lastSeen?: unknown; claude?: unknown} | null;
    return r && typeof r.lastSeen === 'number' ? {lastSeen: r.lastSeen, claude: r.claude === true} : false;
  });

/** A new request's id: also its branch (agent/<id>) and preview (agent-<id>), so lowercase letters and digits only. */
export function newTaskId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Date.now().toString(36) + Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

const task = (id: string) => ref(db, `agentTasks/${id}`);

export async function addAgentTask(text: string) {
  const id = newTaskId();
  await set(task(id), {text: text.trim(), at: serverTimestamp(), status: 'new'});
  return id;
}

/** A word added to a request (from review or after it failed): the lead takes it up again with all the words so far. */
export function addAgentNote(id: string, text: string) {
  const nid = push(ref(db, `agentTasks/${id}/notes`)).key!;
  return update(task(id), {[`notes/${nid}`]: {text: text.trim(), at: serverTimestamp()}, status: 'new', error: null});
}

/** The teacher's say: push it to the site, turn it down (or drop it), or try again. */
export const approveAgentTask = (id: string) => update(task(id), {status: 'approved', decidedAt: serverTimestamp()});
export const rejectAgentTask = (id: string) => update(task(id), {status: 'rejected', decidedAt: serverTimestamp()});
export const retryAgentTask = (id: string) => update(task(id), {status: 'new', error: null});
export const removeAgentTask = (id: string) => remove(task(id));
