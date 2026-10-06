import {Trash2} from 'lucide-react';
import {useState} from 'react';
import Avatar from '../components/Avatar';
import {EmptyState, VideoCard} from '../components/VideoCard';
import {api} from '../lib/api';
import {formatViews} from '../lib/format';
import {Link} from '../lib/router';
import {storage} from '../lib/storage';
import {useAsync} from '../lib/useAsync';

export default function Channel({name}: {name: string}) {
  const [removed, setRemoved] = useState<string[]>([]);
  const {data, error, loading} = useAsync(() => api.list({channel: name}), [name]);
  const videos = (data ?? []).filter((v) => !removed.includes(v.id));
  const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
  const isMine = storage.getChannel() === name;

  const remove = async (id: string, title: string) => {
    const token = storage.getOwnerToken(id);
    if (!token || !confirm(`"${title}" бичлэгийг устгах уу?`)) return;
    try {
      await api.remove(id, token);
      storage.removeOwnerToken(id);
      setRemoved((r) => [...r, id]);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-4 sm:gap-6">
        <Avatar name={name} size={88} />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {videos.length} бичлэг • {formatViews(totalViews)} үзэлт
          </p>
          {isMine && (
            <Link
              href="/upload"
              className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200"
            >
              Бичлэг оруулах
            </Link>
          )}
        </div>
      </div>
      <h2 className="mb-4 border-b border-neutral-800 pb-3 font-semibold">Бичлэгүүд</h2>
      {loading ? (
        <p className="text-neutral-400">Ачаалж байна…</p>
      ) : error ? (
        <EmptyState title="Ачаалж чадсангүй">{error}</EmptyState>
      ) : !videos.length ? (
        <EmptyState title="Энэ сувагт бичлэг алга" />
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {videos.map((v) => (
            <div key={v.id} className="relative">
              <VideoCard video={v} />
              {storage.getOwnerToken(v.id) && (
                <button
                  onClick={() => remove(v.id, v.title)}
                  className="absolute right-2 top-2 rounded-full bg-black/75 p-2 text-neutral-200 hover:bg-red-600"
                  aria-label="Устгах"
                  title="Устгах"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
