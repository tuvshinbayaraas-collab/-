import {Trash2} from 'lucide-react';
import {useState} from 'react';
import ShortCard from '../components/ShortCard';
import SubscribeButton, {subscriberLabel} from '../components/SubscribeButton';
import Avatar from '../components/Avatar';
import {EmptyState, VideoCard} from '../components/VideoCard';
import {api, errorMessage} from '../lib/api';
import {displayName, useUser} from '../lib/auth';
import {formatViews} from '../lib/format';
import {Link} from '../lib/router';
import type {Video} from '../lib/types';
import {useAsync} from '../lib/useAsync';

export default function Channel({uid}: {uid: string}) {
  const {user} = useUser();
  const [removed, setRemoved] = useState<string[]>([]);
  const [tab, setTab] = useState<'videos' | 'shorts'>('videos');
  const [subs, setSubs] = useState<number | null>(null);
  const {data, error, loading} = useAsync(() => api.byChannel(uid), [uid]);
  const videos = (data ?? []).filter((v) => !removed.includes(v.id));
  const isMine = user?.uid === uid;
  const name = isMine ? displayName(user) : (data?.[0]?.channel ?? 'Суваг');
  const photo = isMine ? user.photoURL : data?.[0]?.channelPhoto;
  const totalViews = videos.reduce((sum, v) => sum + (v.views ?? 0), 0);
  const shown = videos.filter((v) => (tab === 'shorts' ? v.short : !v.short));

  const remove = async (video: Video) => {
    if (!confirm(`"${video.title}" бичлэгийг устгах уу?`)) return;
    try {
      const driveCleaned = await api.remove(video);
      setRemoved((r) => [...r, video.id]);
      if (!driveCleaned)
        alert('Бичлэг Batnab-аас устгагдлаа. Google Drive-ийн "Batnab" хавтаснаас файлыг гараар устгаж болно.');
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-4 sm:gap-6">
        <Avatar name={name} photo={photo} size={88} />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {subs !== null && `${subscriberLabel(subs)} • `}
            {videos.length} бичлэг • {formatViews(totalViews)} үзэлт
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data?.length || isMine) && (
              <SubscribeButton channel={{uid, name, photo}} onCount={setSubs} />
            )}
            {isMine && (
              <Link
                href="/upload"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200"
              >
                Бичлэг оруулах
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="mb-6 flex gap-6 border-b border-neutral-800">
        {(['videos', 'shorts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-3 font-semibold ${
              tab === t ? 'border-white text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t === 'videos' ? 'Бичлэгүүд' : 'Shorts'}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-neutral-400">Ачаалж байна…</p>
      ) : error ? (
        <EmptyState title="Ачаалж чадсангүй">{error}</EmptyState>
      ) : !shown.length ? (
        <EmptyState title={tab === 'shorts' ? 'Энэ сувагт Shorts алга' : 'Энэ сувагт бичлэг алга'} />
      ) : (
        <div
          className={
            tab === 'shorts'
              ? 'flex flex-wrap gap-3'
              : 'grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
          }
        >
          {shown.map((v) => (
            <div key={v.id} className="relative">
              {tab === 'shorts' ? <ShortCard video={v} /> : <VideoCard video={v} />}
              {isMine && (
                <button
                  onClick={() => remove(v)}
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
