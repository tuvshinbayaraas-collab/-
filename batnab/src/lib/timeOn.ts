// How long a student spends on a topic's problems and on a test's questions, for the teacher only: the rules let the
// student add to it (and never take away), not read it, and nothing of it is shown to them.
//   timeOn/{uid}/p{topicId}               {all, q: {problemId: s}, at}   the topic's page, and each problem until answered
//   timeOn/{uid}/t{testId}_{started}      {all, q: {questionIndex: s}, at, rid?}   one attempt at a test; `rid`: its result
// Seconds; `at`: the last time added to. Time counts while the page is in view and used (5 minutes without a touch,
// a key or a scroll still count: working on paper). A problem's time is from the last touch on any problem to the touch
// on it (picking a choice, typing, «Шалгах»): reading and working it out; a long stretch without a touch, or one cut by
// leaving, goes to the problems on screen as they were read. A topic problem's counts only until it is answered.
import {increment, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useRef} from 'react';
import {db} from './firebase';
import {useLive} from './live';

export interface TimeOn {
  all: number;
  q: Record<string, number>;
  at: number;
  rid?: string;
}

/** Time is stored this often (and when the student goes to another page of the site). */
const FLUSH = 15_000;
/** No touch, key or scroll for this long: not working on it any more. */
const IDLE = 5 * 60_000;

export const topicTimeKey = (tid: string) => `p${tid}`;
export const testTimeKey = (test: string, started: number) => `t${test}_${started}`;

/** One item on the page: its card, its key under `q`, and whether its time still counts (a topic problem: until answered). */
export interface TimeItem {
  el: Element | null;
  key: string;
  open: boolean;
}

// Time not stored yet when the page hides (another app, the screen off, the page closing or reloading) is kept on the
// device, not sent then: a write from a page closing may never get out, and whether it did can't be known. It goes
// with the next write of that page (shown again, opened again), or of another page with time counted.
const STASH = 'batnab.timeOn.';
type Pending = {all: number; q: Record<string, number>};

function stash(path: string, p: Pending) {
  if (p.all <= 0 && !Object.keys(p.q).length) return;
  try {
    const old = (JSON.parse(localStorage.getItem(STASH + path) ?? 'null') as Pending | null) ?? {all: 0, q: {}};
    for (const [k, ms] of Object.entries(p.q)) old.q[k] = (old.q[k] ?? 0) + ms;
    localStorage.setItem(STASH + path, JSON.stringify({all: old.all + p.all, q: old.q}));
  } catch {
    // storage blocked: that bit of time is not counted
  }
}

function unstash(path: string): Pending | null {
  try {
    const v = JSON.parse(localStorage.getItem(STASH + path) ?? 'null') as Pending | null;
    localStorage.removeItem(STASH + path);
    return v && typeof v.all === 'number' && v.q && typeof v.q === 'object' ? v : null;
  } catch {
    return null;
  }
}

/** Adds the whole seconds of `p` to the record at `path` (the rest stays in `p`); false: nothing to add. */
function send(path: string, p: Pending) {
  const ops: Record<string, unknown> = {};
  // The rules take at most 300 seconds a write (more is a mistake, not time).
  const whole = (ms: number) => Math.min(300, Math.floor(ms / 1000));
  const all = whole(p.all);
  if (all > 0) ops.all = increment(all);
  p.all -= all * 1000;
  for (const [k, ms] of Object.entries(p.q)) {
    const n = whole(ms);
    if (n > 0) ops[`q/${k}`] = increment(n);
    // What's left (under a second, or over the 300) goes with the next write.
    p.q[k] = ms - n * 1000;
    if (p.q[k] <= 0) delete p.q[k];
  }
  if (!Object.keys(ops).length) return false;
  ops.at = serverTimestamp();
  update(ref(db, path), ops).catch(() => {});
  return true;
}

/** Sends the time kept on this device for the student's other pages. */
function sendStashed(uid: string, except: string) {
  try {
    const paths = Object.keys(localStorage)
      .filter((k) => k.startsWith(`${STASH}timeOn/${uid}/`))
      .map((k) => k.slice(STASH.length))
      .filter((p) => p !== except);
    for (const p of paths) {
      const v = unstash(p);
      if (v) send(p, v);
    }
  } catch {
    // storage blocked
  }
}

/**
 * Counts the time on the page (`path`: timeOn/{uid}/{key}; null: not counted) and on the item being worked on.
 * `items` is read on every tick, so it can be a new function each render.
 */
export function useTimeOn(path: string | null, items: () => TimeItem[]) {
  const list = useRef(items);
  list.current = items;
  useEffect(() => {
    if (!path) return;
    sendStashed(path.split('/')[1], path);
    // Counted, not stored yet (with what was kept on the device for this page).
    const p: Pending = unstash(path) ?? {all: 0, q: {}};
    // Since the last touch on an item: the time, and how much of it each item was being read. A short stretch goes to
    // the next item touched (a choice picked, an answer typed, «Шалгах»: it was read and worked out); a long one (10
    // seconds without a touch, by the next time it is stored) or one cut by leaving the page goes to the items read.
    let since = 0;
    let read: Record<string, number> = {};
    let last = performance.now();
    let active = last;
    let touched = last;
    // The item being read (none on screen: the lesson), as of the last second (the page may be gone when it is left).
    let seen: TimeItem | undefined;
    // The item across the reading line (a third of the way down), or the nearest to it.
    const reading = () => {
      const line = innerHeight / 3;
      const gap = (r: DOMRect) => (r.top <= line && r.bottom >= line ? 0 : Math.min(Math.abs(r.top - line), Math.abs(r.bottom - line)));
      return list
        .current()
        .flatMap((i) => {
          const r = i.el?.getBoundingClientRect();
          return r && r.height > 0 && r.bottom > 0 && r.top < innerHeight ? [{i, d: gap(r)}] : [];
        })
        .sort((x, y) => x.d - y.d)[0]?.i;
    };
    const tick = (look = false) => {
      const now = performance.now();
      const dt = Math.min(now - last, 5000);
      last = now;
      if (document.visibilityState !== 'visible' || now - active > IDLE) return;
      if (look) seen = reading();
      p.all += dt;
      since += dt;
      if (seen?.open) read[seen.key] = (read[seen.key] ?? 0) + dt;
    };
    const add = (k: string, ms: number) => (p.q[k] = (p.q[k] ?? 0) + ms);
    // The stretch to the item touched (none: an item answered already, its solution being read), or to the items read.
    const settle = (to?: TimeItem) => {
      if (to) {
        if (to.open) add(to.key, since);
      } else for (const [k, ms] of Object.entries(read)) add(k, ms);
      since = 0;
      read = {};
    };
    const wake = () => {
      tick();
      active = performance.now();
    };
    const touch = (e: Event) => {
      wake();
      const it = list.current().find((i) => i.el && e.target instanceof Node && i.el.contains(e.target));
      if (!it) return;
      touched = performance.now();
      settle(it);
    };
    const flush = (leaving = false) => {
      tick();
      if (leaving || performance.now() - touched > 10_000) settle();
      send(path, p);
    };
    // Hidden: what isn't stored yet is kept on the device; shown again, it is taken back to be stored with the rest.
    let kept = false;
    const keep = () => {
      if (kept) return;
      tick();
      settle();
      stash(path, {all: p.all, q: {...p.q}});
      p.all = 0;
      p.q = {};
      kept = true;
    };
    const shown = () => {
      if (document.visibilityState === 'hidden') return keep();
      if (!kept) return;
      kept = false;
      last = performance.now();
      const back = unstash(path);
      if (back) {
        p.all += back.all;
        for (const [k, ms] of Object.entries(back.q)) add(k, ms);
      }
    };
    const every = () => document.visibilityState === 'visible' && flush();
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart', 'pointermove'] as const;
    for (const e of events) addEventListener(e, e === 'pointerdown' || e === 'touchstart' || e === 'keydown' ? touch : wake, {passive: true, capture: true});
    document.addEventListener('visibilitychange', shown);
    addEventListener('pagehide', keep);
    const ticker = setInterval(() => tick(true), 1000);
    const flusher = setInterval(every, FLUSH);
    return () => {
      clearInterval(ticker);
      clearInterval(flusher);
      for (const e of events) removeEventListener(e, e === 'pointerdown' || e === 'touchstart' || e === 'keydown' ? touch : wake, {capture: true});
      document.removeEventListener('visibilitychange', shown);
      removeEventListener('pagehide', keep);
      // Another page of the site (this one still open): stored now; hidden meanwhile, it is kept on the device.
      if (kept) return;
      flush(true);
    };
  }, [path]);
}

/** Ties a test attempt's time to the result it became. */
export const timeResult = (uid: string, key: string, rid: string) => set(ref(db, `timeOn/${uid}/${key}/rid`), rid).catch(() => {});

const parse = (v: unknown): TimeOn | null => {
  const x = v as Partial<TimeOn> | null;
  if (!x || typeof x !== 'object') return null;
  const q = Object.fromEntries(Object.entries(x.q ?? {}).filter(([, s]) => typeof s === 'number')) as Record<string, number>;
  return {all: Number(x.all) || 0, q, at: Number(x.at) || 0, ...(typeof x.rid === 'string' ? {rid: x.rid} : {})};
};

/** Everyone's time (uid → key → time), for the teacher (`on` false: not read). */
export const useAllTimeOn = (on = true) =>
  useLive(on ? 'timeOn' : null, (v) =>
    Object.fromEntries(
      Object.entries((v ?? {}) as Record<string, Record<string, unknown>>).map(([uid, byKey]) => [
        uid,
        Object.fromEntries(Object.entries(byKey ?? {}).flatMap(([k, t]) => (parse(t) ? [[k, parse(t)!]] : []))),
      ]),
    ) as Record<string, Record<string, TimeOn>>,
  );

/** A test attempt's time: the one tied to result `rid`, else the attempt that started closest to `started` (ms). */
export function attemptTime(mine: Record<string, TimeOn> | undefined, test: string, rid: string | undefined, started: number) {
  const tries = Object.entries(mine ?? {}).filter(([k]) => k.startsWith(`t${test}_`));
  const tied = rid && tries.find(([, t]) => t.rid === rid);
  if (tied) return tied[1];
  const near = tries
    .map(([k, t]) => ({t, d: Math.abs(Number(k.slice(k.indexOf('_') + 1)) - started)}))
    .filter((x) => x.d < 15 * 60_000)
    .sort((a, b) => a.d - b.d)[0];
  return near?.t ?? null;
}

/** "1 цаг 5 мин", "12 мин 30 сек", "40 сек". */
export function timeText(s: number) {
  s = Math.round(s);
  if (s < 60) return `${s} сек`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} цаг${m ? ` ${m} мин` : ''}`;
  const r = s % 60;
  return `${m} мин${r && m < 10 ? ` ${r} сек` : ''}`;
}
