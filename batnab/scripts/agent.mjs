// The teacher's agents («Agent» in the teacher's dashboard), run by .github/workflows/batnab-agent.yml every 10 minutes.
// The workflow's steps call this script for everything that touches the database (agentTasks, agentRunner):
//   plan                  the runner was here; one request the teacher approved, to push; the ones turned down, to
//                         clean up; and, when nothing else is being done, the oldest new request (marked as being done),
//                         with the managing agent's instructions written to ROUTE_FILE
//   routed <id>           the managing agent's choice of team, from its run's file (EXEC); the team lead's
//                         instructions go to LEAD_FILE
//   report <id>           the lead's work for the teacher to check: the summary from REPORT (a JSON file), FILES,
//                         BRANCH, COMMIT, PREVIEW, RESTORED and COST from the environment; the teacher then pushes it
//                         or not
//   fail <id> <message>   it could not be done (the teacher may try again); COST as above
//   pushed <id> <commit>  merged into the site's branch and sent to deploy
//   cleaned <id>          a turned-down request's branch and preview are gone
// The repository is public, and so are the workflow's logs: the teacher's words only ever go to files, never to the
// outputs printed in the logs. Against the emulators (FIREBASE_DATABASE_EMULATOR_HOST) it needs no credentials.
// Outputs go to $GITHUB_OUTPUT (printed when it isn't set).
import {applicationDefault, initializeApp} from 'firebase-admin/app';
import {getDatabase, ServerValue} from 'firebase-admin/database';
import {appendFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

const PROJECT = 'rgtbn-bb94f';
const emulated = !!process.env.FIREBASE_DATABASE_EMULATOR_HOST;
initializeApp({
  projectId: PROJECT,
  databaseURL: emulated ? `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${PROJECT}-default-rtdb` : `https://${PROJECT}-default-rtdb.firebaseio.com`,
  ...(emulated ? {} : {credential: applicationDefault()}),
});
const db = getDatabase();
const tasks = db.ref('agentTasks');
const AGENTS = new URL('../agents/', import.meta.url);
const read = (name) => readFileSync(new URL(name, AGENTS), 'utf8').trim();

/** The teams the managing agent may hand a request to (batnab/agents/<team>.md), by their names in the dashboard. */
const TEAMS = {tests: 'Тест, бодлого', games: 'Тоглоом', design: 'Дизайн, текст', data: 'Өгөгдөл, аюулгүй байдал', general: 'Ерөнхий'};
/** A request's id is also its branch (agent/<id>) and preview channel (agent-<id>): only these are taken. */
const ID = /^[a-z0-9]{6,24}$/;
/** The workflow's jobs stop after 15 + 60 + 20 minutes: a request still marked as being done after this was left behind. */
const STUCK = 100 * 60_000;

function output(name, value) {
  const text = String(value ?? '');
  if (text.includes('\n')) throw new Error(`output ${name} is more than one line`);
  if (!process.env.GITHUB_OUTPUT) return console.log(`${name}=${text}`);
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${text}\n`);
}

function writeTo(env, text) {
  const file = process.env[env];
  if (!file) return console.log(`----- ${env}\n${text}\n-----`);
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, `${text}\n`);
}

const log = (id, text) => tasks.child(`${id}/log`).push({text, at: ServerValue.TIMESTAMP});

/** The request as the agents read it: the teacher's words, then each word added later, in order. */
function request(t) {
  const notes = Object.values(t.notes ?? {})
    .filter((n) => n && typeof n.text === 'string')
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  return [String(t.text ?? ''), ...notes.map((n, i) => `Нэмэлт ${i + 1}: ${n.text}`)].join('\n\n');
}

/** Moves a request's status from `from` to `to` only if it is still `from` (the teacher may have turned it down since). */
async function claim(id, from, to) {
  const {committed, snapshot} = await tasks.child(`${id}/status`).transaction((s) => (s === null ? null : s === from ? to : undefined));
  return committed && snapshot.val() === to;
}

async function plan() {
  await db.ref('agentRunner').set({lastSeen: ServerValue.TIMESTAMP, claude: process.env.CLAUDE === 'true'});
  const now = Date.now();
  const all = Object.entries((await tasks.get()).val() ?? {}).filter(([id, t]) => ID.test(id) && t && typeof t === 'object');
  for (const [id, t] of all)
    if ((t.status === 'working' || t.status === 'pushing') && (t.startedAt ?? 0) < now - STUCK) {
      await tasks.child(id).update({status: 'failed', error: 'Хугацаа хэтэрч зогссон. Дахин оролдоно уу.'});
      await log(id, 'Хугацаа хэтэрсэн тул зогслоо.');
      t.status = 'failed';
    }
  const approved = all.filter(([, t]) => t.status === 'approved').sort((a, b) => (a[1].decidedAt ?? 0) - (b[1].decidedAt ?? 0))[0];
  if (approved && (await claim(approved[0], 'approved', 'pushing'))) {
    await tasks.child(approved[0]).update({startedAt: ServerValue.TIMESTAMP});
    await log(approved[0], 'Сайтын салбартай нэгтгэж байна.');
    output('merge', approved[0]);
    output('merge_team', Object.hasOwn(TEAMS, approved[1].route?.team ?? '') ? approved[1].route.team : 'general');
  }
  output('clean', all.filter(([, t]) => t.status === 'rejected' && !t.cleaned).map(([id]) => id).join(' '));
  // One request at a time: the next waits until this one is done.
  if (process.env.CLAUDE !== 'true' || all.some(([, t]) => t.status === 'working')) return;
  const next = all.filter(([, t]) => t.status === 'new').sort((a, b) => (a[1].at ?? 0) - (b[1].at ?? 0))[0];
  if (!next) return;
  const [id] = next;
  if (!(await claim(id, 'new', 'working'))) return;
  await tasks.child(id).update({startedAt: ServerValue.TIMESTAMP, error: null});
  const t = (await tasks.child(id).get()).val() ?? {};
  await log(id, 'Удирдах agent даалгаврыг уншиж байна.');
  writeTo('ROUTE_FILE', `${read('manager.md')}\n\n## Багшийн даалгавар\n\n${request(t)}`);
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

/** What the agents cost on this request, in dollars, all rounds together. */
async function spend(id, usd) {
  const n = Number(usd);
  if (!(n > 0 && n < 1000)) return;
  await tasks.child(`${id}/spent`).transaction((v) => Math.round(((Number(v) || 0) + n) * 10000) / 10000);
}

async function routed(id) {
  // The managing agent's answer is read from its run's file, not from the workflow, so it never shows in the logs.
  const run = resultOf(process.env.EXEC ?? '');
  const answer = run?.structured_output && typeof run.structured_output === 'object' ? run.structured_output : {};
  const team = Object.hasOwn(TEAMS, answer.team ?? '') ? answer.team : 'general';
  const why = typeof answer.why === 'string' ? answer.why.trim().slice(0, 500) : '';
  await tasks.child(id).update({route: {team, why}});
  await spend(id, run?.total_cost_usd);
  await log(id, run?.structured_output ? `Удирдах agent «${TEAMS[team]}» багийн ахлахад өглөө.` : `Удирдах agent хариу өгсөнгүй. «${TEAMS[team]}» багийн ахлахад өглөө.`);
  const t = (await tasks.child(id).get()).val() ?? {};
  const before = t.result?.summary
    ? `\n\n## Өмнө нь хийсэн ажил\n\nThis branch already has the earlier work on this request. Its report was:\n\n${t.result.summary}\n\nBuild on it: do what the teacher added.`
    : '';
  writeTo('LEAD_FILE', `${read('common.md')}\n\n${read(`${team}.md`)}\n\n## Багшийн даалгавар\n\n${request(t)}${before}`);
  output('team', team);
  output('earlier', before ? 'true' : 'false');
}

const lines = (text, max) =>
  String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);

async function report(id) {
  let summary = '';
  try {
    summary = String(JSON.parse(readFileSync(process.env.REPORT ?? '', 'utf8')).summary ?? '').trim();
  } catch {
    // No report: said below.
  }
  const files = lines(process.env.FILES, 300).map((l) => l.slice(0, 300));
  const restored = lines(process.env.RESTORED, 50).map((l) => l.slice(0, 300));
  await tasks.child(id).update({
    status: 'review',
    error: null,
    result: {
      summary: (summary || 'Agent тайлан бичээгүй. Өөрчлөлтийг урьдчилан харах холбоосоор шалгана уу.').slice(0, 8000),
      files,
      ...(restored.length ? {restored} : {}),
      branch: process.env.BRANCH || `agent/${id}`,
      commit: process.env.COMMIT ?? '',
      ...(process.env.PREVIEW ? {preview: process.env.PREVIEW} : {}),
      at: ServerValue.TIMESTAMP,
    },
  });
  await spend(id, process.env.COST);
  await log(id, files.length ? 'Ажил дууслаа. Таны шийдвэрийг хүлээж байна.' : 'Ажил дууслаа. Сайтад өөрчлөлт хийгдээгүй.');
}

async function fail(id, message) {
  await tasks.child(id).update({status: 'failed', error: String(message || 'Алдаа гарлаа.').slice(0, 1500)});
  await spend(id, process.env.COST);
  await log(id, 'Амжилтгүй боллоо.');
}

async function pushed(id, commit) {
  await tasks.child(id).update({status: 'pushed', pushedCommit: commit ?? '', pushedAt: ServerValue.TIMESTAMP, error: null});
  await log(id, 'Сайтад гаргахаар илгээлээ. Хэдэн минутын дараа шинэчлэгдэнэ.');
}

const cleaned = (id) => tasks.child(id).update({cleaned: true});

const [cmd, id, arg] = process.argv.slice(2);
const job = {plan, routed, report, fail, pushed, cleaned}[cmd];
if (!job || (cmd !== 'plan' && !ID.test(id ?? ''))) {
  console.error(`usage: agent.mjs plan | routed <id> | report <id> | fail <id> <message> | pushed <id> <commit> | cleaned <id>`);
  process.exit(2);
}
try {
  await (cmd === 'plan' ? plan() : job(id, arg));
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
