import {Check, ChevronRight, Folder, PlayCircle} from 'lucide-react';
import {useState} from 'react';
import Loading from '../components/Loading';
import {InactiveNote, LockedNote} from '../components/Notices';
import SolveCard from '../components/SolveCard';
import VideoEmbed, {canSeek, videoSource} from '../components/VideoEmbed';
import {Link, navigate, useLocation} from '../lib/router';
import {useSession} from '../lib/session';
import {forClassOf, useTopics} from '../lib/topics';
import {answerVideo, markWatched, timeLabel, usePublishedVideoFolders, useVideoAnswers, useVideos, useWatched, videoKey, type Video} from '../lib/videos';

const to = (fid: string, vid = '') => (fid ? `/videos?folder=${encodeURIComponent(fid)}${vid ? `&v=${encodeURIComponent(vid)}` : ''}` : '/videos');

/** A video's small picture: YouTube's own, else a play sign. */
function Thumb({url}: {url: string}) {
  const s = videoSource(url);
  return (
    <span className="relative flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-800 sm:w-36">
      {s?.kind === 'youtube' && <img src={`https://i.ytimg.com/vi/${s.id}/mqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      <PlayCircle size={26} className="relative text-white drop-shadow" />
    </span>
  );
}

/**
 * /videos «Видео хичээл»: the folders of videos the teacher has published, each video with its points to jump to and
 * problems to check it was understood; and the videos in the lessons of the student's topics.
 */
export default function Videos() {
  const session = useSession();
  const q = useLocation().query;
  const at = q.get('folder') ?? '';
  const vid = q.get('v') ?? '';
  const ok = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  const folders = usePublishedVideoFolders(ok);
  const watched = useWatched(ok && !session.admin ? session.user!.uid : undefined);
  const topics = useTopics();
  if (!session.ready) return <Loading />;
  if (!session.user) return <LockedNote text="Видео хичээлийг үзэхийн тулд нэвтэрнэ үү." />;
  if (!session.admin && (!session.profile || session.profile.disabled)) return <InactiveNote blocked={!!session.profile?.disabled} />;
  const uid = session.admin ? null : session.user.uid;
  const folder = folders?.find((f) => f.id === at);
  // The lessons' videos (not a problem's explanation: that is for after answering it).
  const lessonVideos = (topics ?? [])
    .filter((t) => (session.admin ? t.published : forClassOf(t, session.profile?.class)))
    .flatMap((t) => t.lesson.flatMap((b, i) => (b.t === 'vid' && videoSource(b.url) ? [{t, url: b.url, key: `${t.id}-${i}`}] : [])));
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-4 sm:py-6" data-videos>
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
          <PlayCircle size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Видео хичээл</h1>
          <p className="text-sm text-neutral-400">{session.admin ? 'Сурагчид ингэж харна: зөвхөн нийтэлсэн хавтсууд. Засах бол багшийн самбарын «Видео» хэсэгт орно.' : 'Багшийн бэлдсэн видеонууд. Үзээд, доорх бодлогоор ойлгосноо шалгаарай.'}</p>
        </div>
      </header>
      {!folders ? (
        <Loading small />
      ) : at && !folder ? (
        <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">
          Энэ хавтас олдсонгүй.{' '}
          <button type="button" onClick={() => navigate('/videos')} className="text-blue-400 underline">
            Буцах
          </button>
        </p>
      ) : folder ? (
        <>
          <nav aria-label="Байршил" className="flex flex-wrap items-center gap-1 text-sm">
            <Link href="/videos" className="text-blue-400 hover:underline">
              Видео хичээл
            </Link>
            <ChevronRight size={14} className="text-neutral-500" />
            {vid ? (
              <Link href={to(folder.id)} className="text-blue-400 hover:underline">
                {folder.name}
              </Link>
            ) : (
              <span className="font-semibold">{folder.name}</span>
            )}
          </nav>
          <FolderVideos fid={folder.id} vid={vid} uid={uid} watched={(watched ?? {}) as Record<string, unknown>} />
        </>
      ) : (
        <>
          {folders.length > 0 && (
            <section className="grid gap-2 sm:grid-cols-2" aria-label="Хавтсууд">
              {folders.map((f) => (
                <Link key={f.id} href={to(f.id)} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-4 hover:bg-neutral-800" data-video-folder={f.id}>
                  <Folder size={20} className="shrink-0 text-rose-300" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                  <ChevronRight size={16} className="shrink-0 text-neutral-500" />
                </Link>
              ))}
            </section>
          )}
          {lessonVideos.length > 0 && (
            <section className="space-y-2" aria-label="Сэдвийн видео" data-lesson-videos>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Сэдвийн хичээлийн видео</h2>
              <ul className="space-y-2">
                {lessonVideos.map((x) => (
                  <li key={x.key}>
                    <Link href={`/topics/${x.t.id}`} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-3 hover:bg-neutral-800">
                      <Thumb url={x.url} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{x.t.title}</span>
                        <span className="text-sm text-neutral-400">Сэдвийн хичээл дотор</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-neutral-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!folders.length && !lessonVideos.length && <p className="rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">Багш одоогоор видео нийтлээгүй байна.</p>}
        </>
      )}
    </div>
  );
}

function FolderVideos({fid, vid, uid, watched}: {fid: string; vid: string; uid: string | null; watched: Record<string, unknown>}) {
  const videos = useVideos(fid);
  if (!videos) return <Loading small />;
  const v = vid ? videos.find((x) => x.id === vid) : null;
  if (vid && !v) return <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Энэ видео устгагдсан байна.</p>;
  if (v) return <OneVideo v={v} uid={uid} seen={!!watched[v.id]} />;
  if (!videos.length) return <p className="rounded-2xl bg-neutral-900 p-6 text-center text-sm text-neutral-400">Энэ хавтсанд видео алга.</p>;
  const seen = videos.filter((x) => watched[x.id]).length;
  return (
    <section className="space-y-2" aria-label="Видеонууд">
      {uid && (
        <p className="text-sm text-neutral-400" data-video-progress>
          {videos.length} видео · {seen} үзсэн
        </p>
      )}
      <ul className="space-y-2">
        {videos.map((x) => (
          <li key={x.id}>
            <Link href={to(fid, x.id)} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-3 hover:bg-neutral-800" data-video-item={x.id}>
              <Thumb url={x.url} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{x.title}</span>
                <span className="flex flex-wrap gap-x-2 text-sm text-neutral-400">
                  {x.marks.length > 0 && <span>{x.marks.length} хэсэг</span>}
                  {x.problems.length > 0 && <span>{x.problems.length} бодлого</span>}
                </span>
              </span>
              {watched[x.id] ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-300">
                  <Check size={12} /> Үзсэн
                </span>
              ) : (
                <ChevronRight size={16} className="shrink-0 text-neutral-500" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OneVideo({v, uid, seen}: {v: Video; uid: string | null; seen: boolean}) {
  const [jump, setJump] = useState<{t: number; n: number} | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const answers = useVideoAnswers(uid);
  const seek = canSeek(videoSource(v.url));
  const toggle = () => {
    if (!uid) return;
    setBusy(true);
    setError('');
    markWatched(uid, v, !seen).then(
      () => setBusy(false),
      (e) => {
        setBusy(false);
        setError(`Хадгалж чадсангүй: ${(e as Error).message}`);
      },
    );
  };
  return (
    <article className="space-y-4" data-video-view={v.id}>
      <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">{v.title}</h2>
      <VideoEmbed link={v.url} title="Видеог тоглуулах" at={jump} />
      {v.marks.length > 0 && (
        <section aria-label="Видеоны хэсгүүд" className="space-y-1.5">
          <h3 className="text-sm font-semibold text-neutral-400">Хэсгүүд{seek ? ' (дарахад тэндээс эхэлнэ)' : ''}</h3>
          <ul className="flex flex-col gap-1">
            {v.marks.map((m, i) =>
              seek ? (
                <li key={i}>
                  <button type="button" onClick={() => setJump((j) => ({t: m.t, n: (j?.n ?? 0) + 1}))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-neutral-800" data-video-mark={m.t}>
                    <span className="w-14 shrink-0 font-semibold tabular-nums text-rose-300">{timeLabel(m.t)}</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{m.label}</span>
                  </button>
                </li>
              ) : (
                <li key={i} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-14 shrink-0 font-semibold tabular-nums text-rose-300">{timeLabel(m.t)}</span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{m.label}</span>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
      {v.note && <p className="whitespace-pre-line text-neutral-300">{v.note}</p>}
      {uid && (
        <div>
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-pressed={seen}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60 ${seen ? 'bg-green-500/15 text-green-300 hover:bg-green-500/25' : 'bg-blue-500 text-black hover:bg-blue-400'}`}
            data-watch
          >
            <Check size={16} /> {seen ? 'Үзсэн' : 'Үзсэн гэж тэмдэглэх'}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
      )}
      {v.problems.length > 0 && (
        <section className="space-y-3 border-t border-neutral-800 pt-4" aria-label="Ойлгосноо шалгах">
          <h3 className="font-semibold">Ойлгосноо шалгах</h3>
          {!uid && <p className="text-xs text-neutral-500">Сурагч энд хариулаад шууд зөв, буруугаа харна.</p>}
          <ol className="space-y-3">
            {v.problems.map((p, i) => (
              <SolveCard key={p.id} p={p} num={i + 1} uid={uid} answer={answers?.[p.id]} send={(a) => answerVideo(uid!, v, p.id, a)} readKey={() => videoKey(v, p.id)} />
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
