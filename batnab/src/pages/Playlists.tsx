import {Clock, ListVideo, Plus} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import Thumbnail from '../components/Thumbnail';
import {EmptyState} from '../components/VideoCard';
import {VisibilityBadge} from '../components/Visibility';
import {api, errorMessage} from '../lib/api';
import {signIn, useUser} from '../lib/auth';
import {listParam, orderedIds, playlists, WATCH_LATER, watchLater} from '../lib/library';
import {Link, navigate} from '../lib/router';
import type {Video, Visibility} from '../lib/types';
import {useAsync} from '../lib/useAsync';

interface Card {
  list: string;
  title: string;
  count: number;
  cover?: Video;
  visibility?: Visibility;
  icon: 'later' | 'list';
}

export default function Playlists() {
  const {user, ready} = useUser();
  const {data, loading} = useAsync(async (): Promise<Card[]> => {
    if (!user) return [];
    const [laterIds, mine] = await Promise.all([watchLater.ids(), playlists.mine()]);
    const firstIds = [laterIds[0], ...mine.map((p) => orderedIds(p.items)[0])].filter(Boolean) as string[];
    const covers = new Map((await api.byIds(firstIds)).map((v) => [v.id, v]));
    return [
      {list: WATCH_LATER, title: 'Дараа үзэх', count: laterIds.length, cover: covers.get(laterIds[0]), icon: 'later'},
      ...mine.map((p) => {
        const ids = orderedIds(p.items);
        return {list: listParam(p), title: p.title, count: ids.length, cover: covers.get(ids[0]), visibility: p.visibility, icon: 'list' as const};
      }),
    ];
  }, [user?.uid]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');

  if (ready && !user)
    return (
      <EmptyState title="Жагсаалтаа харахын тулд нэвтэрнэ үү">
        <button onClick={signIn} className="mt-2 rounded-full bg-white px-5 py-2 font-semibold text-black hover:bg-neutral-200">
          Нэвтрэх
        </button>
      </EmptyState>
    );

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    try {
      const id = await playlists.create(title, visibility);
      navigate(`/playlist?list=${encodeURIComponent(listParam({uid: user.uid, id}))}`);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Тоглуулах жагсаалтууд</h1>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700"
        >
          <Plus size={18} /> Шинэ жагсаалт
        </button>
      </div>
      {creating && (
        <form onSubmit={create} className="mb-6 flex max-w-xl flex-wrap gap-2 rounded-xl bg-neutral-900 p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Жагсаалтын нэр"
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-white"
          />
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm"
            aria-label="Хэн харах вэ"
          >
            <option value="private">Хувийн</option>
            <option value="unlisted">Холбоосоор</option>
            <option value="public">Нийтийн</option>
          </select>
          <button type="submit" disabled={!title.trim()} className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
            Үүсгэх
          </button>
        </form>
      )}
      {loading ? (
        <p className="text-neutral-400">Ачаалж байна…</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {(data ?? []).map((c) => (
            <Link key={c.list} href={`/playlist?list=${encodeURIComponent(c.list)}`} className="group block">
              <div className="relative">
                {c.cover ? (
                  <Thumbnail video={{...c.cover, duration: 0}} />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl bg-neutral-800 text-neutral-500">
                    {c.icon === 'later' ? <Clock size={40} /> : <ListVideo size={40} />}
                  </div>
                )}
                <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium">
                  {c.icon === 'later' ? <Clock size={12} /> : <ListVideo size={12} />} {c.count}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 font-semibold">{c.title}</p>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-neutral-400">
                {c.icon === 'later' ? 'Хувийн' : <VisibilityBadge value={c.visibility === 'public' ? undefined : c.visibility} />}
                <span>Жагсаалтыг үзэх</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
