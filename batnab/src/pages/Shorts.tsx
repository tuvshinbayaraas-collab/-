import {ChevronDown, ChevronUp, FileX, Flag, MessageSquare, Pause, Play, Share2, ThumbsDown, ThumbsUp, Volume2, VolumeX} from 'lucide-react';
import {useEffect, useMemo, useRef, useState, type PointerEvent} from 'react';
import Avatar from '../components/Avatar';
import ReportDialog from '../components/ReportDialog';
import ShareDialog from '../components/ShareDialog';
import {ShortsLogo} from '../components/ShortCard';
import SubscribeButton from '../components/SubscribeButton';
import {EmptyState} from '../components/VideoCard';
import {api} from '../lib/api';
import {signIn, useUser} from '../lib/auth';
import {auth} from '../lib/firebase';
import {diagnoseStream, drivePlayerUrl, driveStreamUrl, driveThumbUrl} from '../lib/drive';
import {formatViews} from '../lib/format';
import {Link} from '../lib/router';
import {history as watchHistory} from '../lib/storage';
import type {Video} from '../lib/types';
import {useAsync} from '../lib/useAsync';
import {useReactions} from '../lib/useReactions';

export default function Shorts({startId}: {startId?: string}) {
  const {data, loading, error} = useAsync(async () => {
    const list = await api.shorts();
    // An unlisted short opened by its link isn't in the public feed; show it first anyway.
    if (startId && !list.some((v) => v.id === startId)) {
      const v = await api.get(startId).catch(() => null);
      if (v?.short && (v.visibility !== 'private' || v.uid === auth.currentUser?.uid)) list.unshift(v);
    }
    return list;
  }, [startId]);
  const [active, setActive] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  // Browsers only allow autoplay with sound after the visitor has interacted with the site;
  // when they refuse we fall back to muted playback and show an unmute hint (like YouTube).
  const [muted, setMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const counted = useRef(new Set<string>());

  // Requested short first, then the rest newest-first.
  const shorts = useMemo(() => {
    const list = data ?? [];
    const start = list.find((v) => v.id === startId);
    return start ? [start, ...list.filter((v) => v !== start)] : list;
  }, [data, startId]);

  useEffect(() => {
    const root = scroller.current;
    if (!root || !shorts.length) return;
    setActive((a) => a ?? shorts[0].id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.id!);
      },
      {root, threshold: 0.6},
    );
    root.querySelectorAll('[data-id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [shorts]);

  useEffect(() => {
    if (!active) return;
    setPaused(false);
    // Keep the URL shareable without adding a history entry per swipe.
    window.history.replaceState(null, '', `/shorts/${active}`);
    if (!counted.current.has(active)) {
      counted.current.add(active);
      api.view(active).catch(() => {});
      watchHistory.push(active);
    }
  }, [active]);

  const step = (dir: 1 | -1) => {
    const root = scroller.current;
    if (root) root.scrollBy({top: dir * root.clientHeight, behavior: 'smooth'});
  };

  const toggleMute = () => {
    setMuted((m) => !m);
    setSoundBlocked(false);
  };

  // Keyboard: ↑/↓ (or k/j) to move, space to pause, m to mute.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') step(1);
      else if (e.key === 'ArrowUp' || e.key === 'k') step(-1);
      else if (e.key === ' ') setPaused((p) => !p);
      else if (e.key === 'm') toggleMute();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return <div className="mx-auto aspect-[9/16] h-[calc(100dvh-96px)] animate-pulse rounded-2xl bg-neutral-800" />;
  if (error) return <EmptyState title="Ачаалж чадсангүй">{error}</EmptyState>;
  if (!shorts.length)
    return (
      <EmptyState title="Одоогоор Shorts алга">
        <p>3 минутаас богино, босоо бичлэг оруулахад энд харагдана.</p>
        <Link href="/upload" className="mt-3 inline-block text-blue-400 hover:underline">
          Shorts оруулах
        </Link>
      </EmptyState>
    );

  const activeIndex = Math.max(0, shorts.findIndex((v) => v.id === active));

  return (
    <div className="relative -mx-4 -mb-10 -mt-4 sm:-mx-6">
      <div
        ref={scroller}
        className="h-[calc(100dvh-56px)] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]"
      >
        {shorts.map((v, i) => (
          <ShortItem
            key={v.id}
            video={v}
            active={i === activeIndex}
            // Keep the previous one and the next two loaded so swiping starts instantly.
            preload={i >= activeIndex - 1 && i <= activeIndex + 2}
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            muted={muted}
            soundBlocked={soundBlocked}
            onToggleMute={toggleMute}
            onSoundBlocked={() => {
              setMuted(true);
              setSoundBlocked(true);
            }}
          />
        ))}
      </div>
      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <button onClick={() => step(-1)} className="rounded-full bg-neutral-800 p-3 hover:bg-neutral-700" aria-label="Өмнөх">
          <ChevronUp size={22} />
        </button>
        <button onClick={() => step(1)} className="rounded-full bg-neutral-800 p-3 hover:bg-neutral-700" aria-label="Дараах">
          <ChevronDown size={22} />
        </button>
      </div>
    </div>
  );
}

interface ItemProps {
  video: Video;
  active: boolean;
  preload: boolean;
  paused: boolean;
  onTogglePause: () => void;
  muted: boolean;
  soundBlocked: boolean;
  onToggleMute: () => void;
  onSoundBlocked: () => void;
}

function ShortItem(props: ItemProps) {
  const {video} = props;
  return (
    <section
      data-id={video.id}
      className="relative flex h-[calc(100dvh-56px)] snap-start snap-always items-center justify-center gap-4 md:py-3"
    >
      <div className="relative h-full w-full overflow-hidden bg-black md:aspect-[9/16] md:w-auto md:rounded-2xl">
        <ShortPlayer {...props} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pb-5 pr-20 pt-16 md:pr-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <Link href={`/channel/${video.uid}`} className="flex min-w-0 items-center gap-2">
              <Avatar name={video.channel} photo={video.channelPhoto} size={32} />
              <span className="truncate text-sm font-semibold">@{video.channel}</span>
            </Link>
            <SubscribeButton channel={{uid: video.uid, name: video.channel, photo: video.channelPhoto}} compact />
          </div>
          <p className="mt-2 line-clamp-2 text-sm">{video.title}</p>
          <p className="mt-1 text-xs text-neutral-300">{formatViews(video.views)} үзэлт</p>
        </div>
      </div>
      <ShortActions video={video} />
    </section>
  );
}

/**
 * Plays the short straight from Drive in a <video> so it can autoplay, loop and preload.
 * If the file can't be streamed (API key not allowed for Drive, unsupported codec such as HEVC),
 * it falls back to Drive's own player, which needs a tap.
 */
function ShortPlayer({video, active, preload, paused, onTogglePause, muted, soundBlocked, onToggleMute, onSoundBlocked}: ItemProps) {
  const ref = useRef<HTMLVideoElement>(null);
  // 'iframe' = Drive's own player (codec this browser can't play); 'missing' = file deleted/unshared.
  const [problem, setProblem] = useState<'iframe' | 'missing' | null>(null);
  const fallback = problem !== null;
  const [buffering, setBuffering] = useState(true);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
  const poster = driveThumbUrl(video.thumbDriveId ?? video.driveId);

  const play = (v: HTMLVideoElement) =>
    v.play().catch((e: DOMException) => {
      if (e.name === 'NotAllowedError' && !v.muted) {
        onSoundBlocked();
        v.muted = true;
        v.play().catch(() => {});
      }
    });

  // Start from the beginning whenever this short becomes the visible one; stop when it scrolls away.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      v.muted = muted;
      play(v);
    } else {
      v.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fallback]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !active) return;
    if (paused) v.pause();
    else play(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  // Smooth progress bar while playing.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const v = ref.current;
      if (v && v.duration) setProgress(v.currentTime / v.duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const tap = () => {
    setFlash(paused ? 'play' : 'pause');
    setTimeout(() => setFlash(null), 500);
    onTogglePause();
  };

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const v = ref.current;
    if (!v || !v.duration || (e.type === 'pointermove' && e.buttons !== 1)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = f * v.duration;
    setProgress(f);
  };

  // The owner of a private Short can still watch it in Drive's player (see VideoPlayer).
  if (problem === 'missing' && !(video.visibility === 'private' && video.uid === auth.currentUser?.uid)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-900 p-6 text-center">
        <FileX size={40} className="text-neutral-500" />
        <p className="font-semibold">Бичлэгийн файл олдсонгүй</p>
        <p className="text-sm text-neutral-400">Эзэн нь файлаа Google Drive-аас устгасан эсвэл хаасан байна.</p>
      </div>
    );
  }

  if (fallback) {
    return active ? (
      <iframe
        src={drivePlayerUrl(video.driveId)}
        title={video.title}
        allow="autoplay; fullscreen; encrypted-media"
        allowFullScreen
        className="h-full w-full border-0"
      />
    ) : (
      <Poster src={poster} />
    );
  }

  if (!preload) return <Poster src={poster} />;

  return (
    <>
      <video
        ref={ref}
        src={driveStreamUrl(video.driveId)}
        poster={poster}
        preload="auto"
        playsInline
        loop
        muted={muted}
        onClick={tap}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() => diagnoseStream(video.driveId).then((p) => setProblem(p === 'missing' ? 'missing' : 'iframe'))}
        className="h-full w-full cursor-pointer object-cover md:object-contain"
        aria-label={video.title}
      />
      {active && buffering && !paused && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      )}
      {active && (paused || flash) && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50">
          {paused ? <Play size={34} fill="currentColor" /> : <Pause size={34} fill="currentColor" />}
        </span>
      )}
      {active && (
        <button
          onClick={onToggleMute}
          className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/50 p-2.5 text-sm hover:bg-black/70"
          aria-label={muted ? 'Дуу асаах' : 'Дуу хаах'}
          aria-pressed={!muted}
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          {soundBlocked && <span className="pr-1">Дуу асаах</span>}
        </button>
      )}
      {active && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex h-4 cursor-pointer items-end touch-none"
          onPointerDown={seek}
          onPointerMove={seek}
          role="slider"
          aria-label="Бичлэгийн явц"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-[3px] w-full bg-white/25">
            <div className="h-full bg-red-500" style={{width: `${progress * 100}%`}} />
          </div>
        </div>
      )}
    </>
  );
}

function Poster({src}: {src: string}) {
  return (
    <>
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-80" />
      <Play size={56} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80" />
    </>
  );
}

function ShortActions({video}: {video: Video}) {
  const {likes, mine, toggle} = useReactions(video.id);
  const comments = useAsync(() => api.commentCount(video.id), [video.id]);
  const {user} = useUser();
  const [reporting, setReporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const share = () => setSharing(true);

  const btn = 'flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800/80 hover:bg-neutral-700 md:bg-neutral-800';
  return (
    <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4 text-xs md:static md:self-end md:pb-4">
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => toggle('like')} className={btn} aria-pressed={mine === 'like'} title="Таалагдлаа">
          <ThumbsUp size={22} fill={mine === 'like' ? 'currentColor' : 'none'} />
        </button>
        {formatViews(likes)}
      </div>
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => toggle('dislike')} className={btn} aria-pressed={mine === 'dislike'} title="Таалагдсангүй">
          <ThumbsDown size={22} fill={mine === 'dislike' ? 'currentColor' : 'none'} />
        </button>
        Үгүй
      </div>
      <div className="flex flex-col items-center gap-1">
        <Link href={`/watch?v=${video.id}`} className={btn} title="Сэтгэгдэл">
          <MessageSquare size={22} />
        </Link>
        {comments.data ? formatViews(comments.data) : 'Сэтгэгдэл'}
      </div>
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => (user ? setReporting(true) : signIn())} className={btn} title="Мэдээлэх">
          <Flag size={20} />
        </button>
        Мэдээлэх
      </div>
      <div className="flex flex-col items-center gap-1">
        <button onClick={share} className={btn} title="Хуваалцах">
          <Share2 size={22} />
        </button>
        Хуваалцах
      </div>
      <ShortsLogo size={26} />
      {reporting && (
        <ReportDialog target={{type: 'video', videoId: video.id, videoTitle: video.title}} onClose={() => setReporting(false)} />
      )}
      {sharing && <ShareDialog url={`${location.origin}/shorts/${video.id}`} title={video.title} onClose={() => setSharing(false)} />}
    </div>
  );
}
