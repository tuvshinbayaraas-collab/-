// The problem bank («Бодлого» in the teacher's dashboard, «Бодлогын сан» for students): problems kept in folders (folders
// in folders too), cut from photographed pages or PDFs (by the agent or on the device), and taken into a topic when
// needed («Сангаас нэмэх» in the topic editor copies them, pictures and right answers with them). The teacher writes it;
// a folder the teacher publishes is open to students, who solve its problems.
//   bankFolders/{fid} = {name, parent ('' at the top), at, published? (true: open to students)}
//   bankProblems/{fid}/{pid} = {text, img? (bankImages id), kind: 'choice' | 'answer', choices? {A–E}, no? (its number
//                              in the book), at}: students read a published folder's
//   bankKeys/{fid}/{pid} = the right answer (a letter code, or the written answer): a student reads it only once they
//                          have answered (an older problem may still carry it as bankProblems/…/key: moved here)
//   bankAnswers/{uid}/{pid} = {a, at, fid}: a student's answer, once
//   bankImages/{iid} = a picture (data URL), as topicImages holds them
import {equalTo, get, onValue, orderByChild, push, query, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {db} from './firebase';
import {useLive} from './live';
import {compress, LETTER_CODES, type Letter, type Problem} from './topics';

export interface BankFolder {
  id: string;
  name: string;
  parent: string;
  at: number;
  /** Open to students. */
  published: boolean;
}

export interface BankProblem {
  id: string;
  folder: string;
  text: string;
  img?: string;
  kind: Problem['kind'];
  choices?: Partial<Record<Letter, string>>;
  key?: string;
  /** Still kept in the problem itself (from before keys had their own place): moved out when seen. */
  oldKey?: boolean;
  no?: number;
  at: number;
}

export const MAX_NAME = 80;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const parseFolders = (v: unknown): BankFolder[] =>
  Object.entries((v ?? {}) as Record<string, {name?: unknown; parent?: unknown; at?: unknown; published?: unknown}>)
    .flatMap(([id, f]) => (f && typeof f.name === 'string' ? [{id, name: f.name, parent: str(f.parent), at: num(f.at), published: f.published === true}] : []))
    .sort((a, b) => a.name.localeCompare(b.name, 'mn', {numeric: true}));

/** Every folder, by name (the teacher's). */
export const useBankFolders = (on = true) => useLive(on ? 'bankFolders' : null, parseFolders);

function parseProblem(folder: string, id: string, v: unknown, key?: unknown): BankProblem | null {
  const p = v as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || typeof p.text !== 'string') return null;
  const c = (p.choices ?? {}) as Record<string, unknown>;
  const choices = Object.fromEntries(LETTER_CODES.filter((k) => typeof c[k] === 'string').map((k) => [k, c[k] as string]));
  return {
    id,
    folder,
    text: p.text,
    img: str(p.img) || undefined,
    kind: p.kind === 'answer' ? 'answer' : 'choice',
    ...(Object.keys(choices).length ? {choices} : {}),
    key: str(key) || str(p.key) || undefined,
    ...(str(p.key) ? {oldKey: true} : {}),
    no: num(p.no) || undefined,
    at: num(p.at),
  };
}

// As added: page after page, each in the book's order (ids made in one go come in order). Not by number: a test's second
// part numbered from 1 again (2.1, 2.2, … as 1, 2, …) would land among the first part's.
const inOrder = (a: BankProblem, b: BankProblem) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Every folder's problems with their right answers: folder id → its problems, in the book's order (then as added). */
export function useBankProblems(on = true) {
  const raw = useLive(on ? 'bankProblems' : null, (v) => (v ?? {}) as Record<string, Record<string, unknown>>);
  const keys = useLive(on ? 'bankKeys' : null, (v) => (v ?? {}) as Record<string, Record<string, unknown>>);
  if (!raw || !keys) return null;
  return Object.fromEntries(
    Object.entries(raw).map(([fid, ps]) => [
      fid,
      Object.entries(ps ?? {})
        .flatMap(([pid, p]) => parseProblem(fid, pid, p, keys[fid]?.[pid]) ?? [])
        .sort(inOrder),
    ]),
  ) as Record<string, BankProblem[]>;
}

/**
 * Right answers still kept in the problems (from before they had their own place, where students can't read them):
 * moved to bankKeys, in one write. Done before a folder is published, and whenever the teacher opens the bank.
 */
export function moveOldKeys(ps: BankProblem[]) {
  const ops: Record<string, unknown> = {};
  for (const p of ps)
    if (p.oldKey) {
      ops[`bankKeys/${p.folder}/${p.id}`] = p.key ?? null;
      ops[`bankProblems/${p.folder}/${p.id}/key`] = null;
    }
  return Object.keys(ops).length ? update(ref(db), ops) : Promise.resolve();
}

/** A folder opened to students, or closed again (its problems' old right answers moved out of reach first). */
export const setPublished = (folder: BankFolder, ps: BankProblem[], on: boolean) =>
  moveOldKeys(ps).then(() => set(ref(db, `bankFolders/${folder.id}/published`), on ? true : null));

/** The folders inside `fid`, every level down (for counting and deleting). */
export function within(folders: BankFolder[], fid: string): BankFolder[] {
  const kids = folders.filter((f) => f.parent === fid);
  return kids.flatMap((k) => [k, ...within(folders, k.id)]);
}

/** The way from the top to `fid`: its folder, its folder's folder… */
export function pathTo(folders: BankFolder[], fid: string) {
  const out: BankFolder[] = [];
  for (let f = folders.find((x) => x.id === fid); f && out.length < 30; f = folders.find((x) => x.id === f!.parent)) out.unshift(f);
  return out;
}

export async function addFolder(name: string, parent: string) {
  const id = push(ref(db, 'bankFolders')).key!;
  await set(ref(db, `bankFolders/${id}`), {name: name.trim().slice(0, MAX_NAME), parent, at: serverTimestamp()});
  return id;
}

export const renameFolder = (fid: string, name: string) => set(ref(db, `bankFolders/${fid}/name`), name.trim().slice(0, MAX_NAME));

/** A folder with everything in it (its folders, their problems and pictures), in one write. */
export function deleteFolder(folders: BankFolder[], problems: Record<string, BankProblem[]>, fid: string) {
  const gone = [fid, ...within(folders, fid).map((f) => f.id)];
  const ops: Record<string, null> = {};
  for (const id of gone) {
    ops[`bankFolders/${id}`] = null;
    ops[`bankProblems/${id}`] = null;
    ops[`bankKeys/${id}`] = null;
    for (const p of problems[id] ?? []) if (p.img) ops[`bankImages/${p.img}`] = null;
  }
  return update(ref(db), ops);
}

/** A picture into the bank; returns its id. */
export async function uploadBankImage(file: File) {
  const url = await compress(file);
  const iid = push(ref(db, 'bankImages')).key!;
  await set(ref(db, `bankImages/${iid}`), url);
  images.set(iid, Promise.resolve(url));
  return iid;
}

/** Problems cut from a page, with their right answers, into a folder. */
export function addProblems(fid: string, ps: Problem[], keys: Record<string, string>) {
  const ops: Record<string, unknown> = {};
  for (const p of ps) {
    const choices = p.choices && Object.values(p.choices).some(Boolean) ? p.choices : null;
    ops[`bankProblems/${fid}/${p.id}`] = {text: p.text, img: p.img ?? null, kind: p.kind, choices, no: p.no ?? null, at: serverTimestamp()};
    if (keys[p.id]) ops[`bankKeys/${fid}/${p.id}`] = keys[p.id];
  }
  return update(ref(db), ops);
}

export const setKey = (p: BankProblem, key: string) => update(ref(db), {[`bankKeys/${p.folder}/${p.id}`]: key || null, ...(p.oldKey ? {[`bankProblems/${p.folder}/${p.id}/key`]: null} : {})});
export const setKind = (p: BankProblem, kind: Problem['kind']) =>
  update(ref(db), {[`bankProblems/${p.folder}/${p.id}/kind`]: kind, [`bankProblems/${p.folder}/${p.id}/key`]: null, [`bankKeys/${p.folder}/${p.id}`]: null});

/** Problems moved to another folder (their pictures stay where they are). */
export function moveProblems(ps: BankProblem[], to: string) {
  const ops: Record<string, unknown> = {};
  for (const p of ps) {
    if (p.folder === to) continue;
    ops[`bankProblems/${p.folder}/${p.id}`] = null;
    ops[`bankKeys/${p.folder}/${p.id}`] = null;
    ops[`bankProblems/${to}/${p.id}`] = {text: p.text, img: p.img ?? null, kind: p.kind, choices: p.choices ?? null, no: p.no ?? null, at: p.at || serverTimestamp()};
    ops[`bankKeys/${to}/${p.id}`] = p.key ?? null;
  }
  return update(ref(db), ops);
}

export function deleteProblems(ps: BankProblem[]) {
  const ops: Record<string, null> = {};
  for (const p of ps) {
    ops[`bankProblems/${p.folder}/${p.id}`] = null;
    ops[`bankKeys/${p.folder}/${p.id}`] = null;
    if (p.img) ops[`bankImages/${p.img}`] = null;
  }
  return update(ref(db), ops);
}

const images = new Map<string, Promise<string | null>>();
/** A bank picture, fetched once per visit. */
export function bankImage(iid: string) {
  if (!images.has(iid))
    images.set(
      iid,
      get(ref(db, `bankImages/${iid}`)).then(
        (s) => (typeof s.val() === 'string' ? s.val() : null),
        () => {
          images.delete(iid);
          return null;
        },
      ),
    );
  return images.get(iid)!;
}

export function useBankImage(iid: string | undefined) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!iid) return;
    let live = true;
    void bankImage(iid).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [iid]);
  return iid ? url : null;
}

/**
 * Bank problems as a topic's: new ids, their pictures copied into the topic's (so the topic never depends on the bank),
 * their right answers as the topic's answers. `onUploaded` hears of each picture copied (the editor deletes those the
 * topic ends up not using).
 */
export async function toTopic(tid: string, ps: BankProblem[], newId: () => string, onUploaded: (iid: string) => void) {
  const out: Problem[] = [];
  const keys: Record<string, string> = {};
  for (const p of ps) {
    let img: string | undefined;
    if (p.img) {
      const url = await bankImage(p.img);
      if (!url) throw new Error(`${p.no ?? ''}-р бодлогын зураг олдсонгүй.`.trim());
      img = push(ref(db, `topicImages/${tid}`)).key!;
      await set(ref(db, `topicImages/${tid}/${img}`), url);
      onUploaded(img);
    }
    const id = newId();
    out.push({id, text: p.text, kind: p.kind, ...(img ? {img} : {}), ...(p.choices ? {choices: p.choices} : {}), ...(p.no ? {no: p.no} : {})});
    if (p.key) keys[id] = p.key;
  }
  return {problems: out, keys};
}

// ---- students: the published folders, their problems, their answers ----

/** The folders open to students (only these can be read), every one of whose folders above is open too. */
export function usePublishedFolders(on = true) {
  const [state, setState] = useState<{folders: BankFolder[]} | null>(null);
  useEffect(() => {
    if (!on) return;
    return onValue(
      query(ref(db, 'bankFolders'), orderByChild('published'), equalTo(true)),
      (s) => {
        const all = parseFolders(s.val());
        const open = new Set(all.map((f) => f.id));
        // A folder shows when the way to it is open all along.
        const shown = (f: BankFolder): boolean => !f.parent || (open.has(f.parent) && shown(all.find((x) => x.id === f.parent)!));
        setState({folders: all.filter(shown)});
      },
      () => setState({folders: []}),
    );
  }, [on]);
  return state?.folders ?? null;
}

/** One open folder's problems, in the book's order (no right answers: those come after answering). */
export const useFolderProblems = (fid: string | null) =>
  useLive(fid ? `bankProblems/${fid}` : null, (v) =>
    Object.entries((v ?? {}) as Record<string, unknown>)
      .flatMap(([pid, p]) => parseProblem(fid!, pid, p) ?? [])
      .map((p) => ({...p, key: undefined, oldKey: undefined}))
      .sort(inOrder),
  );

export interface BankAnswer {
  a: string;
  at: number;
  fid: string;
}

/** A student's answers in the bank: problem id → answer. */
export const useBankAnswers = (uid: string | null | undefined) =>
  useLive(uid ? `bankAnswers/${uid}` : null, (v) =>
    Object.fromEntries(
      Object.entries((v ?? {}) as Record<string, {a?: unknown; at?: unknown; fid?: unknown} | null>).flatMap(([pid, x]) =>
        x && typeof x.a === 'string' ? [[pid, {a: x.a, at: num(x.at), fid: str(x.fid)}]] : [],
      ),
    ) as Record<string, BankAnswer>,
  );

/** A student answers a problem (once), then reads its right answer: null when the teacher hasn't given one. */
export async function answerBank(uid: string, p: BankProblem, a: string) {
  await set(ref(db, `bankAnswers/${uid}/${p.id}`), {a: a.slice(0, 300), at: serverTimestamp(), fid: p.folder});
  return bankKey(p);
}

/** A problem's right answer, once the student has answered it (null: none given). */
export const bankKey = (p: Pick<BankProblem, 'folder' | 'id'>) =>
  get(ref(db, `bankKeys/${p.folder}/${p.id}`)).then(
    (s) => (typeof s.val() === 'string' ? (s.val() as string) : null),
    () => null,
  );
