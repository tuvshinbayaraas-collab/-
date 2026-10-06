import {useState} from 'react';
import {EmptyState, VideoRow} from '../components/VideoCard';
import {api} from '../lib/api';
import {storage} from '../lib/storage';
import {useAsync} from '../lib/useAsync';

export default function Library({kind}: {kind: 'history' | 'liked'}) {
  const [version, setVersion] = useState(0);
  const {data, loading} = useAsync(async () => {
    const ids = kind === 'history' ? storage.getHistory() : storage.likedIds();
    const all = await api.list();
    const byId = new Map(all.map((v) => [v.id, v]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }, [kind, version]);

  const title = kind === 'history' ? 'Үзсэн түүх' : 'Таалагдсан бичлэгүүд';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        {kind === 'history' && !!data?.length && (
          <button
            onClick={() => {
              storage.clearHistory();
              setVersion((v) => v + 1);
            }}
            className="rounded-full px-4 py-2 text-sm hover:bg-neutral-800"
          >
            Түүх цэвэрлэх
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-neutral-400">Ачаалж байна…</p>
      ) : !data?.length ? (
        <EmptyState title={kind === 'history' ? 'Та одоогоор бичлэг үзээгүй байна' : 'Таалагдсан бичлэг алга'} />
      ) : (
        <div className="space-y-4">
          {data.map((v) => (
            <VideoRow key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}
