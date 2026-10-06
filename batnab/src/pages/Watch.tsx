import {Check, Share2, ThumbsDown, ThumbsUp, Trash2} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import Avatar from '../components/Avatar';
import SubscribeButton, {subscriberLabel} from '../components/SubscribeButton';
import {EmptyState, VideoRow} from '../components/VideoCard';
import {api, errorMessage} from '../lib/api';
import {displayName, signIn, useUser} from '../lib/auth';
import {formatCount, formatViews, timeAgo} from '../lib/format';
import {Link} from '../lib/router';
import {drivePlayerUrl} from '../lib/drive';
import {history} from '../lib/storage';
import type {Comment, Video} from '../lib/types';
import {useAsync} from '../lib/useAsync';
import {useReactions} from '../lib/useReactions';

export default function Watch({id}: {id: string}) {
  const {data, error, loading} = useAsync(() => api.get(id), [id]);
  const related = useAsync(() => api.list(), [id]);
  const [video, setVideo] = useState<Video | null>(null);
  const [subs, setSubs] = useState<number | null>(null);

  useEffect(() => setVideo(data ?? null), [data]);

  useEffect(() => {
    if (!data) return;
    document.title = `${data.title} - Batnab`;
    history.push(data.id);
    api.view(data.id).then((views) => setVideo((v) => (v ? {...v, views} : v)), () => {});
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
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            key={video.id}
            src={drivePlayerUrl(video.driveId)}
            title={video.title}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
        {Date.now() - video.createdAt < 20 * 60 * 1000 && (
          <p className="mt-2 text-xs text-neutral-400">
            Шинэ бичлэг: Google Drive боловсруулж дуусаагүй бол хэдэн минутын дараа хуудсаа дахин ачаална уу.
          </p>
        )}
        <h1 className="mt-3 text-xl font-bold leading-snug">{video.title}</h1>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/channel/${video.uid}`} className="flex min-w-0 items-center gap-3">
              <Avatar name={video.channel} photo={video.channelPhoto} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{video.channel}</p>
                {subs !== null && <p className="text-xs text-neutral-400">{subscriberLabel(subs)}</p>}
              </div>
            </Link>
            <SubscribeButton channel={{uid: video.uid, name: video.channel, photo: video.channelPhoto}} onCount={setSubs} />
          </div>
          <div className="flex items-center gap-2">
            <Reactions key={video.id} videoId={video.id} />
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

function Reactions({videoId}: {videoId: string}) {
  const state = useReactions(videoId);
  const toggle = state.toggle;

  return (
    <div className="flex h-9 items-center rounded-full bg-neutral-800 text-sm font-medium">
      <button
        onClick={() => toggle('like')}
        className="flex h-full items-center gap-2 rounded-l-full pl-4 pr-3 hover:bg-neutral-700"
        aria-pressed={state.mine === 'like'}
        title="Таалагдлаа"
      >
        <ThumbsUp size={18} fill={state.mine === 'like' ? 'currentColor' : 'none'} />
        {formatViews(state.likes)}
      </button>
      <span className="h-6 w-px bg-neutral-600" />
      <button
        onClick={() => toggle('dislike')}
        className="flex h-full items-center rounded-r-full pl-3 pr-4 hover:bg-neutral-700"
        aria-pressed={state.mine === 'dislike'}
        title="Таалагдсангүй"
      >
        <ThumbsDown size={18} fill={state.mine === 'dislike' ? 'currentColor' : 'none'} />
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
  const {user} = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.comments(video.id).then(setComments, () => {});
  }, [video.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setBusy(true);
    setError('');
    try {
      const comment = await api.comment(video.id, text);
      setComments((c) => [comment, ...c]);
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Comment) => {
    if (!confirm('Сэтгэгдлийг устгах уу?')) return;
    try {
      await api.deleteComment(video.id, c.id);
      setComments((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold">{comments.length} сэтгэгдэл</h2>
      {user ? (
        <form onSubmit={submit} className="mt-4 flex gap-3">
          <Avatar name={displayName(user)} photo={user.photoURL} size={40} />
          <div className="flex-1 space-y-2">
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
      ) : (
        <p className="mt-4 text-sm text-neutral-400">
          <button onClick={signIn} className="font-semibold text-blue-400 hover:underline">
            Нэвтэрч
          </button>{' '}
          сэтгэгдэл үлдээнэ үү.
        </p>
      )}

      <ul className="mt-6 space-y-5">
        {comments.map((c) => (
          <li key={c.id} className="group flex gap-3">
            <Avatar name={c.author} photo={c.photo} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px]">
                <span className="font-semibold">@{c.author}</span>{' '}
                <span className="text-neutral-400">{timeAgo(c.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.text}</p>
            </div>
            {user && (user.uid === c.uid || user.uid === video.uid) && (
              <button
                onClick={() => remove(c)}
                className="self-start rounded-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Сэтгэгдэл устгах"
                title="Устгах"
              >
                <Trash2 size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
