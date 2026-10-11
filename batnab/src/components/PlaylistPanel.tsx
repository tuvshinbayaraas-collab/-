import {ChevronDown, ChevronUp, Play} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {playHref, type LoadedPlaylist} from '../lib/library';
import {Link} from '../lib/router';
import Thumbnail from './Thumbnail';

/** The "now playing from this list" box shown beside the player when a video is opened with ?list=. */
export default function PlaylistPanel({data, currentId}: {data: LoadedPlaylist; currentId: string}) {
  const [open, setOpen] = useState(true);
  const index = data.videos.findIndex((v) => v.id === currentId);
  const current = useRef<HTMLLIElement>(null);

  useEffect(() => {
    current.current?.scrollIntoView({block: 'nearest'});
  }, [currentId]);

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-neutral-800">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between bg-neutral-900 px-4 py-3 text-left">
        <span className="min-w-0">
          <Link href={`/playlist?list=${encodeURIComponent(data.list)}`} className="line-clamp-1 font-semibold hover:underline">
            {data.title}
          </Link>
          <span className="text-xs text-neutral-400">
            {data.ownerName} • {index + 1}/{data.videos.length}
          </span>
        </span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {open && (
        <ol className="max-h-96 overflow-y-auto py-1">
          {data.videos.map((v, i) => (
            <li key={v.id} ref={v.id === currentId ? current : undefined}>
              <Link
                href={playHref(v, data.list)}
                className={`flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-800 ${v.id === currentId ? 'bg-neutral-800' : ''}`}
              >
                <span className="w-5 shrink-0 text-center text-xs text-neutral-400">
                  {v.id === currentId ? <Play size={12} className="mx-auto" fill="currentColor" /> : i + 1}
                </span>
                <Thumbnail video={v} className="w-24 shrink-0 rounded-md" />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-medium">{v.title}</span>
                  <span className="text-xs text-neutral-400">{v.channel}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
