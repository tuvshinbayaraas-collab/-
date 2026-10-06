import {Users} from 'lucide-react';
import {EmptyState, GridSkeleton, VideoGrid} from '../components/VideoCard';
import {api} from '../lib/api';
import {signIn, useUser} from '../lib/auth';
import {Link} from '../lib/router';
import {useAsync} from '../lib/useAsync';

export default function Subscriptions() {
  const {user, ready} = useUser();
  const {data, loading, error} = useAsync(() => api.subscriptionFeed(), [user?.uid]);

  if (ready && !user)
    return (
      <EmptyState title="Захиалсан сувгуудынхаа шинэ бичлэгийг харахын тулд нэвтэрнэ үү">
        <button onClick={signIn} className="mt-2 rounded-full bg-white px-5 py-2 font-semibold text-black hover:bg-neutral-200">
          Нэвтрэх
        </button>
      </EmptyState>
    );
  if (!ready || loading) return <GridSkeleton />;
  if (error) return <EmptyState title="Ачаалж чадсангүй">{error}</EmptyState>;
  if (!data?.length)
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <Users size={56} className="text-neutral-500" />
        <h1 className="mt-4 text-xl font-bold">Захиалсан сувгийн бичлэг алга</h1>
        <p className="mt-2 max-w-md text-sm text-neutral-400">
          Таалагдсан сувгаа «Захиалах» товчоор захиалбал шинэ бичлэгүүд нь энд гарна.
        </p>
        <Link href="/" className="mt-4 text-blue-400 hover:underline">
          Бичлэг үзэх
        </Link>
      </div>
    );
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Захиалгууд</h1>
      <VideoGrid videos={data} />
    </div>
  );
}
