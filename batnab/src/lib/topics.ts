// Topics ("Сэдэв"): a lesson (text with $math$ and pictures) and problems the teacher writes in the dashboard.
//   topics/{tid}              title, intro, published, classes (none = every class), order, lesson[], problems[]
//   topicImages/{tid}/{iid}   pictures as data URLs, loaded only when shown
//   topicKeys/{tid}/{pid}     the right answer ("A"…"E", or a short written answer), teacher only
//   topicProgress/{uid}/{tid}/{pid} = {a, at}   a student's first answer; only after it is written may they read that
//                             problem's key (the rules check), so the first try is honest and the teacher sees it.
//                             A problem without a key takes an answer too: it goes to the teacher to check.
//   topicMarks/{uid}/{tid}/{pid} = {ok, at, note?}   the teacher's word on an answer (right or wrong, a note): for a
//                             problem without a key, or instead of the key's (a written answer put another way).
import {get, onValue, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {auth, db} from './firebase';
import {loadImage} from './photo';

export type Block = {t: 'text'; text: string} | {t: 'img'; img: string};

export interface Problem {
  id: string;
  /** The question, with $math$. */
  text: string;
  img?: string;
  /** "choice": А–Д buttons (texts optional, e.g. when the picture shows them); "answer": the student writes it. */
  kind: 'choice' | 'answer';
  choices?: Partial<Record<Letter, string>>;
  /** How to solve it, shown after answering. */
  sol?: string;
  solImg?: string;
  /** Whether the teacher has set the right answer (the answer itself is in topicKeys); without it the teacher checks. */
  k?: boolean;
  /** Its number in the book ("18." printed on its picture); the problems are still in the topic's order. */
  no?: number;
}

/** The number a problem goes by: the book's, or its place in the topic. */
export const problemNo = (p: Problem, i: number) => p.no ?? i + 1;

export const LETTER_CODES = ['A', 'B', 'C', 'D', 'E'] as const;
export type Letter = (typeof LETTER_CODES)[number];
export const LETTER_LABELS: Record<Letter, string> = {A: 'А', B: 'Б', C: 'В', D: 'Г', E: 'Д'};

export interface Topic {
  id: string;
  title: string;
  intro?: string;
  published: boolean;
  /** Classes that see it; none = every class. */
  classes?: Record<string, true>;
  order: number;
  createdAt: number;
  lesson: Block[];
  problems: Problem[];
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? v.filter(Boolean) : v && typeof v === 'object' ? Object.values(v) : []) as T[];

function parse(id: string, v: Partial<Topic> | null): Topic | null {
  if (!v || typeof v.title !== 'string') return null;
  return {
    id,
    title: v.title,
    intro: typeof v.intro === 'string' ? v.intro : undefined,
    published: v.published === true,
    classes: v.classes && typeof v.classes === 'object' ? v.classes : undefined,
    order: typeof v.order === 'number' ? v.order : (v.createdAt ?? 0),
    createdAt: typeof v.createdAt === 'number' ? v.createdAt : 0,
    lesson: asArray<Block>(v.lesson).filter((b) => (b.t === 'text' && typeof b.text === 'string') || (b.t === 'img' && typeof b.img === 'string')),
    problems: asArray<Problem>(v.problems).filter((p) => typeof p.id === 'string'),
  };
}

let topics: Topic[] | null = null;
const listeners = new Set<() => void>();
let started = false;
function start() {
  if (started) return;
  started = true;
  onValue(
    ref(db, 'topics'),
    (s) => {
      const v = (s.val() ?? {}) as Record<string, Partial<Topic>>;
      topics = Object.entries(v)
        .flatMap(([id, t]) => parse(id, t) ?? [])
        .sort((a, b) => a.order - b.order);
      listeners.forEach((l) => l());
    },
    () => {
      topics = [];
      listeners.forEach((l) => l());
    },
  );
}

/** Every topic the reader may see (the teacher: all, drafts too), in the teacher's order; null while loading. */
export const useTopics = () =>
  useSyncExternalStore(
    (l) => {
      start();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => topics,
  );

/** Whether a student of `classId` sees the topic. */
export const forClassOf = (t: Topic, classId: string | undefined) => t.published && (!t.classes || !Object.keys(t.classes).length || (!!classId && !!t.classes[classId]));

// ---- pictures ----

const images = new Map<string, Promise<string | null>>();
/** A topic picture (data URL), fetched once per visit. */
export function useTopicImage(tid: string, iid: string | undefined) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!iid) return;
    let live = true;
    const key = `${tid}/${iid}`;
    if (!images.has(key))
      images.set(
        key,
        get(ref(db, `topicImages/${key}`)).then(
          (s) => (typeof s.val() === 'string' ? s.val() : null),
          () => {
            images.delete(key);
            return null;
          },
        ),
      );
    images.get(key)!.then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [tid, iid]);
  return iid ? url : null;
}

/** A picture made small enough for the database (at most ~330 KB): the smaller of PNG (diagrams) and JPEG (photos). */
async function compress(file: File) {
  const img = await loadImage(file);
  try {
    // As sharp as fits (up to 2000 px), so a page of text can still be read when zoomed in.
    let scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    for (let i = 0; i < 7; i++) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      const png = c.toDataURL('image/png');
      const jpg = c.toDataURL('image/jpeg', 0.82);
      const best = png.length < jpg.length ? png : jpg;
      if (best.length <= 450000) return best;
      scale *= 0.75;
    }
    throw new Error('Зураг хэт том байна. Жижиг зураг сонгоно уу.');
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/** Stores a picture for the topic and returns its id (the topic itself is saved separately). */
export async function uploadTopicImage(tid: string, file: File) {
  const url = await compress(file);
  const iid = push(ref(db, `topicImages/${tid}`)).key!;
  await set(ref(db, `topicImages/${tid}/${iid}`), url);
  images.set(`${tid}/${iid}`, Promise.resolve(url));
  return iid;
}

export const imagesOf = (t: Pick<Topic, 'lesson' | 'problems'>) =>
  new Set([...t.lesson.flatMap((b) => (b.t === 'img' ? [b.img] : [])), ...t.problems.flatMap((p) => [p.img, p.solImg].filter((x): x is string => !!x))]);

// ---- the teacher ----

export const newId = () => push(ref(db, 'topics')).key!;

export async function createTopic(order: number) {
  const id = newId();
  await set(ref(db, `topics/${id}`), {title: 'Шинэ сэдэв', published: false, order, createdAt: serverTimestamp()});
  return id;
}

/** The topic, its keys, and the pictures no longer used (gone) in one write. */
export function saveTopic(t: Topic, keys: Record<string, string>, gone: string[]) {
  const clean = (s?: string) => (s?.trim() ? s.trim() : null);
  return update(ref(db), {
    [`topics/${t.id}`]: {
      title: t.title.trim().slice(0, 80) || 'Нэргүй сэдэв',
      intro: clean(t.intro),
      published: t.published,
      classes: t.classes && Object.keys(t.classes).length ? t.classes : null,
      order: t.order,
      createdAt: t.createdAt,
      lesson: t.lesson.filter((b) => (b.t === 'text' ? b.text.trim() : b.img)).map((b) => (b.t === 'text' ? {t: 'text', text: b.text.trim()} : b)),
      problems: t.problems.map((p) => ({
        id: p.id,
        text: p.text.trim(),
        img: p.img ?? null,
        kind: p.kind,
        choices: p.kind === 'choice' && p.choices && Object.values(p.choices).some((c) => c?.trim()) ? Object.fromEntries(Object.entries(p.choices).filter(([, c]) => c?.trim())) : null,
        sol: clean(p.sol),
        solImg: p.solImg ?? null,
        k: !!keys[p.id],
        no: typeof p.no === 'number' && p.no > 0 ? Math.round(p.no) : null,
      })),
    },
    [`topicKeys/${t.id}`]: Object.fromEntries(Object.entries(keys).filter(([pid, k]) => k && t.problems.some((p) => p.id === pid))),
    ...Object.fromEntries(gone.map((iid) => [`topicImages/${t.id}/${iid}`, null])),
  });
}

/** A copy of the topic (a draft, its pictures and answers too) for another class; returns the new id. */
export async function copyTopic(t: Topic, keys: Record<string, string>, order: number) {
  const id = newId();
  const ops: Record<string, unknown> = {};
  const map = new Map<string, string>();
  for (const iid of imagesOf(t)) {
    const url = (await get(ref(db, `topicImages/${t.id}/${iid}`))).val();
    if (typeof url !== 'string') continue;
    const nid = push(ref(db, `topicImages/${id}`)).key!;
    map.set(iid, nid);
    ops[`topicImages/${id}/${nid}`] = url;
  }
  const img = (i?: string) => (i ? (map.get(i) ?? null) : null);
  const pids = new Map(t.problems.map((p) => [p.id, newId()]));
  ops[`topics/${id}`] = {
    title: `${t.title} (хуулбар)`.slice(0, 80),
    intro: t.intro ?? null,
    published: false,
    classes: null,
    order,
    createdAt: serverTimestamp(),
    lesson: t.lesson.flatMap((b): Block[] => (b.t === 'text' ? [b] : img(b.img) ? [{t: 'img', img: img(b.img)!}] : [])),
    problems: t.problems.map((p) => ({...p, id: pids.get(p.id)!, img: img(p.img), solImg: img(p.solImg), choices: p.choices ?? null, sol: p.sol ?? null})),
  };
  ops[`topicKeys/${id}`] = Object.fromEntries(Object.entries(keys).flatMap(([pid, k]) => (pids.has(pid) && k ? [[pids.get(pid)!, k]] : [])));
  await update(ref(db), ops);
  return id;
}

export const deleteTopic = (tid: string) => update(ref(db), {[`topics/${tid}`]: null, [`topicKeys/${tid}`]: null, [`topicImages/${tid}`]: null});

export const setTopicOrder = (a: Topic, b: Topic) => update(ref(db), {[`topics/${a.id}/order`]: b.order, [`topics/${b.id}/order`]: a.order});

export const resetProgress = (uid: string, tid: string) => update(ref(db), {[`topicProgress/${uid}/${tid}`]: null, [`topicMarks/${uid}/${tid}`]: null});

/** The teacher's copy of a topic's keys; null while loading. */
export function useTopicKeys(tid: string) {
  const [keys, setKeys] = useState<Record<string, string> | null>(null);
  useEffect(
    () =>
      onValue(
        ref(db, `topicKeys/${tid}`),
        (s) => setKeys((s.val() ?? {}) as Record<string, string>),
        () => setKeys({}),
      ),
    [tid],
  );
  return keys;
}

// ---- answers ----

/** Written answers are compared without spaces or case, with "," and "." the same. */
export const normalize = (a: string) => a.trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.').slice(0, 40);

export type Progress = Record<string, Record<string, {a: string; at: number}>>;

/** A student's answers in every topic (topicProgress/{uid}); null while loading. */
export function useProgress(uid: string | undefined) {
  const [p, setP] = useState<Progress | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onValue(
      ref(db, `topicProgress/${uid}`),
      (s) => setP((s.val() ?? {}) as Progress),
      () => setP({}),
    );
  }, [uid]);
  return uid ? p : {};
}

/** Everyone's answers, for the teacher. */
export function useAllProgress() {
  const [p, setP] = useState<Record<string, Progress> | null>(null);
  useEffect(
    () =>
      onValue(
        ref(db, 'topicProgress'),
        (s) => setP((s.val() ?? {}) as Record<string, Progress>),
        () => setP({}),
      ),
    [],
  );
  return p;
}

// ---- the teacher's checking ----

export interface Mark {
  ok: boolean;
  at: number;
  note?: string;
}
/** tid → pid → mark. */
export type Marks = Record<string, Record<string, Mark>>;

/** The teacher's marks on a student's answers; null while loading. */
export function useMarks(uid: string | undefined) {
  const [m, setM] = useState<Marks | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onValue(
      ref(db, `topicMarks/${uid}`),
      (s) => setM((s.val() ?? {}) as Marks),
      () => setM({}),
    );
  }, [uid]);
  return uid ? m : {};
}

/** Every student's marks (uid → tid → pid), for the teacher. */
export function useAllMarks() {
  const [m, setM] = useState<Record<string, Marks> | null>(null);
  useEffect(
    () =>
      onValue(
        ref(db, 'topicMarks'),
        (s) => setM((s.val() ?? {}) as Record<string, Marks>),
        () => setM({}),
      ),
    [],
  );
  return m;
}

/** Marks these students' answers to a problem right or wrong (null takes the mark back), with a note. */
export function setMarks(uids: string[], tid: string, pid: string, ok: boolean | null, note?: string) {
  const mark = ok === null ? null : {ok, at: serverTimestamp(), ...(note?.trim() ? {note: note.trim().slice(0, 300)} : {})};
  return update(ref(db), Object.fromEntries(uids.map((uid) => [`topicMarks/${uid}/${tid}/${pid}`, mark])));
}

/**
 * How an answer went: the teacher's mark first, else against the key (an answer sent before the key was given is
 * compared as written answers are); null while it waits for the teacher.
 */
export const verdict = (a: string | undefined, key: string | null | undefined, mark?: Mark | null) => (mark ? mark.ok : key ? a === key || (a !== undefined && normalize(a) === key) : null);

/** Records the student's first answer, then reads the key (allowed only now). */
export async function answer(tid: string, pid: string, a: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  await set(ref(db, `topicProgress/${uid}/${tid}/${pid}`), {a, at: serverTimestamp()});
  return readKey(tid, pid);
}

const keyCache = new Map<string, string | null>();
/** One problem's key: the teacher may always read it, a student once they have answered. */
export async function readKey(tid: string, pid: string) {
  const k = `${tid}/${pid}`;
  if (keyCache.has(k)) return keyCache.get(k)!;
  const v = (await get(ref(db, `topicKeys/${k}`))).val();
  const key = typeof v === 'string' ? v : null;
  keyCache.set(k, key);
  return key;
}
