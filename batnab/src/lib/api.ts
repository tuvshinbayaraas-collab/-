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
import {displayName} from './auth';
import {deleteFile, ensureFolder, getDriveToken, makePublic, uploadFile} from './drive';
import {auth, db} from './firebase';
import type {Comment, CommentThread, Reaction, Subscription, Video, VideoStats} from './types';

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

/** Local calendar day as YYYYMMDD — the key for daily view counters. */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
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
    // Counters only accept +1, so read the current value first: a blind transaction that guesses
    // 0 is rejected by the rules instead of being retried.
    const bump = async (path: string) => {
      const node = ref(db, path);
      await get(node);
      return runTransaction(node, (v: number | null) => (v ?? 0) + 1);
    };
    const [res] = await Promise.all([bump(`videos/${id}/views`), bump(`viewsDaily/${id}/${dayKey()}`).catch(() => {})]);
    return res.snapshot.val() as number;
  },

  shorts: async () => (await listAll()).filter((v) => v.short),

  // ---------- Subscriptions ----------

  subscriberCount: async (channelUid: string) => {
    const snap = await get(ref(db, `subscribers/${channelUid}`));
    return snap.size;
  },

  isSubscribed: async (channelUid: string) => {
    const user = auth.currentUser;
    if (!user) return false;
    return (await get(ref(db, `subscriptions/${user.uid}/${channelUid}`))).exists();
  },

  subscribe: async (channel: {uid: string; name: string; photo?: string}, on: boolean) => {
    const user = requireUser();
    if (channel.uid === user.uid) throw new Error('Өөрийн сувгийг захиалах боломжгүй');
    await update(ref(db), {
      [`subscriptions/${user.uid}/${channel.uid}`]: on
        ? {name: channel.name.slice(0, 50), ...(channel.photo ? {photo: channel.photo} : {}), at: serverTimestamp()}
        : null,
      [`subscribers/${channel.uid}/${user.uid}`]: on ? true : null,
    });
  },

  mySubscriptions: async (): Promise<Subscription[]> => {
    const user = auth.currentUser;
    if (!user) return [];
    const snap = await get(ref(db, `subscriptions/${user.uid}`));
    const subs: Subscription[] = [];
    snap.forEach((c) => {
      subs.push({...(c.val() as Omit<Subscription, 'uid'>), uid: c.key!});
    });
    return subs.sort((a, b) => a.name.localeCompare(b.name));
  },

  subscriptionFeed: async () => {
    const subs = await api.mySubscriptions();
    const lists = await Promise.all(subs.map((s) => api.byChannel(s.uid)));
    return lists.flat().sort((a, b) => b.createdAt - a.createdAt);
  },

  // ---------- Studio ----------

  channelStats: async (uid: string): Promise<VideoStats[]> => {
    const videos = await api.byChannel(uid);
    return Promise.all(
      videos.map(async (video) => {
        const [reactions, comments, daily] = await Promise.all([
          get(ref(db, `reactions/${video.id}`)),
          get(ref(db, `comments/${video.id}`)),
          get(ref(db, `viewsDaily/${video.id}`)).catch(() => null),
        ]);
        let likes = 0;
        let dislikes = 0;
        reactions.forEach((c) => {
          if (c.val() === 'like') likes++;
          else if (c.val() === 'dislike') dislikes++;
        });
        return {video, likes, dislikes, comments: comments.size, daily: (daily?.val() as Record<string, number>) ?? {}};
      }),
    );
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

  comments: async (id: string): Promise<CommentThread> => {
    const [snap, likesSnap, pinned] = await Promise.all([
      get(query(ref(db, `comments/${id}`), orderByChild('createdAt'))),
      get(ref(db, `commentLikes/${id}`)),
      get(ref(db, `videos/${id}/pinnedComment`)),
    ]);
    const likes: Record<string, string[]> = {};
    likesSnap.forEach((c) => {
      likes[c.key!] = Object.keys(c.val() ?? {});
    });
    return {comments: rows<Comment>(snap), likes, pinnedId: (pinned.val() as string | null) ?? undefined};
  },

  commentCount: async (id: string) => (await get(ref(db, `comments/${id}`))).size,

  comment: async (id: string, text: string, parentId?: string) => {
    const user = requireUser();
    const node = push(ref(db, `comments/${id}`));
    const comment = {
      uid: user.uid,
      author: displayName(user),
      ...(user.photoURL ? {photo: user.photoURL} : {}),
      text: text.trim().slice(0, 2000),
      ...(parentId ? {parentId} : {}),
      createdAt: serverTimestamp(),
    };
    await set(node, comment);
    return {...comment, id: node.key!, createdAt: Date.now()} as Comment;
  },

  editComment: async (videoId: string, commentId: string, text: string) => {
    const editedAt = Date.now();
    await update(ref(db, `comments/${videoId}/${commentId}`), {text: text.trim().slice(0, 2000), editedAt: serverTimestamp()});
    return editedAt;
  },

  /** Deletes a comment, its replies and their likes. */
  deleteComment: (videoId: string, commentId: string, replyIds: string[] = []) =>
    update(
      ref(db),
      Object.fromEntries(
        [commentId, ...replyIds].flatMap((c) => [
          [`comments/${videoId}/${c}`, null],
          [`commentLikes/${videoId}/${c}`, null],
        ]),
      ),
    ),

  likeComment: (videoId: string, commentId: string, on: boolean) =>
    set(ref(db, `commentLikes/${videoId}/${commentId}/${requireUser().uid}`), on ? true : null),

  heartComment: (videoId: string, commentId: string, on: boolean) =>
    set(ref(db, `comments/${videoId}/${commentId}/hearted`), on ? true : null),

  pinComment: (videoId: string, commentId: string | null) => set(ref(db, `videos/${videoId}/pinnedComment`), commentId),

  upload: async (
    input: {file: File; thumbnail: Blob | null; title: string; description: string; duration: number; short: boolean},
    onProgress: (fraction: number) => void,
  ) => {
    // First await: the Drive consent popup must open while the click is still "fresh".
    const token = await getDriveToken();
    const user = requireUser();
    const id = push(ref(db, 'videos')).key!;
    const ext = (input.file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'mp4').toLowerCase();
    const mimeType = input.file.type.startsWith('video/') ? input.file.type : (VIDEO_TYPES[ext] ?? 'video/mp4');
    const safeTitle = input.title.trim().slice(0, 120);
    const total = input.file.size + (input.thumbnail?.size ?? 0);

    const uploaded: string[] = [];
    try {
      const folderId = await ensureFolder(token);
      let thumbDriveId: string | undefined;
      if (input.thumbnail) {
        thumbDriveId = await uploadFile(
          token,
          input.thumbnail,
          {name: `${safeTitle} (нүүр зураг).jpg`, mimeType: input.thumbnail.type || 'image/jpeg', folderId},
          (loaded) => onProgress(loaded / total),
        );
        uploaded.push(thumbDriveId);
        await makePublic(token, thumbDriveId);
      }

      const offset = input.thumbnail?.size ?? 0;
      const driveId = await uploadFile(
        token,
        input.file,
        {name: `${safeTitle}.${ext}`, mimeType, folderId},
        (loaded) => onProgress((offset + loaded) / total),
      );
      uploaded.push(driveId);
      await makePublic(token, driveId);

      await set(ref(db, `videos/${id}`), {
        uid: user.uid,
        title: safeTitle,
        description: input.description.trim().slice(0, 5000),
        channel: displayName(user),
        ...(user.photoURL ? {channelPhoto: user.photoURL} : {}),
        driveId,
        ...(thumbDriveId ? {thumbDriveId} : {}),
        duration: Math.max(0, Math.round(input.duration || 0)),
        ...(input.short ? {short: true} : {}),
        views: 0,
        createdAt: serverTimestamp(),
      });
      return id;
    } catch (e) {
      await Promise.all(uploaded.map((f) => deleteFile(token, f).catch(() => {})));
      throw e;
    }
  },

  /** Removes the video from Batnab; returns false if the Drive files could not be deleted too. */
  remove: async (video: Video) => {
    await update(ref(db), {
      [`videos/${video.id}`]: null,
      [`comments/${video.id}`]: null,
      [`commentLikes/${video.id}`]: null,
      [`reactions/${video.id}`]: null,
      [`viewsDaily/${video.id}`]: null,
    });
    try {
      const token = await getDriveToken();
      const files = [video.driveId, video.thumbDriveId].filter(Boolean) as string[];
      await Promise.all(files.map((f) => deleteFile(token, f)));
      return true;
    } catch {
      return false;
    }
  },
};

export function errorMessage(e: unknown): string {
  const code = (e as {code?: string})?.code ?? '';
  if (code.includes('permission-denied') || code.includes('unauthorized') || /permission/i.test(String(e)))
    return 'Зөвшөөрөлгүй үйлдэл байна';
  if (code.includes('network')) return 'Сүлжээний алдаа гарлаа';
  return (e as Error)?.message || 'Алдаа гарлаа';
}
