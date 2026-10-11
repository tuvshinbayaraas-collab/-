import {get, ref} from 'firebase/database';
import {ExternalLink, Flag, ShieldCheck, Trash2, X} from 'lucide-react';
import {useState} from 'react';
import Thumbnail from '../components/Thumbnail';
import {EmptyState} from '../components/VideoCard';
import {api, errorMessage} from '../lib/api';
import {useUser} from '../lib/auth';
import {db} from '../lib/firebase';
import {timeAgo} from '../lib/format';
import {
  dismissReports,
  listReports,
  REASONS,
  removeCommentAsAdmin,
  removeVideoAsAdmin,
  useIsAdmin,
  type Report,
} from '../lib/moderation';
import {Link} from '../lib/router';
import type {Video} from '../lib/types';
import {useAsync} from '../lib/useAsync';

interface Case {
  key: string;
  type: 'video' | 'comment';
  videoId: string;
  commentId?: string;
  reports: Report[];
  video: Video | null;
  comment: {author: string; text: string} | null;
}

/** Reports grouped by the video/comment they're about, most-reported first. */
async function loadCases(): Promise<Case[]> {
  const reports = await listReports();
  const groups = new Map<string, Report[]>();
  for (const r of reports) {
    const key = `${r.videoId}/${r.commentId ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const cases = await Promise.all(
    [...groups.entries()].map(async ([key, rs]) => {
      const {videoId, commentId, type} = rs[0];
      const [video, comment] = await Promise.all([
        api.get(videoId).catch(() => null),
        commentId ? get(ref(db, `comments/${videoId}/${commentId}`)).then((s) => s.val() as Case['comment']) : null,
      ]);
      return {key, type, videoId, commentId, reports: rs, video, comment};
    }),
  );
  return cases.sort((a, b) => b.reports.length - a.reports.length || b.reports[0].createdAt - a.reports[0].createdAt);
}

export default function Admin() {
  const {user, ready} = useUser();
  const isAdmin = useIsAdmin();
  const [version, setVersion] = useState(0);
  const {data, loading, error} = useAsync(() => (isAdmin ? loadCases() : Promise.resolve([])), [isAdmin, version]);
  const [busy, setBusy] = useState<string | null>(null);

  if (!ready) return null;
  if (!user || !isAdmin)
    return (
      <EmptyState title="Зөвхөн сайтын хянагчид">
        <p className="max-w-md">
          Хянагч болохын тулд Firebase консолын Realtime Database хэсэгт <code>admins/&lt;таны uid&gt;: true</code> гэж нэмнэ.
        </p>
      </EmptyState>
    );

  const act = async (c: Case, what: 'dismiss' | 'remove') => {
    const label = c.type === 'video' ? 'бичлэгийг' : 'сэтгэгдлийг';
    if (what === 'remove' && !confirm(`Энэ ${label} сайтаас устгах уу? Холбогдох мэдээллүүд мөн хаагдана.`)) return;
    setBusy(c.key);
    try {
      if (what === 'remove') {
        if (c.type === 'video') await removeVideoAsAdmin(c.videoId);
        else await removeCommentAsAdmin(c.videoId, c.commentId!);
      }
      await dismissReports(c.reports.map((r) => r.id));
      setVersion((v) => v + 1);
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <ShieldCheck /> Хяналт
      </h1>
      <p className="mt-1 text-sm text-neutral-400">Хэрэглэгчдийн мэдээлсэн бичлэг, сэтгэгдэл. Олон удаа мэдээлэгдсэн нь дээрээ.</p>
      {loading ? (
        <p className="mt-6 text-neutral-400">Ачаалж байна…</p>
      ) : error ? (
        <EmptyState title="Ачаалж чадсангүй">{error}</EmptyState>
      ) : !data?.length ? (
        <EmptyState title="Шалгах мэдээлэл алга 🎉" />
      ) : (
        <ul className="mt-6 space-y-4">
          {data.map((c) => (
            <li key={c.key} className="rounded-xl bg-neutral-900 p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                {c.video && <Thumbnail video={c.video} className="w-full shrink-0 sm:w-48" />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-orange-600/20 px-1.5 py-0.5 font-semibold text-orange-300">
                      <Flag size={12} className="mr-1 inline" />
                      {c.reports.length} мэдээлэл
                    </span>
                    <span className="text-neutral-400">{c.type === 'video' ? 'Бичлэг' : 'Сэтгэгдэл'}</span>
                  </p>
                  <p className="mt-1 font-semibold">{c.video?.title ?? '(устсан бичлэг)'}</p>
                  {c.video && <p className="text-xs text-neutral-400">{c.video.channel}</p>}
                  {c.type === 'comment' && (
                    <blockquote className="mt-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm">
                      {c.comment ? (
                        <>
                          <span className="font-semibold">@{c.comment.author}: </span>
                          <span className="whitespace-pre-wrap break-words">{c.comment.text}</span>
                        </>
                      ) : (
                        <span className="text-neutral-400">(сэтгэгдэл устсан)</span>
                      )}
                    </blockquote>
                  )}
                  <ul className="mt-3 space-y-1 text-sm">
                    {c.reports.map((r) => (
                      <li key={r.id} className="text-neutral-300">
                        <span className="font-medium">{REASONS[r.reason] ?? r.reason}</span>
                        {r.details && <span className="text-neutral-400"> — “{r.details}”</span>}
                        <span className="text-xs text-neutral-500">
                          {' '}
                          · {r.reporterName}, {timeAgo(r.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.video && (
                      <Link
                        href={`/watch?v=${c.videoId}${c.commentId ? `&lc=${c.commentId}` : ''}`}
                        className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                      >
                        <ExternalLink size={14} /> Нээж үзэх
                      </Link>
                    )}
                    <button
                      disabled={busy === c.key}
                      onClick={() => act(c, 'remove')}
                      className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1.5 text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={14} /> {c.type === 'video' ? 'Бичлэгийг устгах' : 'Сэтгэгдлийг устгах'}
                    </button>
                    <button
                      disabled={busy === c.key}
                      onClick={() => act(c, 'dismiss')}
                      className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
                    >
                      <X size={14} /> Зөрчилгүй — хаах
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
