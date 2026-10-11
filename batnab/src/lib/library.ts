// "Watch later" and playlists, both stored per user:
//   watchLater/{uid}/{videoId}: addedAt
//   playlists/{uid}/{playlistId}: {title, description?, ownerName, ownerPhoto?, visibility, createdAt,
//                                  updatedAt, items: {videoId: addedAt}}
import {get, push, ref, remove, serverTimestamp, set, update} from 'firebase/database';
import {api} from './api';
import {displayName} from './auth';
import {auth, db} from './firebase';
import type {Video, Visibility} from './types';

export const WATCH_LATER = 'WL';

export interface Playlist {
  id: string;
  uid: string;
  title: string;
  description?: string;
  ownerName: string;
  ownerPhoto?: string;
  visibility: Visibility;
  createdAt: number;
  updatedAt?: number;
  /** videoId -> addedAt */
  items: Record<string, number>;
}

function me() {
  const user = auth.currentUser;
  if (!user) throw new Error('Эхлээд нэвтэрнэ үү');
  return user.uid;
}

/** Video ids ordered oldest-added first (playlist order). */
export const orderedIds = (items: Record<string, number> = {}) =>
  Object.entries(items)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);

/** `list=` query value for a playlist: "WL" or "<uid>.<playlistId>". */
/** Link that plays a video in the context of a playlist (shorts open in the Shorts feed). */
export const playHref = (v: Video, list: string) =>
  v.short ? `/shorts/${v.id}` : `/watch?v=${v.id}&list=${encodeURIComponent(list)}`;

export const listParam = (p: {uid: string; id: string} | typeof WATCH_LATER) => (p === WATCH_LATER ? p : `${p.uid}.${p.id}`);

export const watchLater = {
  ids: async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const snap = await get(ref(db, `watchLater/${uid}`));
    return orderedIds((snap.val() as Record<string, number>) ?? {});
  },
  has: async (videoId: string) => {
    const uid = auth.currentUser?.uid;
    return !!uid && (await get(ref(db, `watchLater/${uid}/${videoId}`))).exists();
  },
  set: (videoId: string, on: boolean) => set(ref(db, `watchLater/${me()}/${videoId}`), on ? Date.now() : null),
};

export const playlists = {
  mine: async (): Promise<Playlist[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const snap = await get(ref(db, `playlists/${uid}`));
    const out: Playlist[] = [];
    snap.forEach((c) => {
      const v = c.val() as Omit<Playlist, 'id' | 'uid'>;
      out.push({...v, items: v.items ?? {}, id: c.key!, uid});
    });
    return out.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  },

  get: async (uid: string, id: string): Promise<Playlist> => {
    const snap = await get(ref(db, `playlists/${uid}/${id}`));
    if (!snap.exists()) throw new Error('Жагсаалт олдсонгүй');
    const v = snap.val() as Omit<Playlist, 'id' | 'uid'>;
    return {...v, items: v.items ?? {}, id, uid};
  },

  create: async (title: string, visibility: Visibility, firstVideoId?: string) => {
    const uid = me();
    const user = auth.currentUser!;
    const node = push(ref(db, `playlists/${uid}`));
    await set(node, {
      title: title.trim().slice(0, 100),
      ownerName: displayName(user),
      ...(user.photoURL ? {ownerPhoto: user.photoURL} : {}),
      visibility,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(firstVideoId ? {items: {[firstVideoId]: Date.now()}} : {}),
    });
    return node.key!;
  },

  setItem: (playlistId: string, videoId: string, on: boolean) => {
    const uid = me();
    return update(ref(db, `playlists/${uid}/${playlistId}`), {
      [`items/${videoId}`]: on ? Date.now() : null,
      updatedAt: serverTimestamp(),
    });
  },

  edit: (playlistId: string, changes: {title: string; description: string; visibility: Visibility}) =>
    update(ref(db, `playlists/${me()}/${playlistId}`), {
      title: changes.title.trim().slice(0, 100),
      description: changes.description.trim().slice(0, 500) || null,
      visibility: changes.visibility,
      updatedAt: serverTimestamp(),
    }),

  remove: (playlistId: string) => remove(ref(db, `playlists/${me()}/${playlistId}`)),
};

export interface LoadedPlaylist {
  list: string;
  title: string;
  description?: string;
  ownerUid: string;
  ownerName: string;
  ownerPhoto?: string;
  visibility: Visibility;
  isWatchLater: boolean;
  videos: Video[];
  playlist?: Playlist;
}

/** Resolve a `list=` value ("WL" or "<uid>.<playlistId>") to its title and playable videos, in order. */
export async function loadPlaylist(list: string): Promise<LoadedPlaylist> {
  if (list === WATCH_LATER) {
    const user = auth.currentUser;
    if (!user) throw new Error('«Дараа үзэх» жагсаалтаа харахын тулд нэвтэрнэ үү');
    const videos = await api.byIds(await watchLater.ids());
    return {
      list,
      title: 'Дараа үзэх',
      ownerUid: user.uid,
      ownerName: displayName(user),
      ownerPhoto: user.photoURL ?? undefined,
      visibility: 'private',
      isWatchLater: true,
      videos,
    };
  }
  const [uid, id] = list.split('.');
  if (!uid || !id) throw new Error('Жагсаалт олдсонгүй');
  const playlist = await playlists.get(uid, id).catch(() => {
    throw new Error('Жагсаалт олдсонгүй эсвэл хувийн байна');
  });
  const videos = await api.byIds(orderedIds(playlist.items));
  return {
    list,
    title: playlist.title,
    description: playlist.description,
    ownerUid: uid,
    ownerName: playlist.ownerName,
    ownerPhoto: playlist.ownerPhoto,
    visibility: playlist.visibility,
    isWatchLater: false,
    videos,
    playlist,
  };
}
