import type {ReactNode} from 'react';
import {formatViews, timeAgo} from '../lib/format';
import {Link} from '../lib/router';
import type {Video} from '../lib/types';
import Avatar from './Avatar';
import Thumbnail from './Thumbnail';

export function VideoCard({video}: {video: Video}) {
  return (
    <div className="group">
      <Link href={`/watch?v=${video.id}`}>
        <Thumbnail video={video} className="transition-[border-radius] group-hover:rounded-none" />
      </Link>
      <div className="mt-3 flex gap-3">
        <Link href={`/channel/${video.uid}`}>
          <Avatar name={video.channel} photo={video.channelPhoto} />
        </Link>
        <div className="min-w-0">
          <Link href={`/watch?v=${video.id}`} className="line-clamp-2 font-semibold leading-snug" title={video.title}>
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
    <Link href={`/watch?v=${video.id}`} className="flex gap-3 sm:gap-4">
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
