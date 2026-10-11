import {Bookmark, Check, ChevronDown, ChevronUp, Flag, Gauge, Lock, Pencil, Share2, SkipForward, ThumbsDown, ThumbsUp} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import Avatar from '../components/Avatar';
import Comments from '../components/Comments';
import RichText from '../components/RichText';
import SubscribeButton, {subscriberLabel} from '../components/SubscribeButton';
import {EmptyState, VideoCard, VideoRow, videoHref} from '../components/VideoCard';
import EditVideoModal from '../components/EditVideoModal';
import VideoPlayer from '../components/VideoPlayer';
import {VisibilityBadge} from '../components/Visibility';
import PlaylistPanel from '../components/PlaylistPanel';
import ReportDialog from '../components/ReportDialog';
import SaveToPlaylist from '../components/SaveToPlaylist';
import {signIn, useUser} from '../lib/auth';
import {loadPlaylist, playHref} from '../lib/library';
import {api} from '../lib/api';
import {formatCount, formatViews, timeAgo} from '../lib/format';
import {prefs, SPEEDS} from '../lib/playback';
import {Link, navigate} from '../lib/router';
import {history} from '../lib/storage';
import type {Video} from '../lib/types';
import {useAsync} from '../lib/useAsync';
import {useReactions} from '../lib/useReactions';

export default function Watch({id, highlight, startAt, list}: {id: string; highlight?: string; startAt?: number; list?: string}) {
  const {data, error, loading} = useAsync(() => api.get(id), [id]);
  const related = useAsync(() => api.list(), [id]);
  const playlist = useAsync(() => (list ? loadPlaylist(list) : Promise.resolve(null)), [list]);
  const [video, setVideo] = useState<Video | null>(null);
  const [subs, setSubs] = useState<number | null>(null);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  // On phones comments start collapsed behind a summary card, like the YouTube app.
  const [commentsOpen, setCommentsOpen] = useState(!!highlight);
  const [speed, setSpeed] = useState(prefs.speed);
  const [autoplayNext, setAutoplayNext] = useState(prefs.autoplay);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const {user, ready} = useUser();

  useEffect(() => setVideo(data ?? null), [data]);
  useEffect(() => {
    if (highlight) setCommentsOpen(true);
  }, [highlight]);

  useEffect(() => {
    if (!data) return;
    document.title = `${data.title} - Batnab`;
    history.push(data.id);
    api.view(data.id).then((views) => setVideo((v) => (v ? {...v, views} : v)), () => {});
    return () => {
      document.title = 'Batnab';
    };
  }, [data]);

  const others = (related.data ?? []).filter((v) => v.id !== video?.id);
  // Inside a playlist, "next" is the following item (and stops at the end); otherwise the top suggestion.
  const listVideos = playlist.data?.videos;
  const listIndex = listVideos ? listVideos.findIndex((v) => v.id === id) : -1;
  const next = listVideos && listIndex >= 0 ? listVideos[listIndex + 1] : others[0];
  const playNext = useCallback(() => {
    if (!next) return;
    navigate(playlist.data && listIndex >= 0 ? playHref(next, playlist.data.list) : videoHref(next));
  }, [next, playlist.data, listIndex]);

  if (loading)
    return <div className="-mx-4 -mt-4 aspect-video animate-pulse bg-neutral-800 sm:mx-0 sm:mt-0 sm:max-w-5xl sm:rounded-xl" />;
  if (error || !video) return <EmptyState title="Бичлэг олдсонгүй">{error}</EmptyState>;
  const isOwner = user?.uid === video.uid;
  if (video.visibility === 'private' && !isOwner) {
    if (!ready) return null;
    return (
      <EmptyState title="Энэ бичлэг хувийн байна">
        <span className="inline-flex items-center gap-2">
          <Lock size={16} /> Зөвхөн бичлэгийн эзэн үзэх боломжтой.
        </span>
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1700px] flex-col gap-6 xl:flex-row">
      <div className="min-w-0 flex-1">
        {/* Edge-to-edge and pinned under the header on phones; rounded card from sm up. */}
        <div className="sticky top-14 z-20 -mx-4 -mt-4 bg-black sm:static sm:mx-0 sm:mt-0 sm:rounded-xl">
          <VideoPlayer
            video={video}
            startAt={startAt}
            speed={speed}
            next={next}
            autoplayNext={autoplayNext}
            onPlayNext={playNext}
          />
        </div>
        <h1 className="mt-3 break-words text-lg font-bold leading-snug sm:text-xl">{video.title}</h1>
        {video.visibility && video.visibility !== 'public' && (
          <div className="mt-1">
            <VisibilityBadge value={video.visibility} />
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/channel/${video.uid}`} className="flex min-w-0 flex-1 items-center gap-3 lg:flex-initial">
              <Avatar name={video.channel} photo={video.channelPhoto} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{video.channel}</p>
                {subs !== null && <p className="text-xs text-neutral-400">{subscriberLabel(subs)}</p>}
              </div>
            </Link>
            <SubscribeButton channel={{uid: video.uid, name: video.channel, photo: video.channelPhoto}} onCount={setSubs} />
          </div>
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&>*]:shrink-0">
            {isOwner && (
              <button
                onClick={() => setEditing(true)}
                className="flex h-9 items-center gap-2 rounded-full bg-neutral-800 px-4 text-sm font-medium hover:bg-neutral-700"
              >
                <Pencil size={16} /> Засах
              </button>
            )}
            <Reactions key={video.id} videoId={video.id} />
            <ShareButton />
            <button
              onClick={() => (user ? setSaving(true) : signIn())}
              className="flex h-9 items-center gap-2 rounded-full bg-neutral-800 px-4 text-sm font-medium hover:bg-neutral-700"
            >
              <Bookmark size={16} /> Хадгалах
            </button>
            {!isOwner && (
              <button
                onClick={() => (user ? setReporting(true) : signIn())}
                className="flex h-9 items-center gap-2 rounded-full bg-neutral-800 px-4 text-sm font-medium hover:bg-neutral-700"
              >
                <Flag size={16} /> Мэдээлэх
              </button>
            )}
            <label className="flex h-9 items-center gap-1.5 rounded-full bg-neutral-800 pl-3 pr-1 text-sm font-medium hover:bg-neutral-700" title="Тоглуулах хурд">
              <Gauge size={18} />
              <select
                value={speed}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setSpeed(s);
                  prefs.setSpeed(s);
                }}
                className="h-full cursor-pointer appearance-none bg-transparent pr-2 outline-none"
                aria-label="Тоглуулах хурд"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s} className="bg-neutral-800">
                    {s === 1 ? 'Хэвийн' : `${s}×`}
                  </option>
                ))}
              </select>
            </label>
            <button
              role="switch"
              aria-checked={autoplayNext}
              onClick={() => {
                setAutoplayNext(!autoplayNext);
                prefs.setAutoplay(!autoplayNext);
              }}
              className="flex h-9 items-center gap-2 rounded-full bg-neutral-800 px-3 text-sm font-medium hover:bg-neutral-700"
              title="Бичлэг дуусахад дараагийнхыг автоматаар тоглуулах"
            >
              <SkipForward size={18} />
              Автомат
              <span className={`relative h-4 w-7 rounded-full transition-colors ${autoplayNext ? 'bg-blue-500' : 'bg-neutral-600'}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${autoplayNext ? 'left-3.5' : 'left-0.5'}`} />
              </span>
            </button>
          </div>
        </div>

        <Description key={`d-${video.id}`} video={video} />

        <button
          onClick={() => setCommentsOpen(!commentsOpen)}
          className="mt-4 flex w-full items-center justify-between rounded-xl bg-neutral-800/80 px-3 py-3 text-left text-sm lg:hidden"
          aria-expanded={commentsOpen}
        >
          <span className="font-semibold">
            Сэтгэгдэл <span className="font-normal text-neutral-400">{commentCount ?? ''}</span>
          </span>
          {commentsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        <div className={commentsOpen ? '' : 'hidden lg:block'}>
          <Comments key={`c-${video.id}`} video={video} highlight={highlight} onCount={setCommentCount} />
        </div>
      </div>

      <aside className="w-full shrink-0 xl:w-[400px]">
        {playlist.data && listIndex >= 0 && <PlaylistPanel data={playlist.data} currentId={video.id} />}
        <h2 className="mb-3 font-semibold xl:hidden">Дараагийн бичлэгүүд</h2>
        {/* Big cards on phones, compact rows from sm up. */}
        <div className="space-y-6 sm:hidden">
          {others.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
        <div className="hidden space-y-3 sm:block">
          {others.map((v) => (
            <VideoRow key={v.id} video={v} compact />
          ))}
        </div>
      </aside>
      {editing && <EditVideoModal video={video} onClose={() => setEditing(false)} onSaved={setVideo} />}
      {saving && <SaveToPlaylist video={video} onClose={() => setSaving(false)} />}
      {reporting && (
        <ReportDialog target={{type: 'video', videoId: video.id, videoTitle: video.title}} onClose={() => setReporting(false)} />
      )}
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
  const description = video.description ?? '';
  const long = description.length > 200 || description.split('\n').length > 3;
  return (
    <div
      className={`mt-4 rounded-xl bg-neutral-800/80 p-3 text-sm ${long && !open ? 'cursor-pointer hover:bg-neutral-700/80' : ''}`}
      onClick={() => long && !open && setOpen(true)}
    >
      <p className="font-semibold">
        {formatCount(video.views)} үзэлт • {timeAgo(video.createdAt)}
      </p>
      {description && (
        <p className={`mt-1 whitespace-pre-wrap break-words ${open ? '' : 'line-clamp-3'}`}>
          <RichText text={description} timestamps />
        </p>
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
