import {useState} from 'react';
import {EmptyState, VideoRow} from '../components/VideoCard';
import {api} from '../lib/api';
import {signIn, useUser} from '../lib/auth';
import {history} from '../lib/storage';
import {useAsync} from '../lib/useAsync';

export default function Library({kind}: {kind: 'history' | 'liked'}) {
  const {user, ready} = useUser();
  const [version, setVersion] = useState(0);
  const {data, loading} = useAsync(async () => {
    const ids = kind === 'history' ? history.get() : await api.likedIds();
    return api.byIds(ids);
  }, [kind, version, user?.uid]);

  const title = kind === 'history' ? 'Үзсэн түүх' : 'Таалагдсан бичлэгүүд';

  if (kind === 'liked' && ready && !user) {
    return (
      <EmptyState title="Таалагдсан бичлэгээ харахын тулд нэвтэрнэ үү">
        <button onClick={signIn} className="mt-2 rounded-full bg-white px-5 py-2 font-semibold text-black hover:bg-neutral-200">
          Нэвтрэх
        </button>
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        {kind === 'history' && !!data?.length && (
          <button
            onClick={() => {
              history.clear();
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
