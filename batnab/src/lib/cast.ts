// Play the current video on a TV: Chromecast / Google TV (Chrome), AirPlay (Safari / iPhone). The TV
// fetches the Drive stream itself, so it keeps playing even if the phone locks.

/* eslint-disable @typescript-eslint/no-explicit-any -- the Cast SDK ships no types */
declare global {
  interface Window {
    __onGCastApiAvailable?: (available: boolean) => void;
    cast?: any;
    chrome?: any;
  }
  interface HTMLVideoElement {
    webkitShowPlaybackTargetPicker?: () => void;
  }
}

const ua = () => navigator.userAgent;
const isAndroid = () => /Android/i.test(ua());
/** Desktop Chrome (and Chromium browsers that support Cast); not Android, where Remote Playback is used. */
const isDesktopChrome = () => /Chrome\//.test(ua()) && !isAndroid() && !/OPR\/|Firefox\//.test(ua());

export type CastKind = 'airplay' | 'remote' | 'chromecast';

/** How this browser can send video to a TV, or null if it can't. */
export function castKind(): CastKind | null {
  if (typeof HTMLVideoElement === 'undefined') return null;
  if ('webkitShowPlaybackTargetPicker' in HTMLVideoElement.prototype) return 'airplay';
  if (isDesktopChrome()) return 'chromecast';
  if ('remote' in HTMLMediaElement.prototype) return 'remote';
  return null;
}

let sdk: Promise<boolean> | null = null;

/** Load Google's Cast sender library (desktop Chrome only); resolves false if it isn't available. */
export function loadCastSdk(): Promise<boolean> {
  sdk ??= new Promise<boolean>((resolve) => {
    window.__onGCastApiAvailable = (available) => {
      if (available) {
        window.cast.framework.CastContext.getInstance().setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
      }
      resolve(available);
    };
    const s = document.createElement('script');
    s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    s.async = true;
    s.onerror = () => resolve(false);
    document.head.append(s);
  });
  return sdk;
}

export interface CastMedia {
  url: string;
  title: string;
  poster: string;
  /** Where to start on the TV, in seconds. */
  startAt: number;
}

export interface CastSession {
  device: string;
  /** Stop playing on the TV. */
  stop: () => void;
  /** Called once when the TV session ends (from here or from the TV / another phone). */
  onEnd: (cb: () => void) => void;
}

export class NoTvFound extends Error {}

/**
 * Ask the browser to pick a TV and play `media` there. Must run straight from a click. Returns a
 * session for Chromecast from desktop Chrome; null when the browser itself takes over the <video>
 * (AirPlay, Android's Remote Playback), whose own controls then drive the TV.
 */
export async function castTo(video: HTMLVideoElement, media: CastMedia): Promise<CastSession | null> {
  const kind = castKind();
  if (kind === 'airplay') {
    video.webkitShowPlaybackTargetPicker!();
    return null;
  }
  if (kind === 'remote') {
    try {
      await video.remote.prompt();
      return null;
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === 'NotFoundError' || name === 'NotSupportedError') throw new NoTvFound();
      if (name === 'AbortError' || name === 'NotAllowedError') return null; // closed the picker
      throw e;
    }
  }
  if (kind !== 'chromecast' || !(await loadCastSdk())) throw new NoTvFound();

  const {cast, chrome} = window;
  const context = cast.framework.CastContext.getInstance();
  try {
    await context.requestSession();
  } catch (e) {
    if (e === chrome.cast.ErrorCode.CANCEL || e === 'cancel') return null;
    throw new NoTvFound();
  }
  const session = context.getCurrentSession();
  const info = new chrome.cast.media.MediaInfo(media.url, 'video/mp4');
  info.metadata = new chrome.cast.media.GenericMediaMetadata();
  info.metadata.title = media.title;
  info.metadata.images = [new chrome.cast.Image(media.poster)];
  const request = new chrome.cast.media.LoadRequest(info);
  request.currentTime = media.startAt;
  request.autoplay = true;
  await session.loadMedia(request);

  return {
    device: session.getCastDevice()?.friendlyName || 'TV',
    stop: () => context.endCurrentSession(true),
    onEnd: (cb) => {
      const listener = (e: any) => {
        if (e.sessionState === cast.framework.SessionState.SESSION_ENDED) {
          context.removeEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, listener);
          cb();
        }
      };
      context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, listener);
    },
  };
}
