import {Clapperboard, Upload} from 'lucide-react';
import ShortCard, {ShortsLogo} from '../components/ShortCard';
import {EmptyState, GridSkeleton, VideoGrid} from '../components/VideoCard';
import {api} from '../lib/api';
import {Link} from '../lib/router';
import type {Video} from '../lib/types';
import {useAsync} from '../lib/useAsync';

export default function Home() {
  const {data, error, loading} = useAsync(() => api.list(), []);
  if (loading) return <GridSkeleton />;
  if (error) return <EmptyState title="Бичлэг ачаалж чадсангүй">{error}</EmptyState>;
  if (!data?.length)
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-neutral-800">
          <Clapperboard size={52} className="text-red-500" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Batnab-д тавтай морил!</h1>
        <p className="mt-2 max-w-md text-neutral-400">
          Одоогоор бичлэг алга байна. Анхны бичлэгээ оруулж, бусадтай хуваалцаарай.
        </p>
        <Link
          href="/upload"
          className="mt-6 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200"
        >
          <Upload size={18} /> Бичлэг оруулах
        </Link>
      </div>
    );
  const shorts = data.filter((v) => v.short);
  const videos = data.filter((v) => !v.short);
  return (
    <div className="space-y-10">
      {videos.length > 0 && <VideoGrid videos={videos.slice(0, 8)} />}
      {shorts.length > 0 && <ShortsShelf shorts={shorts} />}
      {videos.length > 8 && <VideoGrid videos={videos.slice(8)} />}
    </div>
  );
}

function ShortsShelf({shorts}: {shorts: Video[]}) {
  return (
    <section>
      <Link href="/shorts" className="mb-4 flex items-center gap-2 text-xl font-bold">
        <ShortsLogo size={26} /> Shorts
      </Link>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:-mx-6 sm:px-6">
        {shorts.slice(0, 20).map((v) => (
          <ShortCard key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}
