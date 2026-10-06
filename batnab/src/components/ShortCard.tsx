import {formatViews} from '../lib/format';
import {Link} from '../lib/router';
import type {Video} from '../lib/types';
import {driveThumbUrl} from '../lib/drive';
import {useState} from 'react';
import {Play} from 'lucide-react';

export default function ShortCard({video}: {video: Video}) {
  const [broken, setBroken] = useState(false);
  return (
    <Link href={`/shorts/${video.id}`} className="group block w-40 shrink-0 sm:w-48">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-neutral-800">
        {!broken ? (
          <img
            src={driveThumbUrl(video.thumbDriveId ?? video.driveId)}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-500">
            <Play size={36} />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{video.title}</p>
      <p className="text-xs text-neutral-400">{formatViews(video.views)} үзэлт</p>
    </Link>
  );
}

export function ShortsLogo({size = 22}: {size?: number}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M15.5 3.5 7 8a4 4 0 0 0 0 7l1 .5-1 .5a4 4 0 0 0 4 7l8.5-4.5a4 4 0 0 0 0-7l-1-.5 1-.5a4 4 0 0 0-3.5-7Z" />
      <path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}
