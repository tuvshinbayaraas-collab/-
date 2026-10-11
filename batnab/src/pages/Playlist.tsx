import {Check, Lock, Pencil, Play, Share2, Shuffle, Trash2, X} from 'lucide-react';
import {useState} from 'react';
import Avatar from '../components/Avatar';
import Thumbnail from '../components/Thumbnail';
import {EmptyState} from '../components/VideoCard';
import {VisibilityBadge, VisibilityPicker} from '../components/Visibility';
import {errorMessage} from '../lib/api';
import {useUser} from '../lib/auth';
import {formatViews, timeAgo} from '../lib/format';
import {loadPlaylist, playHref, playlists, watchLater, type LoadedPlaylist} from '../lib/library';
import {Link, navigate} from '../lib/router';
import type {Video, Visibility} from '../lib/types';
import {useAsync} from '../lib/useAsync';

export default function PlaylistPage({list}: {list: string}) {
  const {user, ready} = useUser();
  const [version, setVersion] = useState(0);
  const {data, error, loading} = useAsync(() => (ready ? loadPlaylist(list) : new Promise<LoadedPlaylist>(() => {})), [list, ready, user?.uid, version]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) return <p className="text-neutral-400">Ачаалж байна…</p>;
  if (error || !data) return <EmptyState title={error || 'Жагсаалт олдсонгүй'} />;

  const isOwner = user?.uid === data.ownerUid;
  const videos = data.videos.filter((v) => !removed.includes(v.id));
  const cover = videos[0];

  const removeItem = async (v: Video) => {
    setRemoved((r) => [...r, v.id]);
    try {
      if (data.isWatchLater) await watchLater.set(v.id, false);
      else await playlists.setItem(data.playlist!.id, v.id, false);
    } catch (e) {
      setRemoved((r) => r.filter((x) => x !== v.id));
      alert(errorMessage(e));
    }
  };

  const share = async () => {
    const url = `${location.origin}/playlist?list=${encodeURIComponent(list)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Холбоосыг хуулна уу:', url);
    }
  };

  const shuffle = () => {
    const pick = videos[Math.floor(Math.random() * videos.length)];
    if (pick) navigate(playHref(pick, list));
  };

  const del = async () => {
    if (!data.playlist || !confirm(`«${data.title}» жагсаалтыг устгах уу? Бичлэгүүд өөрсдөө устахгүй.`)) return;
    try {
      await playlists.remove(data.playlist.id);
      navigate('/playlists');
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 rounded-2xl bg-gradient-to-b from-neutral-700/60 to-neutral-900 p-5 lg:sticky lg:top-20 lg:w-[360px]">
        {cover ? <Thumbnail video={cover} className="w-full" /> : <div className="aspect-video rounded-xl bg-neutral-800" />}
        <h1 className="mt-4 break-words text-2xl font-bold">{data.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Avatar name={data.ownerName} photo={data.ownerPhoto} size={24} />
          <Link href={`/channel/${data.ownerUid}`} className="font-semibold hover:underline">
            {data.ownerName}
          </Link>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-300">
          {data.isWatchLater ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <Lock size={12} /> Хувийн
            </span>
          ) : (
            <VisibilityBadge value={data.visibility === 'public' ? undefined : data.visibility} />
          )}
          {videos.length} бичлэг
        </p>
        {data.description && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{data.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => cover && navigate(playHref(cover, list))}
            disabled={!cover}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            <Play size={16} fill="currentColor" /> Бүгдийг тоглуулах
          </button>
          <button
            onClick={shuffle}
            disabled={!cover}
            className="flex items-center gap-2 rounded-full bg-neutral-700 px-4 py-2 text-sm font-semibold hover:bg-neutral-600 disabled:opacity-50"
          >
            <Shuffle size={16} /> Холих
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!data.isWatchLater && data.visibility !== 'private' && (
            <button onClick={share} className="flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
              {copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? 'Хуулагдлаа' : 'Хуваалцах'}
            </button>
          )}
          {isOwner && data.playlist && (
            <>
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
                <Pencil size={16} /> Засах
              </button>
              <button onClick={del} className="flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-1.5 text-sm hover:bg-red-600">
                <Trash2 size={16} /> Устгах
              </button>
            </>
          )}
        </div>
      </aside>

      <ol className="min-w-0 flex-1 space-y-2">
        {!videos.length && <EmptyState title="Энэ жагсаалт хоосон байна" />}
        {videos.map((v, i) => (
          <li key={v.id} className="group flex items-center gap-3 rounded-xl p-2 hover:bg-neutral-800/60">
            <span className="w-6 shrink-0 text-center text-sm text-neutral-400">{i + 1}</span>
            <Link href={playHref(v, list)} className="flex min-w-0 flex-1 gap-3">
              <Thumbnail video={v} className="w-36 shrink-0 rounded-lg sm:w-40" />
              <span className="min-w-0">
                <span className="line-clamp-2 font-medium">{v.title}</span>
                <span className="mt-1 block text-xs text-neutral-400">
                  {v.channel} • {formatViews(v.views)} үзэлт • {timeAgo(v.createdAt)}
                </span>
              </span>
            </Link>
            {isOwner && (
              <button
                onClick={() => removeItem(v)}
                className="rounded-full p-2 text-neutral-400 hover:bg-neutral-700 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                aria-label="Жагсаалтаас хасах"
                title="Жагсаалтаас хасах"
              >
                <X size={18} />
              </button>
            )}
          </li>
        ))}
      </ol>

      {editing && data.playlist && (
        <EditPlaylist
          title={data.title}
          description={data.description ?? ''}
          visibility={data.visibility}
          onClose={() => setEditing(false)}
          onSave={async (c) => {
            await playlists.edit(data.playlist!.id, c);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

function EditPlaylist(props: {
  title: string;
  description: string;
  visibility: Visibility;
  onClose: () => void;
  onSave: (c: {title: string; description: string; visibility: Visibility}) => Promise<void>;
}) {
  const [title, setTitle] = useState(props.title);
  const [description, setDescription] = useState(props.description);
  const [visibility, setVisibility] = useState(props.visibility);
  const [error, setError] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={props.onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          try {
            await props.onSave({title, description, visibility});
            props.onClose();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
        className="w-full max-w-lg space-y-4 rounded-t-2xl bg-neutral-900 p-5 sm:rounded-2xl"
        aria-label="Жагсаалт засах"
      >
        <h2 className="text-lg font-bold">Жагсаалт засах</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          className="w-full rounded-lg border border-neutral-700 bg-transparent px-3 py-2 outline-none focus:border-white"
          aria-label="Нэр"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Тайлбар"
          className="w-full resize-y rounded-lg border border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-white"
        />
        <VisibilityPicker value={visibility} onChange={setVisibility} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-full px-4 py-2 text-sm hover:bg-neutral-800">
            Цуцлах
          </button>
          <button type="submit" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200">
            Хадгалах
          </button>
        </div>
      </form>
    </div>
  );
}
