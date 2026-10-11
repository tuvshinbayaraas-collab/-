import {Check, Clock} from 'lucide-react';
import {useState, type MouseEvent, type ReactNode} from 'react';
import {useUser} from '../lib/auth';
import {watchLater} from '../lib/library';
import {formatViews, timeAgo} from '../lib/format';
import {Link} from '../lib/router';
import {prefetchHandlers} from '../lib/prefetch';
import type {Video} from '../lib/types';

export const videoHref = (v: Video) => (v.short ? `/shorts/${v.id}` : `/watch?v=${v.id}`);
import Avatar from './Avatar';
import Thumbnail from './Thumbnail';

export function VideoCard({video}: {video: Video}) {
  return (
    <div className="group relative" {...prefetchHandlers(video)}>
      <WatchLaterButton videoId={video.id} />
      <Link href={videoHref(video)}>
        <Thumbnail video={video} className="transition-[border-radius] group-hover:rounded-none" />
      </Link>
      <div className="mt-3 flex gap-3">
        <Link href={`/channel/${video.uid}`}>
          <Avatar name={video.channel} photo={video.channelPhoto} />
        </Link>
        <div className="min-w-0">
          <Link href={videoHref(video)} className="line-clamp-2 font-semibold leading-snug" title={video.title}>
            {video.title}
          </Link>
          <Link
            href={`/channel/${video.uid}`}
            className="mt-1 block text-sm text-neutral-400 hover:text-neutral-200"
          >
            {video.channel}
          </Link>
          <p className="text-sm text-neutral-400">
            {formatViews(video.views)} үзэлт • {timeAgo(video.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function VideoRow({video, compact = false}: {video: Video; compact?: boolean}) {
  return (
    <Link href={videoHref(video)} className="flex gap-3 sm:gap-4" {...prefetchHandlers(video)}>
      <Thumbnail video={video} className={`shrink-0 ${compact ? 'w-40 rounded-lg' : 'w-44 sm:w-80'}`} />
      <div className="min-w-0 py-0.5">
        <p className={`line-clamp-2 font-semibold leading-snug ${compact ? 'text-sm' : 'sm:text-lg'}`}>{video.title}</p>
        <p className="mt-1 text-xs text-neutral-400 sm:text-sm">
          {formatViews(video.views)} үзэлт • {timeAgo(video.createdAt)}
        </p>
        <p className="mt-1 text-xs text-neutral-400 sm:text-sm">{video.channel}</p>
        {!compact && video.description && (
          <p className="mt-2 hidden line-clamp-2 text-sm text-neutral-400 sm:block">{video.description}</p>
        )}
      </div>
    </Link>
  );
}

export function VideoGrid({videos}: {videos: Video[]}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({length: 8}, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-video rounded-xl bg-neutral-800" />
          <div className="mt-3 flex gap-3">
            <div className="h-9 w-9 rounded-full bg-neutral-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-11/12 rounded bg-neutral-800" />
              <div className="h-3 w-1/2 rounded bg-neutral-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({title, children}: {title: string; children?: ReactNode}) {
  return (
    <div className="flex flex-col items-center py-24 text-center text-neutral-400">
      <p className="text-lg font-semibold text-neutral-200">{title}</p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

/** Hover shortcut on desktop cards: add to "Дараа үзэх" without opening the video. */
function WatchLaterButton({videoId}: {videoId: string}) {
  const {user} = useUser();
  const [done, setDone] = useState(false);
  if (!user) return null;
  const add = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await watchLater.set(videoId, true);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // ignore — the save menu on the watch page reports errors
    }
  };
  return (
    <button
      onClick={add}
      className={`absolute right-2 top-2 z-10 hidden items-center gap-1.5 rounded-md bg-black/80 px-2 py-1.5 text-xs font-medium sm:flex ${
        done ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
      }`}
      aria-label="Дараа үзэх-д нэмэх"
      title="Дараа үзэх"
    >
      {done ? <Check size={14} /> : <Clock size={14} />}
      {done ? 'Нэмэгдлээ' : 'Дараа үзэх'}
    </button>
  );
}
