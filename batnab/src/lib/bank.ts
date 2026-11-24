// The teacher's problem bank («Бодлого» in the teacher's dashboard): problems kept in folders (folders in folders too),
// cut from photographed pages or PDFs (by the agent or on the device), and taken into a topic when needed («Сангаас
// нэмэх» in the topic editor copies them, pictures and right answers with them). Only the teacher reads or writes it.
//   bankFolders/{fid} = {name, parent ('' at the top), at}
//   bankProblems/{fid}/{pid} = {text, img? (bankImages id), kind: 'choice' | 'answer', choices? {A–E}, key? (the right
//                              answer: a letter code, or the written answer), no? (its number in the book), at}
//   bankImages/{iid} = a picture (data URL), as topicImages holds them
import {get, push, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {db} from './firebase';
import {useLive} from './live';
import {compress, LETTER_CODES, type Letter, type Problem} from './topics';

export interface BankFolder {
  id: string;
  name: string;
  parent: string;
  at: number;
}

export interface BankProblem {
  id: string;
  folder: string;
  text: string;
  img?: string;
  kind: Problem['kind'];
  choices?: Partial<Record<Letter, string>>;
  key?: string;
  no?: number;
  at: number;
}

export const MAX_NAME = 80;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Every folder, by name. */
export const useBankFolders = (on = true) =>
  useLive(on ? 'bankFolders' : null, (v) =>
    Object.entries((v ?? {}) as Record<string, {name?: unknown; parent?: unknown; at?: unknown}>)
      .flatMap(([id, f]) => (f && typeof f.name === 'string' ? [{id, name: f.name, parent: str(f.parent), at: num(f.at)}] : []))
      .sort((a, b) => a.name.localeCompare(b.name, 'mn', {numeric: true})),
  );

function parseProblem(folder: string, id: string, v: unknown): BankProblem | null {
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
    key: str(p.key) || undefined,
    no: num(p.no) || undefined,
    at: num(p.at),
  };
}

/** Every folder's problems: folder id → its problems, in the book's order (then as added). */
export const useBankProblems = (on = true) =>
  useLive(on ? 'bankProblems' : null, (v) =>
    Object.fromEntries(
      Object.entries((v ?? {}) as Record<string, Record<string, unknown>>).map(([fid, ps]) => [
        fid,
        Object.entries(ps ?? {})
          .flatMap(([pid, p]) => parseProblem(fid, pid, p) ?? [])
          .sort((a, b) => (a.no ?? 1e9) - (b.no ?? 1e9) || a.at - b.at),
      ]),
    ) as Record<string, BankProblem[]>,
  );

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
    ops[`bankProblems/${fid}/${p.id}`] = {text: p.text, img: p.img ?? null, kind: p.kind, choices, key: keys[p.id] || null, no: p.no ?? null, at: serverTimestamp()};
  }
  return update(ref(db), ops);
}

export const setKey = (p: BankProblem, key: string) => set(ref(db, `bankProblems/${p.folder}/${p.id}/key`), key || null);
export const setKind = (p: BankProblem, kind: Problem['kind']) => update(ref(db, `bankProblems/${p.folder}/${p.id}`), {kind, key: null});

/** Problems moved to another folder (their pictures stay where they are). */
export function moveProblems(ps: BankProblem[], to: string) {
  const ops: Record<string, unknown> = {};
  for (const p of ps) {
    if (p.folder === to) continue;
    ops[`bankProblems/${p.folder}/${p.id}`] = null;
    ops[`bankProblems/${to}/${p.id}`] = {text: p.text, img: p.img ?? null, kind: p.kind, choices: p.choices ?? null, key: p.key ?? null, no: p.no ?? null, at: p.at || serverTimestamp()};
  }
  return update(ref(db), ops);
}

export function deleteProblems(ps: BankProblem[]) {
  const ops: Record<string, null> = {};
  for (const p of ps) {
    ops[`bankProblems/${p.folder}/${p.id}`] = null;
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
