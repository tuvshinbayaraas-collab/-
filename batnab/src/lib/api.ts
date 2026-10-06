import {
  get,
  limitToLast,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
  equalTo,
} from 'firebase/database';
import {deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable} from 'firebase/storage';
import {displayName} from './auth';
import {auth, db, storage} from './firebase';
import type {Comment, Reaction, Video} from './types';

const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  avi: 'video/x-msvideo',
  '3gp': 'video/3gpp',
};

function rows<T>(snapshot: {forEach: (cb: (child: {key: string | null; val: () => unknown}) => void) => void}): T[] {
  const out: T[] = [];
  snapshot.forEach((child) => {
    out.push({...(child.val() as object), id: child.key} as T);
  });
  return out;
}

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('Эхлээд нэвтэрнэ үү');
  return user;
}

async function listAll(): Promise<Video[]> {
  const snap = await get(query(ref(db, 'videos'), orderByChild('createdAt'), limitToLast(500)));
  return rows<Video>(snap).reverse();
}

export const api = {
  list: async ({q}: {q?: string} = {}) => {
    const videos = await listAll();
    if (!q) return videos;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return videos.filter((v) => {
      const hay = `${v.title} ${v.description ?? ''} ${v.channel}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  },

  byChannel: async (uid: string) => {
    const snap = await get(query(ref(db, 'videos'), orderByChild('uid'), equalTo(uid)));
    return rows<Video>(snap).sort((a, b) => b.createdAt - a.createdAt);
  },

  byIds: async (ids: string[]) => {
    const snaps = await Promise.all(ids.map((id) => get(ref(db, `videos/${id}`))));
    return snaps.filter((s) => s.exists()).map((s) => ({...s.val(), id: s.key}) as Video);
  },

  get: async (id: string) => {
    const snap = await get(ref(db, `videos/${id}`));
    if (!snap.exists()) throw new Error('Бичлэг олдсонгүй');
    return {...snap.val(), id} as Video;
  },

  view: async (id: string) => {
    const res = await runTransaction(ref(db, `videos/${id}/views`), (v: number | null) => (v ?? 0) + 1);
    return res.snapshot.val() as number;
  },

  reactions: async (id: string) => {
    const snap = await get(ref(db, `reactions/${id}`));
    let likes = 0;
    let dislikes = 0;
    snap.forEach((c) => {
      if (c.val() === 'like') likes++;
      else if (c.val() === 'dislike') dislikes++;
    });
    const uid = auth.currentUser?.uid;
    const mine = (uid && (snap.child(uid).val() as Reaction)) || null;
    return {likes, dislikes, mine};
  },

  react: async (id: string, reaction: Reaction) => {
    const user = requireUser();
    await update(ref(db), {
      [`reactions/${id}/${user.uid}`]: reaction,
      [`userLikes/${user.uid}/${id}`]: reaction === 'like' ? Date.now() : null,
    });
  },

  likedIds: async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const snap = await get(ref(db, `userLikes/${user.uid}`));
    const entries: Array<[string, number]> = [];
    snap.forEach((c) => {
      entries.push([c.key!, c.val() as number]);
    });
    return entries.sort((a, b) => b[1] - a[1]).map(([id]) => id);
  },

  comments: async (id: string) => {
    const snap = await get(query(ref(db, `comments/${id}`), orderByChild('createdAt')));
    return rows<Comment>(snap).reverse();
  },

  comment: async (id: string, text: string) => {
    const user = requireUser();
    const node = push(ref(db, `comments/${id}`));
    const comment = {
      uid: user.uid,
      author: displayName(user),
      ...(user.photoURL ? {photo: user.photoURL} : {}),
      text: text.trim().slice(0, 2000),
      createdAt: serverTimestamp(),
    };
    await set(node, comment);
    return {...comment, id: node.key!, createdAt: Date.now()} as Comment;
  },

  deleteComment: (videoId: string, commentId: string) => set(ref(db, `comments/${videoId}/${commentId}`), null),

  upload: async (
    input: {file: File; thumbnail: Blob | null; title: string; description: string; duration: number},
    onProgress: (fraction: number) => void,
  ) => {
    const user = requireUser();
    const id = push(ref(db, 'videos')).key!;
    const ext = (input.file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'mp4').toLowerCase();
    const base = `videos/${user.uid}/${id}`;
    const videoPath = `${base}/video.${ext}`;
    const thumbPath = `${base}/thumb.jpg`;
    const contentType = input.file.type.startsWith('video/') ? input.file.type : (VIDEO_TYPES[ext] ?? 'video/mp4');

    const thumbSize = input.thumbnail?.size ?? 0;
    const total = input.file.size + thumbSize;
    let thumbDone = 0;

    const uploaded: string[] = [];
    try {
      let thumbnailUrl: string | undefined;
      if (input.thumbnail) {
        const task = uploadBytesResumable(storageRef(storage, thumbPath), input.thumbnail, {
          contentType: input.thumbnail.type || 'image/jpeg',
        });
        task.on('state_changed', (s) => onProgress(s.bytesTransferred / total));
        await task;
        uploaded.push(thumbPath);
        thumbDone = thumbSize;
        thumbnailUrl = await getDownloadURL(storageRef(storage, thumbPath));
      }

      const task = uploadBytesResumable(storageRef(storage, videoPath), input.file, {contentType});
      task.on('state_changed', (s) => onProgress((thumbDone + s.bytesTransferred) / total));
      await task;
      uploaded.push(videoPath);
      const videoUrl = await getDownloadURL(storageRef(storage, videoPath));

      await set(ref(db, `videos/${id}`), {
        uid: user.uid,
        title: input.title.trim().slice(0, 120),
        description: input.description.trim().slice(0, 5000),
        channel: displayName(user),
        ...(user.photoURL ? {channelPhoto: user.photoURL} : {}),
        videoUrl,
        videoPath,
        ...(thumbnailUrl ? {thumbnailUrl, thumbPath} : {}),
        duration: Math.max(0, Math.round(input.duration || 0)),
        views: 0,
        createdAt: serverTimestamp(),
      });
      return id;
    } catch (e) {
      await Promise.all(uploaded.map((p) => deleteObject(storageRef(storage, p)).catch(() => {})));
      throw e;
    }
  },

  remove: async (video: Video) => {
    await update(ref(db), {
      [`videos/${video.id}`]: null,
      [`comments/${video.id}`]: null,
      [`reactions/${video.id}`]: null,
    });
    const paths = [video.videoPath, video.thumbPath].filter(Boolean) as string[];
    await Promise.all(paths.map((p) => deleteObject(storageRef(storage, p)).catch(() => {})));
  },
};

export function errorMessage(e: unknown): string {
  const code = (e as {code?: string})?.code ?? '';
  if (code.includes('permission-denied') || code.includes('unauthorized') || /permission/i.test(String(e)))
    return 'Зөвшөөрөлгүй үйлдэл байна';
  if (code === 'storage/quota-exceeded') return 'Хадгалах сангийн хэмжээ хэтэрсэн байна';
  if (code === 'storage/canceled') return 'Цуцлагдлаа';
  if (code.includes('network') || code === 'storage/retry-limit-exceeded') return 'Сүлжээний алдаа гарлаа';
  return (e as Error)?.message || 'Алдаа гарлаа';
}
