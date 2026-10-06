// Google Drive storage: each uploader's videos live in a "Batnab" folder in their own Drive,
// shared as "anyone with the link can view" so the site can embed them.
import {GoogleAuthProvider, reauthenticateWithPopup} from 'firebase/auth';
import {auth} from './firebase';

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

export function deleteFile(token: string, fileId: string) {
  return driveFetch<void>(token, `${API}/files/${fileId}`, {method: 'DELETE'});
}

export const drivePlayerUrl = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
export const driveThumbUrl = (id: string) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1280`;
