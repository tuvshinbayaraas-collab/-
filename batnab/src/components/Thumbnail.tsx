import {Play} from 'lucide-react';
import {useState} from 'react';
import {formatDuration} from '../lib/format';
import type {Video} from '../lib/types';

export default function Thumbnail({video, className = ''}: {video: Video; className?: string}) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl bg-neutral-800 ${className}`}>
      {video.thumbnailUrl && !broken ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-neutral-500">
          <Play size={40} />
        </div>
      )}
      {video.duration > 0 && (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1 py-0.5 text-xs font-medium">
          {formatDuration(video.duration)}
        </span>
      )}
    </div>
  );
}
