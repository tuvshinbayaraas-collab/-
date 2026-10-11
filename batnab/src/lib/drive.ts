// Google Drive storage: each uploader's videos live in a "Batnab" folder in their own Drive,
// shared as "anyone with the link can view" so the site can embed them.
import {GoogleAuthProvider, reauthenticateWithPopup} from 'firebase/auth';
import {auth, firebaseApiKey} from './firebase';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

// Access tokens last an hour; keep it in memory only and re-ask a bit early.
let cached: {uid: string; token: string; expires: number} | null = null;

export class DriveError extends Error {}

/** Must be the first await in a click handler so the browser allows the consent popup. */
export async function getDriveToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new DriveError('Эхлээд нэвтэрнэ үү');
  if (cached && cached.uid === user.uid && cached.expires > Date.now()) return cached.token;

  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);
  if (user.email) provider.setCustomParameters({login_hint: user.email});
  try {
    const result = await reauthenticateWithPopup(user, provider);
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new DriveError('Google Drive-ийн зөвшөөрөл авч чадсангүй');
    cached = {uid: user.uid, token, expires: Date.now() + 50 * 60 * 1000};
    return token;
  } catch (e) {
    const code = (e as {code?: string}).code;
    if (code === 'auth/user-mismatch') throw new DriveError('Нэвтэрсэн Google бүртгэлээрээ зөвшөөрөл өгнө үү');
    if (code === 'auth/popup-blocked') throw new DriveError('Хөтөч popup цонхыг хаасан байна. Зөвшөөрөөд дахин оролдоно уу');
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request')
      throw new DriveError('Google Drive-д хандах зөвшөөрөл өгөөгүй байна');
    throw e;
  }
}

/** The Drive token from an earlier permission prompt, if still valid — never opens a popup. */
export function cachedDriveToken(): string | null {
  const user = auth.currentUser;
  return user && cached && cached.uid === user.uid && cached.expires > Date.now() ? cached.token : null;
}

async function driveFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {...init, headers: {...init.headers, Authorization: `Bearer ${token}`}});
  if (!res.ok) throw await driveError(res.status, await res.text());
  return res.status === 204 ? (undefined as T) : res.json();
}

async function driveError(status: number, body: string): Promise<DriveError> {
  if (status === 401) cached = null;
  let reason = '';
  try {
    reason = JSON.parse(body)?.error?.errors?.[0]?.reason ?? '';
  } catch {
    // non-JSON error body
  }
  if (status === 401 || reason === 'insufficientPermissions' || reason === 'authError') {
    cached = null;
    return new DriveError('Google Drive-д хандах зөвшөөрөл дутуу байна. Зөвшөөрлийн цонхонд Drive-ийн сонголтыг чагтлаад дахин оролдоно уу');
  }
  if (reason === 'storageQuotaExceeded' || reason === 'quotaExceeded')
    return new DriveError('Таны Google Drive дүүрсэн байна');
  if (reason === 'accessNotConfigured' || reason === 'SERVICE_DISABLED')
    return new DriveError('Google Drive API идэвхжээгүй байна (сайтын эзэн тохируулах шаардлагатай)');
  return new DriveError(`Google Drive алдаа (${status}${reason ? `: ${reason}` : ''})`);
}

/** The app's own "Batnab" folder in the user's Drive (drive.file scope only sees files this app created). */
export async function ensureFolder(token: string): Promise<string> {
  const q = encodeURIComponent(`name='Batnab' and mimeType='${FOLDER_MIME}' and trashed=false`);
  const found = await driveFetch<{files: Array<{id: string}>}>(token, `${API}/files?q=${q}&fields=files(id)&pageSize=1`);
  if (found.files[0]) return found.files[0].id;
  const created = await driveFetch<{id: string}>(token, `${API}/files?fields=id`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name: 'Batnab', mimeType: FOLDER_MIME}),
  });
  return created.id;
}

/** Resumable upload with progress; returns the new file id. */
export async function uploadFile(
  token: string,
  file: Blob,
  meta: {name: string; mimeType: string; folderId: string},
  onProgress: (loaded: number) => void,
): Promise<string> {
  const init = await fetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': meta.mimeType,
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify({name: meta.name, mimeType: meta.mimeType, parents: [meta.folderId]}),
  });
  if (!init.ok) throw await driveError(init.status, await init.text());
  const session = init.headers.get('Location');
  if (!session) throw new DriveError('Google Drive руу байршуулж эхэлж чадсангүй');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', session);
    xhr.setRequestHeader('Content-Type', meta.mimeType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText).id);
        } catch {
          reject(new DriveError('Google Drive-ийн хариуг уншиж чадсангүй'));
        }
      } else {
        reject(await driveError(xhr.status, xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new DriveError('Сүлжээний алдаа гарлаа'));
    xhr.send(file);
  });
}

export function makePublic(token: string, fileId: string) {
  return driveFetch<unknown>(token, `${API}/files/${fileId}/permissions?fields=id`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({role: 'reader', type: 'anyone'}),
  });
}

/** Undo makePublic: only the owner (and people they shared with in Drive) can open the file. */
export async function makeNonPublic(token: string, fileId: string) {
  try {
    await driveFetch<void>(token, `${API}/files/${fileId}/permissions/anyoneWithLink`, {method: 'DELETE'});
  } catch (e) {
    // Already not public — nothing to undo.
    if (!(e instanceof DriveError && /\(404/.test(e.message))) throw e;
  }
}

export function deleteFile(token: string, fileId: string) {
  return driveFetch<void>(token, `${API}/files/${fileId}`, {method: 'DELETE'});
}

/**
 * Raw file bytes of a public ("anyone with the link") Drive file, playable in a <video> element with
 * range requests — unlike the /preview iframe, it can autoplay. Needs the Drive API allowed on the
 * project's browser API key; callers fall back to the iframe player if it fails.
 */
export const driveStreamUrl = (id: string) =>
  `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(firebaseApiKey)}`;

export type StreamProblem = 'missing' | 'keyBlocked' | 'unknown';

/**
 * Why streaming a file failed, asked of the Drive API with the same key the player uses.
 * A 404 means the file was deleted or is no longer shared publicly (Drive answers 404 for both).
 */
export async function diagnoseStream(id: string): Promise<StreamProblem | null> {
  try {
    const res = await fetch(`${API}/files/${encodeURIComponent(id)}?fields=id&key=${encodeURIComponent(firebaseApiKey)}`);
    if (res.ok) return null;
    if (res.status === 404) return 'missing';
    const body = await res.text();
    if (/API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED/.test(body)) return 'keyBlocked';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * What this browser actually gets when it asks Drive for the first bytes of the stream, e.g.
 * "Drive 206" or "Drive 403 rateLimitExceeded" — shown with the error so a failure can be explained.
 */
export async function probeStream(id: string): Promise<string> {
  try {
    const res = await fetch(driveStreamUrl(id), {headers: {Range: 'bytes=0-1'}, cache: 'no-store'});
    if (res.ok) return `Drive ${res.status}`;
    const body = await res.text();
    let reason = '';
    try {
      const json = JSON.parse(body);
      reason = json.error?.errors?.[0]?.reason ?? json.error?.message ?? '';
    } catch {
      reason = /<html/i.test(body) ? 'HTML' : body.slice(0, 60);
    }
    return `Drive ${res.status}${reason ? ` ${reason}` : ''}`;
  } catch (e) {
    return `Drive: ${(e as Error).message || 'сүлжээ'}`;
  }
}

/** Wait (a few seconds at most) until a just-shared file is readable with the public API key. */
export async function waitUntilPublic(id: string, tries = 8) {
  for (let i = 0; i < tries; i++) {
    if ((await diagnoseStream(id)) !== 'missing') return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export const drivePlayerUrl = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
export const driveThumbUrl = (id: string) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1280`;
