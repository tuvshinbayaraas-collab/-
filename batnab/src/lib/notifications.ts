import {get, limitToLast, onValue, orderByChild, push, query, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {displayName, useUser} from './auth';
import {auth, db} from './firebase';

export type NotificationType = 'comment' | 'reply' | 'mention' | 'commentLike' | 'heart' | 'pin' | 'subscribe' | 'newVideo';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorUid: string;
  actorName: string;
  actorPhoto?: string;
  videoId?: string;
  videoTitle?: string;
  /** Drive file id used for the small preview image. */
  thumbId?: string;
  short?: boolean;
  commentId?: string;
  /** Snippet of the comment the notification is about. */
  text?: string;
  createdAt: number;
  read?: boolean;
}

export type NotificationInput = Omit<AppNotification, 'id' | 'actorUid' | 'actorName' | 'actorPhoto' | 'createdAt' | 'read'>;

function payload(n: NotificationInput) {
  const user = auth.currentUser!;
  const clean = Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined && v !== ''));
  if (typeof clean.text === 'string') clean.text = clean.text.slice(0, 200);
  if (typeof clean.videoTitle === 'string') clean.videoTitle = clean.videoTitle.slice(0, 120);
  return {
    ...clean,
    actorUid: user.uid,
    actorName: displayName(user),
    ...(user.photoURL ? {actorPhoto: user.photoURL} : {}),
    createdAt: serverTimestamp(),
  };
}

/** Best-effort: a failed notification never breaks the action that caused it. */
export async function notify(toUid: string | undefined, n: NotificationInput) {
  const me = auth.currentUser;
  if (!me || !toUid || toUid === me.uid) return;
  try {
    await set(push(ref(db, `notifications/${toUid}`)), payload(n));
  } catch (e) {
    console.warn('notify failed', e);
  }
}

/** Same notification to many people (e.g. every subscriber when a video is published). */
export async function notifyMany(uids: string[], n: NotificationInput) {
  const me = auth.currentUser;
  if (!me) return;
  const body = payload(n);
  const targets = [...new Set(uids)].filter((u) => u !== me.uid).slice(0, 1000);
  for (let i = 0; i < targets.length; i += 200) {
    const updates: Record<string, unknown> = {};
    for (const uid of targets.slice(i, i + 200)) updates[`notifications/${uid}/${push(ref(db, 'notifications')).key}`] = body;
    try {
      await update(ref(db), updates);
    } catch (e) {
      console.warn('notifyMany failed', e);
    }
  }
}

export async function subscriberUids(channelUid: string) {
  const snap = await get(ref(db, `subscribers/${channelUid}`));
  return Object.keys(snap.val() ?? {});
}

export function markRead(ids: string[]) {
  const uid = auth.currentUser?.uid;
  if (!uid || !ids.length) return Promise.resolve();
  return update(ref(db), Object.fromEntries(ids.map((id) => [`notifications/${uid}/${id}/read`, true])));
}

export function removeNotification(id: string) {
  const uid = auth.currentUser?.uid;
  return uid ? set(ref(db, `notifications/${uid}/${id}`), null) : Promise.resolve();
}

export function clearNotifications() {
  const uid = auth.currentUser?.uid;
  return uid ? set(ref(db, `notifications/${uid}`), null) : Promise.resolve();
}

/** Live list of the signed-in user's latest notifications, newest first. */
export function useNotifications() {
  const {user} = useUser();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems([]);
    setLoaded(false);
    if (!user) return;
    return onValue(
      query(ref(db, `notifications/${user.uid}`), orderByChild('createdAt'), limitToLast(100)),
      (snap) => {
        const list: AppNotification[] = [];
        snap.forEach((c) => {
          list.push({...(c.val() as Omit<AppNotification, 'id'>), id: c.key!});
        });
        setItems(list.reverse());
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [user?.uid]);

  return {items, loaded, unread: items.filter((n) => !n.read).length};
}

export function notificationText(n: AppNotification): string {
  const quote = n.text ? `: “${n.text}”` : '';
  switch (n.type) {
    case 'comment':
      return `${n.actorName} таны «${n.videoTitle ?? 'бичлэг'}» бичлэгт сэтгэгдэл бичлээ${quote}`;
    case 'reply':
      return `${n.actorName} таны сэтгэгдэлд хариуллаа${quote}`;
    case 'mention':
      return `${n.actorName} таныг сэтгэгдэлдээ дурдлаа${quote}`;
    case 'commentLike':
      return `${n.actorName} таны сэтгэгдэлд лайк дарлаа${quote}`;
    case 'heart':
      return `${n.actorName} таны сэтгэгдэлд ❤️ өглөө${quote}`;
    case 'pin':
      return `${n.actorName} таны сэтгэгдлийг дээр тогтоолоо${quote}`;
    case 'subscribe':
      return `${n.actorName} таны сувгийг захиаллаа`;
    case 'newVideo':
      return `${n.actorName} шинэ ${n.short ? 'Shorts' : 'бичлэг'} нийтэллээ: ${n.videoTitle ?? ''}`;
    default:
      return n.actorName;
  }
}

export function notificationHref(n: AppNotification): string {
  if (n.type === 'subscribe') return `/channel/${n.actorUid}`;
  if (!n.videoId) return '/notifications';
  if (n.type === 'newVideo') return n.short ? `/shorts/${n.videoId}` : `/watch?v=${n.videoId}`;
  return `/watch?v=${n.videoId}${n.commentId ? `&lc=${n.commentId}` : ''}`;
}

export const NOTIFICATION_GROUPS: Array<{key: string; label: string; types: NotificationType[]}> = [
  {key: 'all', label: 'Бүгд', types: []},
  {key: 'comments', label: 'Сэтгэгдэл', types: ['comment', 'reply', 'mention', 'heart', 'pin']},
  {key: 'likes', label: 'Лайк', types: ['commentLike']},
  {key: 'subs', label: 'Захиалга', types: ['subscribe']},
  {key: 'videos', label: 'Шинэ бичлэг', types: ['newVideo']},
];

// ----- Browser (desktop) notifications while the tab is in the background -----

const DESKTOP_KEY = 'batnab.desktopNotify';

export const desktopNotify = {
  supported: () => typeof window !== 'undefined' && 'Notification' in window,
  enabled: () => {
    try {
      return desktopNotify.supported() && Notification.permission === 'granted' && localStorage.getItem(DESKTOP_KEY) === '1';
    } catch {
      return false;
    }
  },
  async enable() {
    if (!desktopNotify.supported()) return false;
    const perm = await Notification.requestPermission();
    try {
      localStorage.setItem(DESKTOP_KEY, perm === 'granted' ? '1' : '0');
    } catch {
      // storage unavailable — permission still applies for this visit
    }
    return perm === 'granted';
  },
  disable() {
    try {
      localStorage.setItem(DESKTOP_KEY, '0');
    } catch {
      // ignore
    }
  },
};
