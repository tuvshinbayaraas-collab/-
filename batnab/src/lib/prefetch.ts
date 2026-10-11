// Get a video ready while the pointer is on its card, so opening it feels instant:
// the page code, the video's details and the first seconds of the stream.
import {api} from './api';
import type {Video} from './types';
import {warmVideo} from './videoPool';

const HOVER_DELAY = 200;
let timer: ReturnType<typeof setTimeout> | undefined;

function onSlowOrMeteredNetwork() {
  const c = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
  return !!c && (c.saveData || /(^|-)2g$/.test(c.effectiveType ?? ''));
}

export function prefetchVideo(video: Video) {
  api.prime(video);
  if (video.short) {
    import('../pages/Shorts');
    return;
  }
  import('../pages/Watch');
  if (!onSlowOrMeteredNetwork()) warmVideo(video.driveId);
}

/** Props for a card link: hover (desktop, after a short pause) or touch (phones) starts the prefetch. */
export function prefetchHandlers(video: Video) {
  return {
    onMouseEnter: () => {
      clearTimeout(timer);
      timer = setTimeout(() => prefetchVideo(video), HOVER_DELAY);
    },
    onMouseLeave: () => clearTimeout(timer),
    onTouchStart: () => prefetchVideo(video),
  };
}
