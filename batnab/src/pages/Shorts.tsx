import {ChevronDown, ChevronUp, MessageSquare, Play, Share2, ThumbsDown, ThumbsUp} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import Avatar from '../components/Avatar';
import {ShortsLogo} from '../components/ShortCard';
import SubscribeButton from '../components/SubscribeButton';
import {EmptyState} from '../components/VideoCard';
import {api} from '../lib/api';
import {drivePlayerUrl, driveThumbUrl} from '../lib/drive';
import {formatViews} from '../lib/format';
import {Link} from '../lib/router';
import {history as watchHistory} from '../lib/storage';
import type {Video} from '../lib/types';
import {useAsync} from '../lib/useAsync';
import {useReactions} from '../lib/useReactions';

export default function Shorts({startId}: {startId?: string}) {
  const {data, loading, error} = useAsync(() => api.shorts(), []);
  const [active, setActive] = useState<string | null>(null);
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

  if (loading) return <div className="mx-auto aspect-[9/16] h-[calc(100dvh-96px)] animate-pulse rounded-2xl bg-neutral-800" />;
  if (error) return <EmptyState title="Ачаалж чадсангүй">{error}</EmptyState>;
  if (!shorts.length)
    return (
      <EmptyState title="Одоогоор Shorts алга">
        <p>60 секундээс богино, босоо бичлэг оруулахад энд харагдана.</p>
        <Link href="/upload" className="mt-3 inline-block text-blue-400 hover:underline">
          Shorts оруулах
        </Link>
      </EmptyState>
    );

  return (
    <div className="relative -mx-4 -mb-10 -mt-4 sm:-mx-6">
      <div
        ref={scroller}
        className="h-[calc(100dvh-56px)] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]"
      >
        {shorts.map((v) => (
          <ShortItem key={v.id} video={v} active={v.id === active} />
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

function ShortItem({video, active}: {video: Video; active: boolean}) {
  return (
    <section
      data-id={video.id}
      className="relative flex h-[calc(100dvh-56px)] snap-start snap-always items-center justify-center gap-4 md:py-3"
    >
      <div className="relative h-full w-full overflow-hidden bg-black md:aspect-[9/16] md:w-auto md:rounded-2xl">
        {active ? (
          <iframe
            src={drivePlayerUrl(video.driveId)}
            title={video.title}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <>
            <img
              src={driveThumbUrl(video.thumbDriveId ?? video.driveId)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover opacity-80"
            />
            <Play size={56} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80" />
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pr-20 pt-16 md:pr-4">
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

function ShortActions({video}: {video: Video}) {
  const {likes, mine, toggle} = useReactions(video.id);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${location.origin}/shorts/${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Холбоосыг хуулна уу:', url);
    }
  };

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
        Сэтгэгдэл
      </div>
      <div className="flex flex-col items-center gap-1">
        <button onClick={share} className={btn} title="Хуваалцах">
          <Share2 size={22} />
        </button>
        {copied ? 'Хуулагдлаа' : 'Хуваалцах'}
      </div>
      <ShortsLogo size={26} />
    </div>
  );
}
