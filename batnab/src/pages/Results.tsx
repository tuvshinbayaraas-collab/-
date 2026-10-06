import {EmptyState, VideoRow} from '../components/VideoCard';
import {api} from '../lib/api';
import {useAsync} from '../lib/useAsync';

export default function Results({query}: {query: string}) {
  const {data, error, loading} = useAsync(() => api.list({q: query}), [query]);
  if (loading) return <p className="text-neutral-400">Хайж байна…</p>;
  if (error) return <EmptyState title="Хайлт амжилтгүй">{error}</EmptyState>;
  if (!data?.length) return <EmptyState title={`"${query}" — илэрц олдсонгүй`}>Өөр үгээр хайж үзнэ үү.</EmptyState>;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {data.map((v) => (
        <VideoRow key={v.id} video={v} />
      ))}
    </div>
  );
}
