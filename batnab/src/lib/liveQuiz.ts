// A live class quiz ("Шууд тэмцээн", like Kahoot): the teacher runs a topic's problems one at a time on the board, the
// students answer on their phones, the quicker right answers get more points. One quiz at a time:
//   live                {tid, title, pids[], cur, state: lobby|q|reveal|done, qStart, dur, startedAt, classes?,
//                        q: the current problem as shown (copied by the teacher: a draft topic's too), key: its right
//                        answer, only once it's revealed}
//   livePlayers/{uid}   {name, at}          joining (the name others see: the nickname or @username)
//   liveAnswers/{i}/{uid} {a, at}           the answer to question i: once, while it's open (the rules check the time)
//   liveScores/{uid}    {score, last, ok, q}   written by the teacher's page at each reveal (q: which question)
// The students never read the keys or each other's answers: the teacher's page scores them.
import {get, onValue, ref, runTransaction, serverTimestamp, set, update} from 'firebase/database';
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
  q?: LiveQuestion;
  key?: string;
}

export interface LivePlayer {
  uid: string;
  name: string;
  at: number;
}
export interface LiveScore {
  score: number;
  /** Points from the last question revealed (`q`), and whether it was right. */
  last: number;
  ok: boolean;
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
    q: x.q && typeof x.q === 'object' ? (x.q as LiveQuestion) : undefined,
    key: typeof x.key === 'string' ? x.key : undefined,
  };
};

/** The quiz going on (null: none, or still loading when `on` is false). */
export const useLiveQuiz = (on = true) => useLive(on ? 'live' : null, parse);
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
      .map(([uid, p]) => ({uid, name: String(p?.name ?? ''), at: Number(p?.at) || 0}))
      .sort((a, b) => a.at - b.at),
  );

export const useLiveScores = (on = true) => useLive(on ? 'liveScores' : null, (v) => (v ?? {}) as Record<string, LiveScore>);

/** The answers to question `i` (the teacher's page). */
export const useLiveAnswers = (i: number | null) => useLive(i === null ? null : `liveAnswers/${i}`, (v) => (v ?? {}) as Record<string, {a: string; at: number}>);

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
  const img = p.img ? await get(ref(db, `topicImages/${t.id}/${p.img}`)).then((s) => (typeof s.val() === 'string' ? (s.val() as string) : null)) : null;
  const choices = p.kind === 'choice' && p.choices ? Object.fromEntries(Object.entries(p.choices).filter(([, c]) => c?.trim())) : null;
  return {no: p.no ?? i + 1, text: p.text, ...(img ? {img} : {}), kind: p.kind, ...(choices && Object.keys(choices).length ? {choices} : {})};
}

/** A new quiz, waiting for the students to join (the last one's players, answers and scores cleared). */
export async function startLive(t: Topic, pids: string[], dur: number, classes?: Record<string, true>) {
  await update(ref(db), {
    live: {tid: t.id, title: t.title.slice(0, 80), pids, cur: 0, state: 'lobby', qStart: 0, dur, startedAt: serverTimestamp(), ...(classes && Object.keys(classes).length ? {classes} : {})},
    livePlayers: null,
    liveAnswers: null,
    liveScores: null,
  });
}

/** Question `i` on the board, its time running from now. */
export async function openQuestion(t: Topic, quiz: LiveQuiz, i: number) {
  const q = await questionOf(t, quiz.pids[i]);
  await update(ref(db, 'live'), {cur: i, state: 'q', q, key: null, revealed: null, qStart: serverTimestamp()});
}

/**
 * Time's up (or everyone answered): the right answer shown and the points added, in one write. Only once per question,
 * even with the board open on two devices (`live/revealed` is taken first).
 */
export async function revealQuestion(quiz: LiveQuiz) {
  const cur = quiz.cur;
  const lock = await runTransaction(ref(db, 'live/revealed'), (v) => (v === cur ? undefined : cur));
  if (!lock.committed) return;
  const key = await readKey(quiz.tid, quiz.pids[cur]);
  const [answers, players, scores] = await Promise.all(
    [`liveAnswers/${cur}`, 'livePlayers', 'liveScores'].map((p) => get(ref(db, p)).then((s) => (s.val() ?? {}) as Record<string, unknown>)),
  );
  const ops: Record<string, unknown> = {'live/state': 'reveal', 'live/key': key ?? ''};
  for (const uid of Object.keys(players)) {
    const a = answers[uid] as {a: string; at: number} | undefined;
    const ok = !!a && verdict(a.a, key, null) === true;
    const last = a ? points(ok, a.at - quiz.qStart, quiz.dur) : 0;
    ops[`liveScores/${uid}`] = {score: ((scores[uid] as LiveScore | undefined)?.score ?? 0) + last, last, ok, q: cur};
  }
  await update(ref(db), ops);
}

export const finishLive = () => set(ref(db, 'live/state'), 'done');
/** The quiz taken off (players, answers and scores too). */
export const closeLive = () => update(ref(db), {live: null, livePlayers: null, liveAnswers: null, liveScores: null});

/** The ranking: score, then who joined first. */
export function ranking(players: LivePlayer[], scores: Record<string, LiveScore>) {
  return players.map((p) => ({...p, score: scores[p.uid]?.score ?? 0, last: scores[p.uid]?.last ?? 0, ok: !!scores[p.uid]?.ok})).sort((a, b) => b.score - a.score || a.at - b.at);
}

export const LIVE_COLORS: Record<Letter, string> = {A: 'bg-red-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-green-500', E: 'bg-violet-500'};
