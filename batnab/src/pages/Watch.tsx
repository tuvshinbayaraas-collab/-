import {Check, Share2, ThumbsDown, ThumbsUp} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import Avatar from '../components/Avatar';
import {EmptyState, VideoRow} from '../components/VideoCard';
import {api} from '../lib/api';
import {formatCount, formatViews, timeAgo} from '../lib/format';
import {Link} from '../lib/router';
import {storage, type Reaction} from '../lib/storage';
import type {Comment, Video} from '../lib/types';
import {useAsync} from '../lib/useAsync';

export default function Watch({id}: {id: string}) {
  const {data, error, loading} = useAsync(() => api.get(id), [id]);
  const related = useAsync(() => api.list(), [id]);
  const [video, setVideo] = useState<Video | null>(null);

  useEffect(() => setVideo(data ?? null), [data]);

  useEffect(() => {
    if (!data) return;
    document.title = `${data.title} - Batnab`;
    storage.pushHistory(data.id);
    api.view(data.id).then(({views}) => setVideo((v) => (v ? {...v, views} : v)), () => {});
    return () => {
      document.title = 'Batnab';
    };
  }, [data]);

  if (loading) return <div className="aspect-video w-full max-w-5xl animate-pulse rounded-xl bg-neutral-800" />;
  if (error || !video) return <EmptyState title="Бичлэг олдсонгүй">{error}</EmptyState>;

  const others = (related.data ?? []).filter((v) => v.id !== video.id);

  return (
    <div className="mx-auto flex max-w-[1700px] flex-col gap-6 xl:flex-row">
      <div className="min-w-0 flex-1">
        <video
          key={video.id}
          src={video.videoUrl}
          poster={video.thumbnailUrl ?? undefined}
          controls
          autoPlay
          playsInline
          className="aspect-video w-full rounded-xl bg-black"
        />
        <h1 className="mt-3 text-xl font-bold leading-snug">{video.title}</h1>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Link href={`/channel/${encodeURIComponent(video.channel)}`} className="flex items-center gap-3">
            <Avatar name={video.channel} size={40} />
            <span className="font-semibold">{video.channel}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Reactions key={video.id} video={video} onChange={(likes, dislikes) => setVideo((v) => v && {...v, likes, dislikes})} />
            <ShareButton />
          </div>
        </div>

        <Description key={`d-${video.id}`} video={video} />
        <Comments key={`c-${video.id}`} video={video} />
      </div>

      <aside className="w-full shrink-0 space-y-3 xl:w-[400px]">
        {others.map((v) => (
          <VideoRow key={v.id} video={v} compact />
        ))}
      </aside>
    </div>
  );
}

function Reactions({video, onChange}: {video: Video; onChange: (likes: number, dislikes: number) => void}) {
  const [reaction, setReaction] = useState<Reaction>(() => storage.getReaction(video.id));

  const toggle = async (next: 'like' | 'dislike') => {
    const target: Reaction = reaction === next ? null : next;
    const likes = (target === 'like' ? 1 : 0) - (reaction === 'like' ? 1 : 0);
    const dislikes = (target === 'dislike' ? 1 : 0) - (reaction === 'dislike' ? 1 : 0);
    setReaction(target);
    storage.setReaction(video.id, target);
    onChange(video.likes + likes, video.dislikes + dislikes);
    try {
      const res = await api.react(video.id, likes, dislikes);
      onChange(res.likes, res.dislikes);
    } catch {
      setReaction(reaction);
      storage.setReaction(video.id, reaction);
      onChange(video.likes, video.dislikes);
    }
  };

  return (
    <div className="flex h-9 items-center rounded-full bg-neutral-800 text-sm font-medium">
      <button
        onClick={() => toggle('like')}
        className="flex h-full items-center gap-2 rounded-l-full pl-4 pr-3 hover:bg-neutral-700"
        aria-pressed={reaction === 'like'}
        title="Таалагдлаа"
      >
        <ThumbsUp size={18} fill={reaction === 'like' ? 'currentColor' : 'none'} />
        {formatViews(video.likes)}
      </button>
      <span className="h-6 w-px bg-neutral-600" />
      <button
        onClick={() => toggle('dislike')}
        className="flex h-full items-center rounded-r-full pl-3 pr-4 hover:bg-neutral-700"
        aria-pressed={reaction === 'dislike'}
        title="Таалагдсангүй"
      >
        <ThumbsDown size={18} fill={reaction === 'dislike' ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Холбоосыг хуулна уу:', location.href);
    }
  };
  return (
    <button
      onClick={share}
      className="flex h-9 items-center gap-2 rounded-full bg-neutral-800 px-4 text-sm font-medium hover:bg-neutral-700"
    >
      {copied ? <Check size={18} /> : <Share2 size={18} />}
      {copied ? 'Хуулагдлаа' : 'Хуваалцах'}
    </button>
  );
}

function Description({video}: {video: Video}) {
  const [open, setOpen] = useState(false);
  const long = video.description.length > 200 || video.description.split('\n').length > 3;
  return (
    <div
      className={`mt-4 rounded-xl bg-neutral-800/80 p-3 text-sm ${long && !open ? 'cursor-pointer hover:bg-neutral-700/80' : ''}`}
      onClick={() => long && !open && setOpen(true)}
    >
      <p className="font-semibold">
        {formatCount(video.views)} үзэлт • {timeAgo(video.createdAt)}
      </p>
      {video.description && (
        <p className={`mt-1 whitespace-pre-wrap break-words ${open ? '' : 'line-clamp-3'}`}>{video.description}</p>
      )}
      {long && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className="mt-1 font-semibold"
        >
          {open ? 'Хураах' : '...цааш нь'}
        </button>
      )}
    </div>
  );
}

function Comments({video}: {video: Video}) {
  const [comments, setComments] = useState<Comment[]>(video.comments ?? []);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(() => storage.getChannel());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const name = author.trim() || 'Зочин';
      const comment = await api.comment(video.id, name, text);
      if (author.trim() && !storage.getChannel()) storage.setChannel(author.trim());
      setComments((c) => [comment, ...c]);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold">{comments.length} сэтгэгдэл</h2>
      <form onSubmit={submit} className="mt-4 flex gap-3">
        <Avatar name={author || 'Зочин'} size={40} />
        <div className="flex-1 space-y-2">
          {!storage.getChannel() && (
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Таны нэр (заавал биш)"
              maxLength={50}
              className="w-full border-b border-neutral-700 bg-transparent pb-1 text-sm outline-none focus:border-white"
            />
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сэтгэгдэл бичих…"
            rows={1}
            maxLength={2000}
            className="w-full resize-none border-b border-neutral-700 bg-transparent pb-1 text-sm outline-none focus:border-white"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {text && (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setText('')} className="rounded-full px-4 py-2 text-sm hover:bg-neutral-800">
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
              >
                Сэтгэгдэл үлдээх
              </button>
            </div>
          )}
        </div>
      </form>

      <ul className="mt-6 space-y-5">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.author} size={40} />
            <div className="min-w-0">
              <p className="text-[13px]">
                <span className="font-semibold">@{c.author}</span>{' '}
                <span className="text-neutral-400">{timeAgo(c.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
