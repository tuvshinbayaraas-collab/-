// Drive's stream responses aren't HTTP-cacheable (max-age=0, no ETag), so a fetch() prefetch would be
// thrown away. Instead we start buffering in a detached <video> element and hand that same element to
// the player when the visitor opens the video, keeping everything it already downloaded.
import {driveStreamUrl} from './drive';

const MAX = 2;
const pool = new Map<string, HTMLVideoElement>();

function create(driveId: string, preload: 'auto' | 'metadata') {
  const el = document.createElement('video');
  el.preload = preload;
  el.playsInline = true;
  el.src = driveStreamUrl(driveId);
  return el;
}

function release(el: HTMLVideoElement) {
  el.pause();
  el.removeAttribute('src');
  el.load(); // aborts the pending download
}

/**
 * Start loading a video the visitor is likely to open next (on hover): only its index and first
 * frames, so a long or large file isn't downloaded for a video that never gets opened.
 */
export function warmVideo(driveId: string) {
  if (pool.has(driveId)) return;
  pool.set(driveId, create(driveId, 'metadata'));
  while (pool.size > MAX) {
    const [oldId, oldEl] = pool.entries().next().value as [string, HTMLVideoElement];
    pool.delete(oldId);
    release(oldEl);
  }
}

/** The pre-buffered element for this video if there is a healthy one, otherwise a fresh one. */
export function takeVideo(driveId: string): HTMLVideoElement {
  const warm = pool.get(driveId);
  pool.delete(driveId);
  // One that already failed (e.g. warmed while Drive was still publishing a new upload) is no use.
  if (warm?.error) {
    release(warm);
    return create(driveId, 'auto');
  }
  if (warm) warm.preload = 'auto';
  return warm ?? create(driveId, 'auto');
}

export {release as releaseVideo};
