import {Clapperboard, Upload} from 'lucide-react';
import {EmptyState, GridSkeleton, VideoGrid} from '../components/VideoCard';
import {api} from '../lib/api';
import {Link} from '../lib/router';
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
  return <VideoGrid videos={data} />;
}
