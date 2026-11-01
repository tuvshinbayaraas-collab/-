// Topics ("Сэдэв"): a lesson (text with $math$, pictures, videos) and problems the teacher writes in the dashboard.
//   topics/{tid}              title, intro, published, classes (none = every class), order, lesson[], problems[]
//   topicImages/{tid}/{iid}   pictures as data URLs, loaded only when shown
//   topicKeys/{tid}/{pid}     the right answer ("A"…"E", or a short written answer), teacher only
//   topicProgress/{uid}/{tid}/{pid} = {a, at}   a student's first answer; only after it is written may they read that
//                             problem's key (the rules check), so the first try is honest and the teacher sees it.
//                             A problem without a key takes an answer too: it goes to the teacher to check.
//   topicMarks/{uid}/{tid}/{pid} = {ok, at, note?}   the teacher's word on an answer (right or wrong, a note): for a
//                             problem without a key, or instead of the key's (a written answer put another way).
//   topicWork/{uid}/{tid}/{pid} = {img, at}   a photo of the student's working, sent with the answer (or added while
//                             the teacher hasn't checked it yet); the answer then carries `w: true` (its text may
//                             be empty), so the teacher's page knows there is one without loading every photo.
import {get, onValue, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {auth, db} from './firebase';
import {useLive} from './live';
import {loadImage} from './photo';

/** A part of the lesson: text, a picture, or a video (a YouTube, Google Drive… link). */
export type Block = {t: 'text'; text: string} | {t: 'img'; img: string} | {t: 'vid'; url: string};

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
  /** A video explanation (a link), shown with the solution. */
  vid?: string;
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
    lesson: asArray<Block>(v.lesson).filter((b) => (b.t === 'text' && typeof b.text === 'string') || (b.t === 'img' && typeof b.img === 'string') || (b.t === 'vid' && typeof b.url === 'string')),
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
export async function compress(file: File) {
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

const clean = (s?: string) => (s?.trim() ? s.trim() : null);
/** A problem as stored: every field set (null for none; the database refuses undefined). */
const stored = (p: Problem, keyed: boolean) => ({
  id: p.id,
  text: p.text.trim(),
  img: p.img ?? null,
  kind: p.kind,
  choices: p.kind === 'choice' && p.choices && Object.values(p.choices).some((c) => c?.trim()) ? Object.fromEntries(Object.entries(p.choices).filter(([, c]) => c?.trim())) : null,
  sol: clean(p.sol),
  solImg: p.solImg ?? null,
  vid: clean(p.vid),
  k: keyed,
  no: typeof p.no === 'number' && p.no > 0 ? Math.round(p.no) : null,
});

/** The topic, its keys, and the pictures no longer used (gone) in one write. */
export function saveTopic(t: Topic, keys: Record<string, string>, gone: string[]) {
  return update(ref(db), {
    [`topics/${t.id}`]: {
      title: t.title.trim().slice(0, 80) || 'Нэргүй сэдэв',
      intro: clean(t.intro),
      published: t.published,
      classes: t.classes && Object.keys(t.classes).length ? t.classes : null,
      order: t.order,
      createdAt: t.createdAt,
      lesson: t.lesson.filter((b) => (b.t === 'text' ? b.text.trim() : b.t === 'img' ? b.img : b.url.trim())).map((b) => (b.t === 'text' ? {t: 'text', text: b.text.trim()} : b.t === 'vid' ? {t: 'vid', url: b.url.trim()} : b)),
      problems: t.problems.map((p) => stored(p, !!keys[p.id])),
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
    lesson: t.lesson.flatMap((b): Block[] => (b.t !== 'img' ? [b] : img(b.img) ? [{t: 'img', img: img(b.img)!}] : [])),
    problems: t.problems.map((p) => ({...stored(p, !!keys[p.id]), id: pids.get(p.id)!, img: img(p.img), solImg: img(p.solImg)})),
  };
  ops[`topicKeys/${id}`] = Object.fromEntries(Object.entries(keys).flatMap(([pid, k]) => (pids.has(pid) && k ? [[pids.get(pid)!, k]] : [])));
  await update(ref(db), ops);
  return id;
}

/** The topic with its pictures and keys, and (for these students) their answers, the teacher's marks, their photos. */
export const deleteTopic = (tid: string, uids: string[] = []) =>
  update(ref(db), {
    [`topics/${tid}`]: null,
    [`topicKeys/${tid}`]: null,
    [`topicImages/${tid}`]: null,
    ...Object.fromEntries(uids.flatMap((uid) => [`topicProgress/${uid}/${tid}`, `topicMarks/${uid}/${tid}`, `topicWork/${uid}/${tid}`].map((k) => [k, null]))),
  });

export const setTopicOrder = (a: Topic, b: Topic) => update(ref(db), {[`topics/${a.id}/order`]: b.order, [`topics/${b.id}/order`]: a.order});

export const resetProgress = (uid: string, tid: string) => update(ref(db), {[`topicProgress/${uid}/${tid}`]: null, [`topicMarks/${uid}/${tid}`]: null, [`topicWork/${uid}/${tid}`]: null});

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

/** tid → pid → the first answer (`w`: a photo of the working came with it). */
export type Progress = Record<string, Record<string, {a: string; at: number; w?: boolean}>>;

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

/** Everyone's answers, for the teacher (`on` false: not read). */
export function useAllProgress(on = true) {
  const [p, setP] = useState<Record<string, Progress> | null>(null);
  useEffect(
    () =>
      on
        ? onValue(
            ref(db, 'topicProgress'),
            (s) => setP((s.val() ?? {}) as Record<string, Progress>),
            () => setP({}),
          )
        : undefined,
    [on],
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

/** Every student's marks (uid → tid → pid), for the teacher (`on` false: not read). */
export function useAllMarks(on = true) {
  const [m, setM] = useState<Record<string, Marks> | null>(null);
  useEffect(
    () =>
      on
        ? onValue(
            ref(db, 'topicMarks'),
            (s) => setM((s.val() ?? {}) as Record<string, Marks>),
            () => setM({}),
          )
        : undefined,
    [on],
  );
  return m;
}

/** Every topic's keys, for the teacher (`on` false: not read). */
export const useAllTopicKeys = (on = true) => useLive(on ? 'topicKeys' : null, (v) => (v ?? {}) as Record<string, Record<string, string>>);

/**
 * Marks these students' answers to a problem right or wrong (null takes the mark back). A note given (empty to take it
 * off) replaces each one's; none given (a whole group marked at once) keeps the notes they have.
 */
export function setMarks(uids: string[], tid: string, pid: string, ok: boolean | null, note?: string) {
  const ops: Record<string, unknown> = {};
  for (const uid of uids) {
    const at = `topicMarks/${uid}/${tid}/${pid}`;
    if (ok === null) {
      ops[at] = null;
      continue;
    }
    ops[`${at}/ok`] = ok;
    ops[`${at}/at`] = serverTimestamp();
    if (note !== undefined) ops[`${at}/note`] = note.trim() ? note.trim().slice(0, 300) : null;
  }
  return update(ref(db), ops);
}

/**
 * How an answer went: the teacher's mark first, else against the key (an answer sent before the key was given is
 * compared as written answers are); null while it waits for the teacher.
 */
export const verdict = (a: string | undefined, key: string | null | undefined, mark?: Mark | null) => (mark ? mark.ok : key ? a === key || (a !== undefined && normalize(a) === key) : null);

/** Records the student's first answer, then reads the key (allowed only now). */
export async function answer(tid: string, pid: string, a: string, work?: File) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  if (!work) await set(ref(db, `topicProgress/${uid}/${tid}/${pid}`), {a, at: serverTimestamp()});
  else {
    // The photo and the answer in one write: neither without the other.
    const img = await compress(work);
    await update(ref(db), {
      [`topicWork/${uid}/${tid}/${pid}`]: {img, at: serverTimestamp()},
      [`topicProgress/${uid}/${tid}/${pid}`]: {a, at: serverTimestamp(), w: true},
    });
    works.set(`${uid}/${tid}/${pid}`, Promise.resolve(img));
  }
  return readKey(tid, pid);
}

/** A photo of the working added to an answer already sent (or put in place of the one sent), while it waits for the teacher. */
export async function sendWork(tid: string, pid: string, file: File) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Нэвтэрнэ үү');
  const img = await compress(file);
  await update(ref(db), {[`topicWork/${uid}/${tid}/${pid}`]: {img, at: serverTimestamp()}, [`topicProgress/${uid}/${tid}/${pid}/w`]: true});
  const p = Promise.resolve(img);
  works.set(`${uid}/${tid}/${pid}`, p);
  workListeners.forEach((l) => l());
  return img;
}

const works = new Map<string, Promise<string | null>>();
const workListeners = new Set<() => void>();
/** A student's photo of their working (theirs, or anyone's for the teacher): undefined while loading, null if none. */
export function useWork(uid: string | undefined, tid: string, pid: string) {
  const k = `${uid}/${tid}/${pid}`;
  const [state, setState] = useState<{k: string; v: string | null} | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((n) => n + 1);
    workListeners.add(bump);
    return () => void workListeners.delete(bump);
  }, []);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    if (!works.has(k))
      works.set(
        k,
        get(ref(db, `topicWork/${k}/img`)).then(
          (s) => (typeof s.val() === 'string' ? s.val() : null),
          () => null,
        ),
      );
    works.get(k)!.then((v) => live && setState({k, v}));
    return () => {
      live = false;
    };
  }, [k, uid, version]);
  return state?.k === k ? state.v : undefined;
}

const keyCache = new Map<string, string | null>();
/** One problem's key: the teacher may always read it, a student once they have answered. */
export async function readKey(tid: string, pid: string) {
  const k = `${tid}/${pid}`;
  if (keyCache.has(k)) return keyCache.get(k)!;
  const v = (await get(ref(db, `topicKeys/${k}`))).val();
  const key = typeof v === 'string' ? v : null;
  // "No key" isn't kept: the teacher may give one while the page is open.
  if (key !== null) keyCache.set(k, key);
  return key;
}
