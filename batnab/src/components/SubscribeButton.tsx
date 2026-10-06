import {Bell} from 'lucide-react';
import {useEffect, useState} from 'react';
import {api, errorMessage} from '../lib/api';
import {signIn, useUser} from '../lib/auth';
import {formatViews} from '../lib/format';
import {Link} from '../lib/router';

export const SUBS_CHANGED = 'batnab:subs-changed';

interface Props {
  channel: {uid: string; name: string; photo?: string | null};
  /** Called with the subscriber count whenever it loads or changes. */
  onCount?: (count: number) => void;
  compact?: boolean;
}

export default function SubscribeButton({channel, onCount, compact = false}: Props) {
  const {user, ready} = useUser();
  const [subscribed, setSubscribed] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.subscriberCount(channel.uid).then((n) => alive && setCount(n), () => {});
    return () => {
      alive = false;
    };
  }, [channel.uid]);

  useEffect(() => {
    let alive = true;
    if (ready) api.isSubscribed(channel.uid).then((s) => alive && setSubscribed(s), () => {});
    return () => {
      alive = false;
    };
  }, [channel.uid, ready, user?.uid]);

  useEffect(() => {
    if (count !== null) onCount?.(count);
  }, [count, onCount]);

  if (user?.uid === channel.uid) {
    return compact ? null : (
      <Link href="/studio" className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-semibold hover:bg-neutral-700">
        Үзүүлэлт харах
      </Link>
    );
  }

  const toggle = async () => {
    if (!user) return signIn();
    const next = !subscribed;
    setBusy(true);
    setSubscribed(next);
    setCount((c) => (c ?? 0) + (next ? 1 : -1));
    try {
      await api.subscribe({uid: channel.uid, name: channel.name, photo: channel.photo ?? undefined}, next);
      window.dispatchEvent(new Event(SUBS_CHANGED));
    } catch (e) {
      setSubscribed(!next);
      setCount((c) => (c ?? 0) + (next ? -1 : 1));
      alert(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex shrink-0 items-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-70 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      } ${subscribed ? 'bg-neutral-800 text-white hover:bg-neutral-700' : 'bg-white text-black hover:bg-neutral-200'}`}
    >
      {subscribed && <Bell size={compact ? 14 : 16} />}
      {subscribed ? 'Захиалсан' : 'Захиалах'}
    </button>
  );
}

export function subscriberLabel(count: number | null) {
  return count === null ? '' : `${formatViews(count)} захиалагч`;
}
