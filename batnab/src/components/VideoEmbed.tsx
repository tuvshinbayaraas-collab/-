import {ExternalLink, Maximize, Play, RotateCcw} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

/** What a video link plays as: YouTube, Google Drive, Vimeo, Facebook, a video file, or (anything else) a link to open. */
export type VideoSource =
  | {kind: 'youtube'; id: string; start: number}
  | {kind: 'drive'; id: string}
  | {kind: 'vimeo'; id: string; hash?: string}
  | {kind: 'facebook'; url: string}
  | {kind: 'file'; url: string}
  | {kind: 'link'; url: string};

/** Seconds from YouTube's "t=" ("90", "1m30s", "1h2m3s"). */
const seconds = (t: string | null) => {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
};

/** The link as written by the teacher, or null when it isn't a web address. */
export function videoSource(link: string): VideoSource | null {
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^(www\.|m\.|web\.|mbasic\.)/, '');
  const yt = /^[\w-]{11}$/;
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    if (yt.test(id)) return {kind: 'youtube', id, start: seconds(u.searchParams.get('t'))};
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    const id = u.searchParams.get('v') ?? /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(u.pathname)?.[1] ?? '';
    if (yt.test(id)) return {kind: 'youtube', id, start: seconds(u.searchParams.get('t') ?? u.searchParams.get('start'))};
  }
  if (host === 'drive.google.com') {
    const id = /\/file\/d\/([\w-]+)/.exec(u.pathname)?.[1] ?? u.searchParams.get('id');
    if (id) return {kind: 'drive', id};
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/123, vimeo.com/123/abcdef (unlisted: its hash), …/showcase/9/video/123, player.vimeo.com/video/123?h=…
    const m = /(?:^|\/video)\/(\d+)(?:\/([\da-f]+))?\/?$/.exec(u.pathname) ?? /\/(\d+)(?:\/([\da-f]+))?\/?$/.exec(u.pathname);
    if (m) return {kind: 'vimeo', id: m[1], hash: m[2] ?? u.searchParams.get('h') ?? undefined};
  }
  // A Facebook video (a page's /videos/…, /watch?v=…, a reel, a shared one, fb.watch/…): played by Facebook's own player.
  if (host === 'fb.watch' || ((host === 'facebook.com' || host === 'fb.com') && /\/videos\/|^\/watch\/?$|^\/reel\/|^\/share\/[vr]\/|^\/video\.php/.test(u.pathname))) {
    return {kind: 'facebook', url: host === 'fb.watch' ? u.href : `https://www.facebook.com${u.pathname}${u.search}`};
  }
  if (/\.(mp4|webm|ogv|mov|m4v)$/i.test(u.pathname)) return {kind: 'file', url: u.href};
  return {kind: 'link', url: u.href};
}

const frame = (s: VideoSource, at?: number) =>
  s.kind === 'youtube'
    ? // The page talks to the player (enablejsapi): jumps without reloading, knows when it is paused or done.
      `https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&rel=0&playsinline=1&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(location.origin)}${(at ?? s.start) ? `&start=${at ?? s.start}` : ''}`
    : s.kind === 'drive'
      ? `https://drive.google.com/file/d/${s.id}/preview`
      : s.kind === 'vimeo'
        ? `https://player.vimeo.com/video/${s.id}?autoplay=1${s.hash ? `&h=${s.hash}` : ''}${at ? `#t=${at}s` : ''}`
        : s.kind === 'facebook'
          ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(s.url)}&show_text=false&autoplay=true&allowfullscreen=true`
          : '';

/** Whether a point in the video can be jumped to (a Google Drive or Facebook video can't be told where to start). */
export const canSeek = (s: VideoSource | null) => !!s && (s.kind === 'youtube' || s.kind === 'vimeo' || s.kind === 'file');

/** YouTube's player states, as its player reports them. */
const ENDED = 0;
const PAUSED = 2;

/**
 * A video. It loads only when tapped (a phone doesn't spend its data on a video nobody watches); a link that isn't a
 * known player opens in a new tab. A YouTube video paused or ended is covered by its own button, not YouTube's other
 * videos and their pictures over it; «Томоор үзэх» plays it on the whole screen (turned on its side on a phone).
 */
export default function VideoEmbed({
  link,
  title = 'Видео тайлбар',
  className = '',
  at,
  onWatched,
}: {
  link: string;
  title?: string;
  className?: string;
  /** A point to play from (`n` counts the taps, so the same point can be gone back to). */
  at?: {t: number; n: number};
  /** Watched to the end (nine tenths of it): a YouTube video tells. */
  onWatched?: () => void;
}) {
  const [on, setOn] = useState(false);
  const s = videoSource(link);
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLIFrameElement>(null);
  // Whether the YouTube player answers (then it is told where to go, instead of being loaded again from there).
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<number | null>(null);
  // Where the player was loaded from, and a count to load it again.
  const [load, setLoad] = useState<{t?: number; n: number}>({n: 0});
  const told = useRef(false);
  const watched = useRef(onWatched);
  watched.current = onWatched;
  const [full, setFull] = useState(false);
  const youtube = s?.kind === 'youtube';

  const send = (func: string, args: unknown[] = []) => player.current?.contentWindow?.postMessage(JSON.stringify({event: 'command', func, args, id: 1, channel: 'widget'}), '*');

  // A point picked: there, in the player already playing; else loaded from there.
  useEffect(() => {
    if (!at) return;
    setOn(true);
    if (youtube && ready) {
      send('seekTo', [at.t, true]);
      send('playVideo');
    } else setLoad((l) => ({t: at.t, n: l.n + 1}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  // Listening to the YouTube player: asked until it answers (it may not be ready yet when loaded).
  useEffect(() => {
    if (!on || !youtube) return;
    setReady(false);
    setState(null);
    const hello = () => player.current?.contentWindow?.postMessage(JSON.stringify({event: 'listening', id: 1, channel: 'widget'}), '*');
    let tries = 0;
    const ask = window.setInterval(() => {
      if (++tries > 40) window.clearInterval(ask);
      else hello();
    }, 250);
    const done = () => {
      if (told.current) return;
      told.current = true;
      watched.current?.();
    };
    const heard = (e: MessageEvent) => {
      if (!player.current || e.source !== player.current.contentWindow || typeof e.data !== 'string') return;
      let m: {event?: string; info?: unknown};
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.event === 'onReady' || m.event === 'initialDelivery' || m.event === 'infoDelivery') {
        setReady(true);
        window.clearInterval(ask);
      }
      if (m.event === 'onStateChange' && typeof m.info === 'number') {
        setState(m.info);
        if (m.info === ENDED) done();
      }
      const info = (m.event === 'infoDelivery' || m.event === 'initialDelivery') && m.info && typeof m.info === 'object' ? (m.info as {playerState?: unknown; currentTime?: unknown; duration?: unknown}) : null;
      if (info) {
        if (typeof info.playerState === 'number') {
          setState(info.playerState);
          if (info.playerState === ENDED) done();
        }
        const t = Number(info.currentTime);
        const d = Number(info.duration);
        if (d > 0 && t / d >= 0.9) done();
      }
    };
    window.addEventListener('message', heard);
    return () => {
      window.clearInterval(ask);
      window.removeEventListener('message', heard);
    };
  }, [on, youtube, load.n]);

  // On the whole screen: turned on its side on a phone that can (an Android one); back when left.
  useEffect(() => {
    const change = () => {
      const now = !!box.current && document.fullscreenElement === box.current;
      setFull(now);
      if (!now) (screen.orientation as {unlock?: () => void} | undefined)?.unlock?.();
    };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  const big = () =>
    box.current
      ?.requestFullscreen?.()
      .then(() => (screen.orientation as {lock?: (o: string) => Promise<void>} | undefined)?.lock?.('landscape').catch(() => {}))
      .catch(() => {});

  if (!s) return null;
  if (s.kind === 'link')
    return (
      <a href={s.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-full bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/25 ${className}`}>
        <Play size={16} /> {title} <ExternalLink size={14} />
      </a>
    );
  const covered = youtube && ready && (state === PAUSED || state === ENDED);
  return (
    <div className={className}>
      <div ref={box} className={`relative aspect-video w-full overflow-hidden bg-black ${full ? '' : 'rounded-xl'}`} data-player={s.kind}>
        {on ? (
          s.kind === 'file' ? (
            <video key={load.n} src={load.t ? `${s.url}#t=${load.t}` : s.url} controls autoPlay playsInline className="h-full w-full" />
          ) : (
            <iframe
              key={load.n}
              ref={player}
              src={frame(s, load.t)}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share"
              allowFullScreen
              className="h-full w-full border-0"
            />
          )
        ) : (
          <button type="button" onClick={() => setOn(true)} aria-label={`${title}: тоглуулах`} className="group absolute inset-0 flex items-center justify-center">
            {s.kind === 'youtube' && <img src={`https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
            <span className="relative flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform group-hover:scale-105">
              <Play size={18} fill="currentColor" /> {title}
            </span>
          </button>
        )}
        {/* Paused: YouTube's bar and its other videos («More videos») kept off the picture, its middle left to see (a
            formula on the board); done: its suggestions covered. A tap plays on. */}
        {covered && (
          <button
            type="button"
            onClick={() => {
              if (state === ENDED) send('seekTo', [0, true]);
              send('playVideo');
            }}
            className={`absolute inset-0 flex items-end justify-center pb-[6%] ${state === ENDED ? 'bg-black/90' : 'bg-[linear-gradient(to_bottom,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.92)_10%,transparent_18%,transparent_58%,rgba(0,0,0,0.92)_70%)]'}`}
            data-video-cover={state === ENDED ? 'ended' : 'paused'}
          >
            <span className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg">
              {state === ENDED ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />} {state === ENDED ? 'Дахин үзэх' : 'Үргэлжлүүлэх'}
            </span>
          </button>
        )}
      </div>
      {on && s.kind !== 'file' && document.fullscreenEnabled && (
        <button type="button" onClick={() => void big()} className="mt-2 flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm font-medium hover:bg-neutral-700" data-video-big>
          <Maximize size={15} /> Томоор үзэх
        </button>
      )}
    </div>
  );
}
