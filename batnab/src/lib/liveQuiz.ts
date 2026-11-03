// A live class quiz ("Шууд тэмцээн", like Kahoot): the teacher runs a topic's problems one at a time on the board, the
// students answer on their phones, the quicker right answers get more points. One quiz at a time:
//   live                {tid, title, pids[], cur, state: lobby|q|reveal|done, qStart, dur, startedAt, classes?,
//                        closed: the question answers are no longer taken for, key: its right answer once revealed}
//   liveQ               the current problem as shown (copied by the teacher: a draft topic's too), apart from `live`
//                        so that the home pages' banner doesn't download its picture
//   livePlayers/{uid}   {name, at, team?}   joining (the name others see: the nickname or @username); the team is set
//                        by the teacher's board (teams of even size, or by class), never by the student
//   liveAnswers/{i}/{uid} {a, at}           the answer to question i: once, while it's open (the rules check the time)
//   liveScores/{uid}    {score, last, ok, a, q}   written by the teacher's page at each reveal (q: which question,
//                        a: whether it was answered)
// The students never read the keys or each other's answers: the teacher's page scores them.
import {get, onValue, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {auth, db} from './firebase';
import {useLive} from './live';
import {serverNow} from './time';
import {readKey, verdict, type Letter, type Problem, type Topic} from './topics';

export type LiveState = 'lobby' | 'q' | 'reveal' | 'done';

/** The question on the board (and the phones). */
export interface LiveQuestion {
  no: number;
  text: string;
  /** The picture itself (a data URL). */
  img?: string;
  kind: Problem['kind'];
  choices?: Partial<Record<Letter, string>>;
}

export interface LiveQuiz {
  tid: string;
  title: string;
  pids: string[];
  cur: number;
  state: LiveState;
  qStart: number;
  /** Seconds per question. */
  dur: number;
  startedAt: number;
  classes?: Record<string, true>;
  key?: string;
  /** Teams (id → name, colour): as many as asked for, or one per class (`teamBy`). None: everyone for themselves. */
  teams?: Record<string, LiveTeam>;
  teamBy?: 'count' | 'class';
}

export interface LiveTeam {
  name: string;
  /** Index into TEAM_COLORS. */
  color: number;
}

export interface LivePlayer {
  uid: string;
  name: string;
  at: number;
  team?: string;
}

/** Team colours: a team's tile, dot and bar. */
export const TEAM_COLORS = ['bg-red-500', 'bg-sky-600', 'bg-amber-500', 'bg-green-500', 'bg-pink-500', 'bg-cyan-500'];
const TEAM_NAMES = ['Улаан', 'Цэнхэр', 'Шар', 'Ногоон', 'Ягаан', 'Хөх'];

/** Teams for a new quiz: `n` coloured ones, or one per class among those given. */
export function makeTeams(by: 'count' | 'class', n: number, classes: {id: string; name: string}[]): Record<string, LiveTeam> {
  if (by === 'class') return Object.fromEntries(classes.map((c, i) => [c.id, {name: c.name, color: i % TEAM_COLORS.length}]));
  return Object.fromEntries(Array.from({length: n}, (_, i) => [`t${i}`, {name: TEAM_NAMES[i], color: i}]));
}

/**
 * Teams for the players who have none yet (the teacher's board does it as they join): their class's team, else the
 * smallest team (the earliest of equals).
 */
export function teamsFor(players: LivePlayer[], teams: Record<string, LiveTeam>, classOf: (uid: string) => string | undefined, by: 'count' | 'class' | undefined) {
  const ids = Object.keys(teams);
  if (!ids.length) return {};
  const size = Object.fromEntries(ids.map((id) => [id, players.filter((p) => p.team === id).length]));
  const out: Record<string, string> = {};
  for (const p of players)
    if (!p.team || !teams[p.team]) {
      const own = by === 'class' ? classOf(p.uid) : undefined;
      const id = own && teams[own] ? own : ids.reduce((a, b) => (size[b] < size[a] ? b : a));
      out[p.uid] = id;
      size[id]++;
    }
  return out;
}

/** The teams by their average score (fair to a smaller team), best first. */
export function teamRanking(players: LivePlayer[], scores: Record<string, LiveScore>, teams: Record<string, LiveTeam> | undefined) {
  if (!teams) return [];
  const list = Object.entries(teams).map(([id, t]) => {
    const members = players.filter((p) => p.team === id);
    const total = members.reduce((a, p) => a + (scores[p.uid]?.score ?? 0), 0);
    return {id, ...t, members: members.length, total, avg: members.length ? Math.round(total / members.length) : 0};
  });
  const ranked = list.filter((t) => t.members > 0).sort((a, b) => b.avg - a.avg || b.total - a.total);
  return ranked.map((t) => ({...t, place: 1 + ranked.filter((x) => x.avg > t.avg).length}));
}
export interface LiveScore {
  score: number;
  /** Points from the last question revealed (`q`), whether it was answered and right. */
  last: number;
  ok: boolean;
  a: boolean;
  q: number;
}

const parse = (v: unknown): LiveQuiz | null => {
  const x = v as Partial<LiveQuiz> | null;
  if (!x || typeof x.tid !== 'string' || !Array.isArray(x.pids) || typeof x.state !== 'string') return null;
  return {
    tid: x.tid,
    title: String(x.title ?? ''),
    pids: x.pids.filter((p): p is string => typeof p === 'string'),
    cur: Number(x.cur) || 0,
    state: (['lobby', 'q', 'reveal', 'done'] as const).includes(x.state as LiveState) ? (x.state as LiveState) : 'lobby',
    qStart: Number(x.qStart) || 0,
    dur: Number(x.dur) || 30,
    startedAt: Number(x.startedAt) || 0,
    classes: x.classes && typeof x.classes === 'object' ? x.classes : undefined,
    key: typeof x.key === 'string' ? x.key : undefined,
    teams: x.teams && typeof x.teams === 'object' ? x.teams : undefined,
    teamBy: x.teamBy === 'count' || x.teamBy === 'class' ? x.teamBy : undefined,
  };
};

/** The quiz going on (null: none, or still loading when `on` is false). */
export const useLiveQuiz = (on = true) => useLive(on ? 'live' : null, parse);
/** The question on the board now. */
export const useLiveQuestion = (on = true) => useLive(on ? 'liveQ' : null, (v) => (v && typeof v === 'object' ? (v as LiveQuestion) : null));

/** A quiz left open (the teacher went away) stops being offered after this. */
const STALE = 6 * 3_600_000;
/** Whether students are still being asked to join: on, and not forgotten. */
export const liveOn = (q: LiveQuiz | null | undefined, now = serverNow()): q is LiveQuiz => !!q && q.state !== 'done' && now - q.startedAt < STALE;
/** Whether the quiz has loaded (`useLiveQuiz` is null both while loading and with none). */
export function useLiveQuizState(on = true) {
  const [state, setState] = useState<{q: LiveQuiz | null} | null>(null);
  useEffect(() => {
    if (!on) return;
    return onValue(
      ref(db, 'live'),
      (s) => setState({q: parse(s.val())}),
      () => setState({q: null}),
    );
  }, [on]);
  return state;
}

export const useLivePlayers = (on = true) =>
  useLive(on ? 'livePlayers' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, Partial<LivePlayer>>)
      .map(([uid, p]) => ({uid, name: String(p?.name ?? ''), at: Number(p?.at) || 0, ...(typeof p?.team === 'string' ? {team: p.team} : {})}))
      .sort((a, b) => a.at - b.at),
  );

export const useLiveScores = (on = true) => useLive(on ? 'liveScores' : null, (v) => (v ?? {}) as Record<string, LiveScore>);

/** The answers to question `i` (the teacher's page). */
export const useLiveAnswers = (i: number | null) => useLive(i === null ? null : `liveAnswers/${i}`, (v) => (v ?? {}) as Record<string, {a: string; at: number}>);
/** A student's own answer to question `i` (null: none yet). */
export const useMyLiveAnswer = (i: number | null, uid: string) => useLive(i === null ? null : `liveAnswers/${i}/${uid}`, (v) => (v && typeof (v as {a?: unknown}).a === 'string' ? (v as {a: string}).a : null));

/** Seconds left on the open question (0 when it's over). */
export const secondsLeft = (q: LiveQuiz, now = serverNow()) => Math.max(0, Math.ceil((q.qStart + q.dur * 1000 - now) / 1000));

/** Points for a right answer: 1000 straight away, down to 500 at the last second; none for a wrong one. */
export const points = (ok: boolean, ms: number, dur: number) => (ok ? Math.round(1000 - 500 * Math.min(1, Math.max(0, ms) / (dur * 1000))) : 0);

// ---- the student ----

export function joinLive(name: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  return set(ref(db, `livePlayers/${uid}`), {name: name.slice(0, 40), at: serverTimestamp()});
}

export function answerLive(i: number, a: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  return set(ref(db, `liveAnswers/${i}/${uid}`), {a: a.slice(0, 40), at: serverTimestamp()});
}

// ---- the teacher ----

/** The problems a quiz can ask: those with a right answer to score by. */
export const quizzable = (t: Topic) => t.problems.filter((p) => p.k);

async function questionOf(t: Topic, pid: string): Promise<LiveQuestion> {
  const i = t.problems.findIndex((p) => p.id === pid);
  const p = t.problems[i];
  if (!p) throw new Error('Энэ бодлого сэдвээс устгагдсан байна. Дараагийнх руу шилжинэ үү.');
  const img = p.img ? await get(ref(db, `topicImages/${t.id}/${p.img}`)).then((s) => (typeof s.val() === 'string' ? (s.val() as string) : null)) : null;
  const choices = p.kind === 'choice' && p.choices ? Object.fromEntries(Object.entries(p.choices).filter(([, c]) => c?.trim())) : null;
  return {no: p.no ?? i + 1, text: p.text, ...(img ? {img} : {}), kind: p.kind, ...(choices && Object.keys(choices).length ? {choices} : {})};
}

/** A new quiz, waiting for the students to join (the last one's players, answers and scores cleared). */
export async function startLive(t: Topic, pids: string[], dur: number, classes?: Record<string, true>, teams?: {by: 'count' | 'class'; list: Record<string, LiveTeam>}) {
  await update(ref(db), {
    live: {
      tid: t.id,
      title: t.title.slice(0, 80),
      pids,
      cur: 0,
      state: 'lobby',
      qStart: 0,
      dur,
      startedAt: serverTimestamp(),
      ...(classes && Object.keys(classes).length ? {classes} : {}),
      ...(teams && Object.keys(teams.list).length > 1 ? {teams: teams.list, teamBy: teams.by} : {}),
    },
    liveQ: null,
    livePlayers: null,
    liveAnswers: null,
    liveScores: null,
  });
}

/** Players put in their teams (the teacher's board). */
export const setTeams = (assign: Record<string, string>) => update(ref(db), Object.fromEntries(Object.entries(assign).map(([uid, team]) => [`livePlayers/${uid}/team`, team])));

/** Question `i` on the board, its time running from now. */
export async function openQuestion(t: Topic, quiz: LiveQuiz, i: number) {
  const q = await questionOf(t, quiz.pids[i]);
  await update(ref(db), {liveQ: q, 'live/cur': i, 'live/state': 'q', 'live/key': null, 'live/closed': null, 'live/qStart': serverTimestamp()});
}

/**
 * Time's up (or everyone answered): no more answers taken, then the right answer shown and the points added in one
 * write. Safe to run again (a second board, or a try after a failed one): the points are counted from before this
 * question each time.
 */
export async function revealQuestion(quiz: LiveQuiz) {
  const cur = quiz.cur;
  // From here the rules refuse answers to it: the ones in are all there are.
  await set(ref(db, 'live/closed'), cur);
  const key = await readKey(quiz.tid, quiz.pids[cur]);
  const [answers, players, scores] = await Promise.all(
    [`liveAnswers/${cur}`, 'livePlayers', 'liveScores'].map((p) => get(ref(db, p)).then((s) => (s.val() ?? {}) as Record<string, unknown>)),
  );
  const ops: Record<string, unknown> = {'live/state': 'reveal', 'live/key': key ?? ''};
  for (const uid of Object.keys(players)) {
    const a = answers[uid] as {a: string; at: number} | undefined;
    const s = scores[uid] as LiveScore | undefined;
    const before = s ? (s.q === cur ? s.score - s.last : s.score) : 0;
    const ok = !!a && verdict(a.a, key, null) === true;
    const last = a ? points(ok, a.at - quiz.qStart, quiz.dur) : 0;
    ops[`liveScores/${uid}`] = {score: before + last, last, ok, a: !!a, q: cur};
  }
  await update(ref(db), ops);
}

export const finishLive = () => set(ref(db, 'live/state'), 'done');
/** The quiz taken off (players, answers and scores too). */
export const closeLive = () => update(ref(db), {live: null, liveQ: null, livePlayers: null, liveAnswers: null, liveScores: null});

/** The ranking: score, then who joined first. */
/** The ranking by score (then who joined first); the same score shares a place. */
export function ranking(players: LivePlayer[], scores: Record<string, LiveScore>) {
  const list = players.map((p) => ({...p, score: scores[p.uid]?.score ?? 0, last: scores[p.uid]?.last ?? 0, ok: !!scores[p.uid]?.ok})).sort((a, b) => b.score - a.score || a.at - b.at);
  return list.map((r) => ({...r, place: 1 + list.filter((x) => x.score > r.score).length}));
}

export const LIVE_COLORS: Record<Letter, string> = {A: 'bg-red-500', B: 'bg-sky-600', C: 'bg-amber-500', D: 'bg-green-500', E: 'bg-violet-500'};
