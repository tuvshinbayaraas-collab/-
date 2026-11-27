// «Видео» (the teacher's dashboard) and «Видео хичээл» (/videos, for students): video lessons kept by link (YouTube,
// Google Drive, Vimeo: the video itself stays there, nothing of it is stored here), in folders the teacher publishes.
// A video can have points in it to jump to («3:20 Дискриминант») and a few problems under it, copied from the bank,
// to check it was understood. Students mark the ones they have watched; the teacher sees who has.
//   videoFolders/{fid} = {name, at, published? (true: open to students)}
//   videos/{fid}/{vid} = {title, url, note?, at, marks? [{t (seconds), label}], problems? {pid: {text, img?, kind,
//                         choices?, no?}}}: students read a published folder's
//   videoKeys/{fid}/{vid}/{pid} = a problem's right answer: a student reads it once they have answered it
//   videoAnswers/{uid}/{pid} = {a, at, fid, vid}: a student's answer, once
//   videoWatched/{uid}/{vid} = when they marked it watched (taken back by removing it)
import {equalTo, get, onValue, orderByChild, push, query, ref, remove, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import type {BankProblem} from './bank';
import {db} from './firebase';
import {useLive} from './live';
import {LETTER_CODES, type Letter, type Problem} from './topics';

export interface VideoFolder {
  id: string;
  name: string;
  at: number;
  published: boolean;
}
export interface VideoMark {
  /** Seconds from the start. */
  t: number;
  label: string;
}
export interface VideoProblem {
  id: string;
  text: string;
  img?: string;
  kind: Problem['kind'];
  choices?: Partial<Record<Letter, string>>;
  no?: number;
}
export interface Video {
  id: string;
  folder: string;
  title: string;
  url: string;
  note: string;
  at: number;
  marks: VideoMark[];
  problems: VideoProblem[];
}

export const MAX_TITLE = 120;
export const MAX_NOTE = 1000;
export const MAX_MARKS = 30;
export const MAX_PROBLEMS = 20;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const parseFolders = (v: unknown): VideoFolder[] =>
  Object.entries((v ?? {}) as Record<string, {name?: unknown; at?: unknown; published?: unknown}>)
    .flatMap(([id, f]) => (f && typeof f.name === 'string' ? [{id, name: f.name, at: num(f.at), published: f.published === true}] : []))
    .sort((a, b) => a.name.localeCompare(b.name, 'mn', {numeric: true}));

function parseVideo(folder: string, id: string, v: unknown): Video | null {
  const x = v as Record<string, unknown> | null;
  if (!x || typeof x.title !== 'string' || typeof x.url !== 'string') return null;
  const marks = (Array.isArray(x.marks) ? x.marks : Object.values((x.marks ?? {}) as object))
    .flatMap((m) => (m && typeof m.t === 'number' && typeof m.label === 'string' ? [{t: m.t, label: m.label}] : []))
    .sort((a, b) => a.t - b.t);
  // In the order they were linked (ids made one by one come in order).
  const problems = Object.entries((x.problems ?? {}) as Record<string, Record<string, unknown>>)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .flatMap(([pid, p]) => {
      if (!p || typeof p.text !== 'string') return [];
      const c = (p.choices ?? {}) as Record<string, unknown>;
      const choices = Object.fromEntries(LETTER_CODES.filter((k) => typeof c[k] === 'string').map((k) => [k, c[k] as string]));
      return [{id: pid, text: p.text, img: str(p.img) || undefined, kind: p.kind === 'answer' ? ('answer' as const) : ('choice' as const), ...(Object.keys(choices).length ? {choices} : {}), no: num(p.no) || undefined}];
    });
  return {id, folder, title: x.title, url: x.url, note: str(x.note), at: num(x.at), marks, problems};
}
const parseVideos = (folder: string) => (v: unknown) =>
  Object.entries((v ?? {}) as Record<string, unknown>)
    .flatMap(([id, x]) => parseVideo(folder, id, x) ?? [])
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));

/** Every folder (the teacher's). */
export const useVideoFolders = (on = true) => useLive(on ? 'videoFolders' : null, parseFolders);

/** The folders open to students (all a student may read of them). */
export function usePublishedVideoFolders(on = true) {
  const [state, setState] = useState<VideoFolder[] | null>(null);
  useEffect(() => {
    if (!on) return;
    return onValue(
      query(ref(db, 'videoFolders'), orderByChild('published'), equalTo(true)),
      (s) => setState(parseFolders(s.val())),
      () => setState([]),
    );
  }, [on]);
  return state;
}

/** A folder's videos, as added. */
export const useVideos = (fid: string | null) => useLive(fid ? `videos/${fid}` : null, parseVideos(fid ?? ''));

/** Every video's right answers in a folder (the teacher's): video id → problem id → answer. */
export const useVideoKeys = (fid: string | null) => useLive(fid ? `videoKeys/${fid}` : null, (v) => (v ?? {}) as Record<string, Record<string, string>>);

/** Who has watched what: the student's own, or (`uid` null, the teacher) everyone's: uid → video id → when. */
export const useWatched = (uid: string | null | undefined) =>
  useLive(uid === undefined ? null : uid ? `videoWatched/${uid}` : 'videoWatched', (v) => (v ?? {}) as Record<string, unknown>);

/** A student's answers to videos' problems: problem id → answer. */
export const useVideoAnswers = (uid: string | null) => useLive(uid ? `videoAnswers/${uid}` : null, (v) => (v ?? {}) as Record<string, {a: string; at: number}>);

// ---- the teacher's

export const addVideoFolder = async (name: string) => {
  const id = push(ref(db, 'videoFolders')).key!;
  await set(ref(db, `videoFolders/${id}`), {name: name.trim().slice(0, 80), at: serverTimestamp()});
  return id;
};
export const renameVideoFolder = (f: VideoFolder, name: string) => set(ref(db, `videoFolders/${f.id}/name`), name.trim().slice(0, 80));
export const publishVideoFolder = (f: VideoFolder, on: boolean) => set(ref(db, `videoFolders/${f.id}/published`), on ? true : null);
/** A folder with its videos, their right answers, and the answers and watch marks are left (their videos are gone). */
export const deleteVideoFolder = (f: VideoFolder) => update(ref(db), {[`videoFolders/${f.id}`]: null, [`videos/${f.id}`]: null, [`videoKeys/${f.id}`]: null});

export interface VideoDraft {
  title: string;
  url: string;
  note: string;
  marks: VideoMark[];
}
const cleanDraft = (d: VideoDraft) => ({
  title: d.title.trim().slice(0, MAX_TITLE),
  url: d.url.trim().slice(0, 500),
  note: d.note.trim().slice(0, MAX_NOTE) || null,
  marks: d.marks.length
    ? d.marks
        .filter((m) => m.label.trim())
        .slice(0, MAX_MARKS)
        .sort((a, b) => a.t - b.t)
        .map((m) => ({t: Math.max(0, Math.min(86400, Math.round(m.t))), label: m.label.trim().slice(0, 80)}))
    : null,
});
export async function addVideo(fid: string, d: VideoDraft) {
  const id = push(ref(db, `videos/${fid}`)).key!;
  await set(ref(db, `videos/${fid}/${id}`), {...cleanDraft(d), at: serverTimestamp()});
  return id;
}
/** Its title, link, note and points (its problems stay). */
export const saveVideo = (v: Video, d: VideoDraft) => {
  const c = cleanDraft(d);
  return update(ref(db, `videos/${v.folder}/${v.id}`), {title: c.title, url: c.url, note: c.note, marks: c.marks && c.marks.length ? c.marks : null});
};
export const deleteVideo = (v: Video) => update(ref(db), {[`videos/${v.folder}/${v.id}`]: null, [`videoKeys/${v.folder}/${v.id}`]: null});

/** A video moved one place up or down in its folder (the order is by when added: the two trade theirs). */
export function moveVideo(list: Video[], i: number, by: -1 | 1) {
  const a = list[i];
  const b = list[i + by];
  if (!a || !b) return Promise.resolve();
  // Two added in one go can have the same time: then the moved one goes just past the other.
  const [ta, tb] = a.at === b.at ? [b.at + by, a.at] : [b.at, a.at];
  return update(ref(db), {[`videos/${a.folder}/${a.id}/at`]: ta, [`videos/${b.folder}/${b.id}/at`]: tb});
}

/** Bank problems put under a video: copied (their pictures stay in the bank), with their right answers. */
export function linkProblems(v: Video, ps: BankProblem[]) {
  const ops: Record<string, unknown> = {};
  for (const p of ps.slice(0, Math.max(0, MAX_PROBLEMS - v.problems.length))) {
    const id = push(ref(db, `videos/${v.folder}/${v.id}/problems`)).key!;
    const choices = p.choices && Object.values(p.choices).some(Boolean) ? p.choices : null;
    ops[`videos/${v.folder}/${v.id}/problems/${id}`] = {text: p.text, img: p.img ?? null, kind: p.kind, choices, no: p.no ?? null};
    if (p.key) ops[`videoKeys/${v.folder}/${v.id}/${id}`] = p.key;
  }
  return update(ref(db), ops);
}
export const unlinkProblem = (v: Video, pid: string) => update(ref(db), {[`videos/${v.folder}/${v.id}/problems/${pid}`]: null, [`videoKeys/${v.folder}/${v.id}/${pid}`]: null});

// ---- the student's

export const markWatched = (uid: string, v: Pick<Video, 'id'>, on: boolean) => (on ? set(ref(db, `videoWatched/${uid}/${v.id}`), serverTimestamp()) : remove(ref(db, `videoWatched/${uid}/${v.id}`)));

/** A problem's right answer, once the student has answered it (null: none given). */
export const videoKey = (v: Pick<Video, 'folder' | 'id'>, pid: string) =>
  get(ref(db, `videoKeys/${v.folder}/${v.id}/${pid}`)).then(
    (s) => (typeof s.val() === 'string' ? (s.val() as string) : null),
    () => null,
  );
/** The student's answer (once), and then the right one. */
export async function answerVideo(uid: string, v: Pick<Video, 'folder' | 'id'>, pid: string, a: string) {
  await set(ref(db, `videoAnswers/${uid}/${pid}`), {a: a.slice(0, 300), at: serverTimestamp(), fid: v.folder, vid: v.id});
  return videoKey(v, pid);
}

/** «3:20», «1:02:05», «95» (seconds) as seconds; null when it isn't a time. */
export function parseTime(s: string): number | null {
  const m = /^\s*(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\s*$/.exec(s) ?? /^\s*()()(\d{1,5})\s*$/.exec(s);
  if (!m) return null;
  const [h, mi, se] = [Number(m[1] || 0), Number(m[2] || 0), Number(m[3])];
  if (m[2] && se >= 60) return null;
  return h * 3600 + mi * 60 + se;
}
export const timeLabel = (t: number) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
