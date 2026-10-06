import type {Comment, Video} from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Алдаа гарлаа (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(body),
});

export const api = {
  list: (params: {q?: string; channel?: string} = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.channel) qs.set('channel', params.channel);
    return request<Video[]>(`/api/videos?${qs}`);
  },
  get: (id: string) => request<Video>(`/api/videos/${encodeURIComponent(id)}`),
  view: (id: string) => request<{views: number}>(`/api/videos/${encodeURIComponent(id)}/view`, {method: 'POST'}),
  react: (id: string, likes: number, dislikes: number) =>
    request<{likes: number; dislikes: number}>(`/api/videos/${encodeURIComponent(id)}/react`, json({likes, dislikes})),
  comment: (id: string, author: string, text: string) =>
    request<Comment>(`/api/videos/${encodeURIComponent(id)}/comments`, json({author, text})),
  remove: (id: string, ownerToken: string) =>
    request<void>(`/api/videos/${encodeURIComponent(id)}`, {method: 'DELETE', headers: {'X-Owner-Token': ownerToken}}),

  // XHR instead of fetch so we can report upload progress.
  upload: (form: FormData, onProgress: (fraction: number) => void) =>
    new Promise<Video & {ownerToken: string}>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/videos');
      xhr.responseType = 'json';
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve(xhr.response)
          : reject(new Error(xhr.response?.error ?? `Алдаа гарлаа (${xhr.status})`));
      xhr.onerror = () => reject(new Error('Сүлжээний алдаа гарлаа'));
      xhr.send(form);
    }),
};
