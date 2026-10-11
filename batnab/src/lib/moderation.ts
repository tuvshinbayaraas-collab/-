// Viewer reports and the admin review queue.
//   admins/{uid}: true            — set by hand in the Firebase console (never from the site)
//   reports/{videoId}_{commentId|v}_{reporterUid}: {type, videoId, commentId?, reason, details?, reporterUid, reporterName, createdAt}
import {get, orderByChild, query, ref, serverTimestamp, set, update} from 'firebase/database';
import {useEffect, useState} from 'react';
import {useUser, displayName} from './auth';
import {auth, db} from './firebase';
import {notifyMany} from './notifications';

export type ReportReason = 'spam' | 'sexual' | 'violent' | 'hateful' | 'harassment' | 'misleading' | 'copyright' | 'other';

export const REASONS: Record<ReportReason, string> = {
  sexual: 'Бэлгийн шинжтэй контент',
  violent: 'Хүчирхийлэл, аймшигтай контент',
  hateful: 'Үзэн ядалт, доромжлол',
  harassment: 'Дарамт, заналхийлэл',
  misleading: 'Хуурамч, төөрөгдүүлсэн мэдээлэл',
  spam: 'Спам, залилан',
  copyright: 'Зохиогчийн эрхийн зөрчил',
  other: 'Бусад',
};

export interface Report {
  id: string;
  type: 'video' | 'comment';
  videoId: string;
  commentId?: string;
  reason: ReportReason;
  details?: string;
  reporterUid: string;
  reporterName: string;
  createdAt: number;
}

export class AlreadyReported extends Error {}

export async function submitReport(r: {
  type: 'video' | 'comment';
  videoId: string;
  videoTitle: string;
  commentId?: string;
  reason: ReportReason;
  details: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Эхлээд нэвтэрнэ үү');
  // One report per person per video/comment: a repeat hits an existing key, which the rules refuse.
  const key = `${r.videoId}_${r.commentId ?? 'v'}_${user.uid}`;
  try {
    await set(ref(db, `reports/${key}`), {
      type: r.type,
      videoId: r.videoId,
      ...(r.commentId ? {commentId: r.commentId} : {}),
      reason: r.reason,
      ...(r.details.trim() ? {details: r.details.trim().slice(0, 500)} : {}),
      reporterUid: user.uid,
      reporterName: displayName(user),
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    if (/permission/i.test(String((e as {code?: string}).code ?? e))) throw new AlreadyReported('Та үүнийг аль хэдийн мэдээлсэн байна');
    throw e;
  }
  const admins = Object.keys((await get(ref(db, 'admins')).catch(() => null))?.val() ?? {});
  notifyMany(admins, {
    type: 'report',
    videoId: r.videoId,
    videoTitle: r.videoTitle,
    ...(r.commentId ? {commentId: r.commentId} : {}),
    text: REASONS[r.reason],
  }).catch(() => {});
}

export function useIsAdmin() {
  const {user} = useUser();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    setAdmin(false);
    if (!user) return;
    get(ref(db, `admins/${user.uid}`)).then((s) => setAdmin(s.val() === true), () => setAdmin(false));
  }, [user?.uid]);
  return admin;
}

export async function listReports(): Promise<Report[]> {
  const snap = await get(query(ref(db, 'reports'), orderByChild('createdAt')));
  const out: Report[] = [];
  snap.forEach((c) => {
    out.push({...(c.val() as Omit<Report, 'id'>), id: c.key!});
  });
  return out.reverse();
}

export const dismissReports = (ids: string[]) =>
  update(ref(db), Object.fromEntries(ids.map((id) => [`reports/${id}`, null])));

/** Admin takedown of a video: removes it and everything attached from the site (the file stays in its owner's Drive). */
export const removeVideoAsAdmin = (videoId: string) =>
  update(ref(db), {
    [`videos/${videoId}`]: null,
    [`comments/${videoId}`]: null,
    [`commentLikes/${videoId}`]: null,
    [`reactions/${videoId}`]: null,
    [`viewsDaily/${videoId}`]: null,
  });

/** Admin removal of a comment and its replies. */
export async function removeCommentAsAdmin(videoId: string, commentId: string) {
  const snap = await get(ref(db, `comments/${videoId}`));
  const ids = [commentId];
  snap.forEach((c) => {
    if (c.child('parentId').val() === commentId) ids.push(c.key!);
  });
  await update(
    ref(db),
    Object.fromEntries(ids.flatMap((id) => [[`comments/${videoId}/${id}`, null], [`commentLikes/${videoId}/${id}`, null]])),
  );
}
