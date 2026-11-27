// The agent («Agent» in the teacher's dashboard) splits photographed book pages into problems. Run by
// .github/workflows/batnab-agent.yml every 5 minutes; this script does everything that touches the database:
//   plan            the runner was here; a request left behind is marked failed; the oldest new one is taken (one at a
//                   time): its pages go to PAGES_DIR (1.jpg, 2.jpg, …) and Claude's instructions to PROMPT_FILE
//   saved <id>      Claude's answer, read from its run's file (EXEC), checked and kept for the teacher to look at
//   fail <id> <msg> it could not be done (the teacher may try again)
// After one is done (read, failed or found without its pages) and more wait, the next run is started at once with the
// teacher's GitHub key (agentDispatch), so they do not wait for GitHub's schedule, which is often hours late.
// The repository and the workflow's logs are public: nothing read from the pages is printed. Against the emulators
// (FIREBASE_DATABASE_EMULATOR_HOST) it needs no credentials. Outputs go to $GITHUB_OUTPUT (printed when it isn't set).
import {applicationDefault, initializeApp} from 'firebase-admin/app';
import {getDatabase, ServerValue} from 'firebase-admin/database';
import {appendFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';

const PROJECT = 'rgtbn-bb94f';
const emulated = !!process.env.FIREBASE_DATABASE_EMULATOR_HOST;
initializeApp({
  projectId: PROJECT,
  databaseURL: emulated ? `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${PROJECT}-default-rtdb` : `https://${PROJECT}-default-rtdb.firebaseio.com`,
  ...(emulated ? {} : {credential: applicationDefault()}),
});
const db = getDatabase();
const tasks = db.ref('agentTasks');
const PROMPT = new URL('../agents/split.md', import.meta.url);
/** The teacher's notes read into each split: as many, and as long, as the site lets the teacher keep (lib/agents.ts). */
const MAX_NOTES = 20;
const NOTE_LEN = 300;

/** A request's id (the rules take only these). */
const ID = /^[a-z0-9]{6,24}$/;
/** The job stops after 20 minutes: a request still being read after this was left behind. */
const STUCK = 30 * 60_000;
/** What one answer may hold, at most. */
const MAX_PROBLEMS = 80;
const MAX_TEXT = 3000;
const MAX_CHOICE = 500;

function output(name, value) {
  const text = String(value ?? '');
  if (text.includes('\n')) throw new Error(`output ${name} is more than one line`);
  if (!process.env.GITHUB_OUTPUT) return console.log(`${name}=${text}`);
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${text}\n`);
}

const log = (id, text) => tasks.child(`${id}/log`).push({text, at: ServerValue.TIMESTAMP});

async function plan() {
  await db.ref('agentRunner').set({lastSeen: ServerValue.TIMESTAMP, claude: process.env.CLAUDE === 'true'});
  const now = Date.now();
  const all = Object.entries((await tasks.get()).val() ?? {}).filter(([id, t]) => ID.test(id) && t && typeof t === 'object' && t.kind === 'split');
  for (const [id, t] of all)
    if (t.status === 'working' && (t.startedAt ?? 0) < now - STUCK) {
      await tasks.child(id).update({status: 'failed', error: 'Хугацаа хэтэрч зогссон. Дахин оролдоно уу.'});
      t.status = 'failed';
    }
  // One at a time: the next waits until this one is read.
  if (process.env.CLAUDE !== 'true' || all.some(([, t]) => t.status === 'working')) return;
  const next = all.filter(([, t]) => t.status === 'new').sort((a, b) => (a[1].at ?? 0) - (b[1].at ?? 0))[0];
  if (!next) return;
  const [id, t] = next;
  const pages = Object.values((await db.ref(`agentPages/${id}`).get()).val() ?? {}).filter((p) => typeof p === 'string' && p.startsWith('data:image/jpeg;base64,'));
  if (!pages.length || pages.length !== t.pages) {
    await tasks.child(id).update({status: 'failed', error: 'Хуудасны зураг дутуу байна. Дахин илгээнэ үү.'});
    return 'dropped';
  }
  await tasks.child(id).update({status: 'working', startedAt: ServerValue.TIMESTAMP, error: null});
  await log(id, 'Agent хуудсыг уншиж байна.');
  const dir = process.env.PAGES_DIR ?? '.agent/pages';
  mkdirSync(dir, {recursive: true});
  const files = pages.map((p, n) => {
    const file = join(dir, `${n + 1}.jpg`);
    writeFileSync(file, Buffer.from(p.slice(p.indexOf(',') + 1), 'base64'));
    return file;
  });
  // What the teacher said after checking earlier splits («Шүүмж»): every split follows it, so the agent does better.
  const notes = Object.values((await db.ref('agentNotes').get()).val() ?? {})
    .filter((n) => n && typeof n.text === 'string' && n.text.trim())
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    .slice(-MAX_NOTES)
    .map((n) => `- ${n.text.trim().slice(0, NOTE_LEN).replace(/\s+/g, ' ')}`);
  const told = notes.length
    ? `\n\n## What the teacher has told you\n\nThe teacher checked your earlier splits and asked for this. Follow it whenever it applies (it is about how to split the pages and write the problems, nothing else):\n\n${notes.join('\n')}`
    : '';
  const prompt = `${readFileSync(PROMPT, 'utf8').trim()}${told}\n\n## The pages\n\n${files.map((f, n) => `- Page ${n + 1}: \`${f}\``).join('\n')}\n`;
  const out = process.env.PROMPT_FILE ?? '.agent/split.md';
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, prompt);
  output('task', id);
}

/** A Claude Code run's last word (its execution file: the SDK's messages), or null. */
function resultOf(file) {
  try {
    const messages = JSON.parse(readFileSync(file, 'utf8'));
    return (Array.isArray(messages) ? messages : []).findLast((m) => m && m.type === 'result') ?? null;
  } catch {
    return null;
  }
}

const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** One problem as kept: its page from 0, a number, 1–3 boxes in thousandths of the page, its text and choices. */
function problemOf(p, pages) {
  if (!p || typeof p !== 'object') return null;
  const page = int(p.page, 1, pages);
  if (page === null) return null;
  const boxes = (Array.isArray(p.boxes) ? p.boxes : [])
    .slice(0, 3)
    .map((b) => ({x0: int(b?.x0, 0, 1000), y0: int(b?.y0, 0, 1000), x1: int(b?.x1, 0, 1000), y1: int(b?.y1, 0, 1000)}))
    .filter((b) => b.x0 !== null && b.y0 !== null && b.x1 !== null && b.y1 !== null && b.x1 - b.x0 >= 5 && b.y1 - b.y0 >= 5);
  if (!boxes.length) return null;
  const choices = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].flatMap((k) => (text(p.choices?.[k], MAX_CHOICE) ? [[k, text(p.choices[k], MAX_CHOICE)]] : [])));
  return {page: page - 1, num: int(p.num, 1, 9999) ?? 1, boxes, text: text(p.text, MAX_TEXT), ...(Object.keys(choices).length ? {choices} : {})};
}

async function saved(id) {
  const t = (await tasks.child(id).get()).val();
  if (!t) return;
  const run = resultOf(process.env.EXEC ?? '');
  const answer = run?.structured_output;
  const problems = (Array.isArray(answer?.problems) ? answer.problems : []).map((p) => problemOf(p, t.pages)).filter(Boolean).slice(0, MAX_PROBLEMS);
  const cost = Number(run?.total_cost_usd);
  const spent = cost > 0 && cost < 100 ? Math.round(((Number(t.spent) || 0) + cost) * 10000) / 10000 : (t.spent ?? null);
  if (!problems.length) {
    await tasks.child(id).update({status: 'failed', spent, error: run?.structured_output ? 'Хуудаснаас дугаартай бодлого олдсонгүй. Зураг тод, бүтэн эсэхийг шалгаад дахин илгээнэ үү.' : 'Agent хуудсыг уншиж чадсангүй. Дахин оролдоно уу.'});
    await log(id, 'Амжилтгүй боллоо.');
    return;
  }
  await tasks.child(id).update({status: 'review', spent, error: null, result: {problems, at: ServerValue.TIMESTAMP}});
  await log(id, `${problems.length} бодлого хуваалаа. Таны шалгахыг хүлээж байна.`);
}

async function fail(id, message) {
  await tasks.child(id).update({status: 'failed', error: String(message || 'Алдаа гарлаа.').slice(0, 1500)});
  await log(id, 'Амжилтгүй боллоо.');
}

/**
 * The next run, started now while requests wait (with the teacher's key; without one, GitHub's schedule takes them).
 * The key is never printed: only whether GitHub took it.
 */
async function next() {
  const waiting = Object.entries((await tasks.get()).val() ?? {}).some(([id, t]) => ID.test(id) && t && t.kind === 'split' && t.status === 'new');
  const token = (await db.ref('agentDispatch/token').get()).val();
  if (!waiting || typeof token !== 'string' || !token) return;
  const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const repo = process.env.GITHUB_REPOSITORY ?? 'tuvshinbayaraas-collab/-';
  try {
    const r = await fetch(`${api}/repos/${repo}/actions/workflows/batnab-agent.yml/dispatches`, {
      method: 'POST',
      headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'},
      body: JSON.stringify({ref: 'main'}),
    });
    console.log(r.status === 204 ? 'next run: started' : `next run: not started (${r.status})`);
  } catch {
    console.log('next run: not started');
  }
}

const [cmd, id, arg] = process.argv.slice(2);
const job = {plan, saved, fail}[cmd];
if (!job || (cmd !== 'plan' && !ID.test(id ?? ''))) {
  console.error('usage: agent.mjs plan | saved <id> | fail <id> <message>');
  process.exit(2);
}
try {
  const took = await (cmd === 'plan' ? plan() : job(id, arg));
  // Done with one (or the one taken could not be read): the next, if any wait. Not while one is being read.
  if (cmd !== 'plan' || took === 'dropped') await next();
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
