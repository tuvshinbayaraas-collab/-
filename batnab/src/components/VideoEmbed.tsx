import {ExternalLink, Play} from 'lucide-react';
import {useState} from 'react';

/** What a video link plays as: YouTube, Google Drive, Vimeo, a video file, or (anything else) a link to open. */
export type VideoSource = {kind: 'youtube'; id: string; start: number} | {kind: 'drive'; id: string} | {kind: 'vimeo'; id: string} | {kind: 'file'; url: string} | {kind: 'link'; url: string};

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
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
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
    const id = /\/(?:video\/)?(\d+)/.exec(u.pathname)?.[1];
    if (id) return {kind: 'vimeo', id};
  }
  if (/\.(mp4|webm|ogv|mov|m4v)$/i.test(u.pathname)) return {kind: 'file', url: u.href};
  return {kind: 'link', url: u.href};
}

const frame = (s: VideoSource) =>
  s.kind === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&rel=0&playsinline=1${s.start ? `&start=${s.start}` : ''}`
    : s.kind === 'drive'
      ? `https://drive.google.com/file/d/${s.id}/preview`
      : s.kind === 'vimeo'
        ? `https://player.vimeo.com/video/${s.id}?autoplay=1`
        : '';

/**
 * A video explanation. It loads only when tapped (a phone doesn't spend its data on a video nobody watches); a link
 * that isn't a known player opens in a new tab.
 */
export default function VideoEmbed({link, title = 'Видео тайлбар', className = ''}: {link: string; title?: string; className?: string}) {
  const [on, setOn] = useState(false);
  const s = videoSource(link);
  if (!s) return null;
  if (s.kind === 'link')
    return (
      <a href={s.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-full bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/25 ${className}`}>
        <Play size={16} /> {title} <ExternalLink size={14} />
      </a>
    );
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
      {on ? (
        s.kind === 'file' ? (
          <video src={s.url} controls autoPlay playsInline className="h-full w-full" />
        ) : (
          <iframe src={frame(s)} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full border-0" />
        )
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`${title}: тоглуулах`} className="group absolute inset-0 flex items-center justify-center">
          {s.kind === 'youtube' && <img src={`https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
          <span className="relative flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform group-hover:scale-105">
            <Play size={18} fill="currentColor" /> {title}
          </span>
        </button>
      )}
    </div>
  );
}
