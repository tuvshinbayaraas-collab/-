import {FileX, Play, RotateCcw, Trash2, Volume2, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {api, errorMessage} from '../lib/api';
import {useUser} from '../lib/auth';
import {diagnoseStream, drivePlayerUrl, driveThumbUrl, probeStream} from '../lib/drive';
import {navigate} from '../lib/router';
import {formatClock, onSeek, resume} from '../lib/playback';
import type {Video} from '../lib/types';
import {releaseVideo, takeVideo} from '../lib/videoPool';

interface Props {
  video: Video;
  /** Start here instead of the remembered position (from a ?t= link or a timestamp). */
  startAt?: number;
  speed: number;
  next?: Video;
  autoplayNext: boolean;
  onPlayNext: () => void;
}

const AUTOPLAY_SECONDS = 8;
const MEDIA_ERRORS: Record<number, string> = {1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED'};

/**
 * Streams the file straight from Drive in a native <video> (fast start, autoplay, speed, resume).
 * Falls back to Drive's own iframe player when streaming fails (API key not allowed for Drive,
 * unsupported codec such as HEVC, or the file was made private).
 */
export default function VideoPlayer({video, startAt, speed, next, autoplayNext, onPlayNext}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLVideoElement | null>(null);
  // 'stream' = our <video>; 'iframe' = Drive's own player; 'missing' = the Drive file is gone or unshared.
  const [mode, setMode] = useState<'stream' | 'iframe' | 'missing'>('stream');
  const fallback = mode !== 'stream';
  // Why the stream failed (the browser's own error), shown under Drive's player.
  const [failure, setFailure] = useState('');
  // Bumped to remount a brand-new <video> for one retry; retryAt keeps the position for it.
  const [attempt, setAttempt] = useState(0);
  const retried = useRef(false);
  const retryAt = useRef<number | null>(null);
  const {user} = useUser();
  const isOwner = user?.uid === video.uid;
  const [ended, setEnded] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    setMode('stream');
    setFailure('');
    retried.current = false;
    retryAt.current = null;
    setEnded(false);
    setSoundBlocked(false);
    setResumedAt(null);
  }, [video.id]);

  // Mount the (possibly pre-buffered) <video> element imperatively so hover-prefetched data is reused.
  useEffect(() => {
    const container = box.current;
    if (!container || fallback) return;
    const v = takeVideo(video.driveId);
    // Decide what to show instead when the stream can't play: a deleted/unshared file gets a clear
    // message (Drive's player would only say "not found" too); anything else (e.g. a codec this
    // browser lacks) goes to Drive's player, which transcodes.
    let alive = true;
    const giveUp = async (detail: string) => {
      const [problem, probe] = await Promise.all([diagnoseStream(video.driveId), probeStream(video.driveId)]);
      if (!alive) return;
      const kind = (navigator as Navigator & {connection?: {type?: string; effectiveType?: string}}).connection;
      setFailure([detail, probe, kind?.type ?? kind?.effectiveType].filter(Boolean).join(' · '));
      setMode(problem === 'missing' ? 'missing' : 'iframe');
    };
    el.current = v;
    v.controls = true;
    v.playsInline = true;
    v.poster = driveThumbUrl(video.thumbDriveId ?? video.driveId);
    v.className = 'absolute inset-0 h-full w-full bg-black object-contain';
    v.playbackRate = speed;
    container.prepend(v);

    let lastSave = 0;
    const positionStart = () => {
      const again = retryAt.current;
      retryAt.current = null;
      const saved = again ?? startAt ?? resume.get(video.id);
      if (saved > 0 && (!v.duration || saved < v.duration - 1)) {
        v.currentTime = saved;
        if (again === null && startAt === undefined) setResumedAt(saved);
      }
    };
    const onMeta = () => positionStart();
    const onTime = () => {
      const now = Date.now();
      if (now - lastSave > 5000) {
        lastSave = now;
        resume.save(video.id, v.currentTime, v.duration);
      }
    };
    const onEnd = () => {
      resume.clear(video.id);
      setEnded(true);
    };
    const onPlay = () => setEnded(false);
    const onPause = () => resume.save(video.id, v.currentTime, v.duration);
    const onError = () => {
      const err = v.error;
      const detail = err ? `${MEDIA_ERRORS[err.code] ?? err.code}${err.message ? ` — ${err.message}` : ''}` : '';
      console.warn('Batnab: stream failed', video.driveId, detail);
      // One more try on a brand-new element after a moment: covers a dropped connection and a file
      // Drive is still finishing publishing right after upload.
      if (!retried.current) {
        retried.current = true;
        retryAt.current = v.currentTime || null;
        setTimeout(() => alive && setAttempt((a) => a + 1), 1500);
        return;
      }
      void giveUp(detail);
    };
    const onVolume = () => !v.muted && setSoundBlocked(false);

    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    v.addEventListener('volumechange', onVolume);
    if (v.readyState >= 1) positionStart();

    v.play().catch((e: DOMException) => {
      if (e.name === 'NotAllowedError') {
        v.muted = true;
        setSoundBlocked(true);
        v.play().catch(() => {});
      }
    });

    return () => {
      alive = false;
      resume.save(video.id, v.currentTime, v.duration);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
      v.removeEventListener('volumechange', onVolume);
      v.remove();
      releaseVideo(v);
      el.current = null;
    };
    // speed/startAt are applied separately; remounting on them would restart the download
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, video.driveId, fallback, attempt]);

  useEffect(() => {
    if (el.current) el.current.playbackRate = speed;
  }, [speed]);

  // A timestamp link elsewhere on the page.
  useEffect(
    () =>
      onSeek((t) => {
        const v = el.current;
        if (!v) return;
        v.currentTime = t;
        v.play().catch(() => {});
        const top = box.current?.getBoundingClientRect().top ?? 0;
        if (top < 0 || top > window.innerHeight / 2) window.scrollTo({top: 0, behavior: 'smooth'});
      }),
    [],
  );

  // Keyboard shortcuts, YouTube style.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = el.current;
      const t = e.target as HTMLElement;
      if (!v || e.ctrlKey || e.metaKey || e.altKey || t.closest('input, textarea, select, [contenteditable]')) return;
      const nudge = (s: number) => (v.currentTime = Math.min(Math.max(0, v.currentTime + s), v.duration || Infinity));
      switch (e.key) {
        case ' ':
        case 'k':
          if (t === v) return; // native controls already handle space on the focused video
          if (v.paused) v.play().catch(() => {});
          else v.pause();
          break;
        case 'j':
          nudge(-10);
          break;
        case 'l':
          nudge(10);
          break;
        case 'ArrowLeft':
          if (t === v) return;
          nudge(-5);
          break;
        case 'ArrowRight':
          if (t === v) return;
          nudge(5);
          break;
        case 'm':
          v.muted = !v.muted;
          break;
        case 'f':
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else (box.current ?? v).requestFullscreen?.().catch(() => {});
          break;
        default:
          if (/^[0-9]$/.test(e.key) && v.duration) v.currentTime = (Number(e.key) / 10) * v.duration;
          else return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // "Up next" countdown when the video finishes.
  useEffect(() => {
    if (!ended || !next || !autoplayNext) {
      setCountdown(null);
      return;
    }
    setCountdown(AUTOPLAY_SECONDS);
    const timer = setInterval(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearInterval(timer);
  }, [ended, next, autoplayNext]);

  useEffect(() => {
    if (countdown === 0) onPlayNext();
  }, [countdown, onPlayNext]);

  // A private video's file is deliberately not public, so it looks "missing" to the API key; its owner
  // can still watch it in Drive's player, which uses their own Google sign-in.
  if (mode === 'missing' && !(isOwner && video.visibility === 'private')) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-neutral-900 p-6 text-center sm:rounded-xl">
        <FileX size={44} className="text-neutral-500" />
        <p className="font-semibold">Бичлэгийн файл олдсонгүй</p>
        <p className="max-w-md text-sm text-neutral-400">
          {isOwner
            ? 'Энэ бичлэгийн файл таны Google Drive-аас устсан эсвэл нийтэд хаагдсан байна. Файлаа дахин оруулах эсвэл энэ бичлэгийг Batnab-аас устгана уу.'
            : 'Бичлэгийн эзэн файлаа Google Drive-аасаа устгасан эсвэл хаасан байна.'}
        </p>
        {isOwner && (
          <button
            onClick={async () => {
              if (!confirm(`«${video.title}» бичлэгийг Batnab-аас устгах уу?`)) return;
              try {
                // The video file is already gone, so don't pop up a Drive permission prompt just to tidy up.
                await api.remove(video, {askForDrive: false});
                navigate('/');
              } catch (e) {
                alert(errorMessage(e));
              }
            }}
            className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
          >
            <Trash2 size={16} /> Batnab-аас устгах
          </button>
        )}
      </div>
    );
  }

  if (fallback) {
    const tryStream = () => {
      retried.current = false;
      setFailure('');
      setMode('stream');
    };
    return (
      <div>
        <div className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-xl">
          <iframe
            key={video.id}
            src={drivePlayerUrl(video.driveId)}
            title={video.title}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
        {mode === 'iframe' && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
            <p className="min-w-0 flex-1 break-words">
              Энэ хөтөч бичлэгийг шууд тоглуулж чадсангүй тул Google Drive-ийн тоглуулагчаар нээлээ (шинэ бичлэгийг
              Drive хэдэн минут боловсруулдаг).
              {failure && <span className="select-all text-neutral-500"> Алдаа: {failure}</span>}
            </p>
            <button
              onClick={tryStream}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 font-medium text-neutral-100 hover:bg-neutral-700"
            >
              <RotateCcw size={14} /> Шууд тоглуулж үзэх
            </button>
          </div>
        )}
      </div>
    );
  }

  const replay = () => {
    const v = el.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };

  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-xl">
      {soundBlocked && (
        <button
          onClick={() => {
            if (el.current) el.current.muted = false;
            setSoundBlocked(false);
          }}
          className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-sm font-medium hover:bg-black/90"
        >
          <Volume2 size={18} /> Дуу асаах
        </button>
      )}
      {resumedAt !== null && !ended && (
        <div className="absolute bottom-14 left-3 z-10 flex items-center gap-3 rounded-lg bg-black/80 px-3 py-2 text-sm">
          <span>{formatClock(resumedAt)}-с үргэлжлүүлж байна</span>
          <button
            onClick={() => {
              replay();
              setResumedAt(null);
            }}
            className="font-semibold text-blue-400 hover:underline"
          >
            Эхнээс нь
          </button>
          <button onClick={() => setResumedAt(null)} aria-label="Хаах" className="text-neutral-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}
      {ended && (
        <div className="absolute inset-x-0 bottom-12 top-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 p-4 text-center">
          {next && countdown !== null ? (
            <>
              <p className="text-sm text-neutral-300">Дараагийнх {countdown} секундын дараа</p>
              <div className="flex max-w-md items-center gap-3 text-left">
                <img
                  src={driveThumbUrl(next.thumbDriveId ?? next.driveId)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="hidden aspect-video w-32 rounded-lg bg-neutral-800 object-cover sm:block"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold">{next.title}</p>
                  <p className="text-sm text-neutral-400">{next.channel}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCountdown(null)} className="rounded-full bg-neutral-700 px-4 py-2 text-sm font-semibold hover:bg-neutral-600">
                  Цуцлах
                </button>
                <button onClick={onPlayNext} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200">
                  <Play size={16} fill="currentColor" /> Одоо тоглуулах
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={replay} className="flex items-center gap-2 rounded-full bg-neutral-700 px-4 py-2 text-sm font-semibold hover:bg-neutral-600">
                <RotateCcw size={16} /> Дахин үзэх
              </button>
              {next && (
                <button onClick={onPlayNext} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200">
                  <Play size={16} fill="currentColor" /> Дараагийнх
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
