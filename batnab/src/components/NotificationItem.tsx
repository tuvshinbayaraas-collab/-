import {AtSign, Bell, Heart, MessageSquare, Pin, ThumbsUp, UserPlus, Video, X} from 'lucide-react';
import type {ReactNode} from 'react';
import {driveThumbUrl} from '../lib/drive';
import {timeAgo} from '../lib/format';
import {notificationHref, notificationText, type AppNotification, type NotificationType} from '../lib/notifications';
import {Link} from '../lib/router';
import Avatar from './Avatar';

const ICONS: Record<NotificationType, {icon: ReactNode; bg: string}> = {
  comment: {icon: <MessageSquare size={11} />, bg: 'bg-blue-500'},
  reply: {icon: <MessageSquare size={11} />, bg: 'bg-blue-500'},
  mention: {icon: <AtSign size={11} />, bg: 'bg-sky-500'},
  commentLike: {icon: <ThumbsUp size={11} />, bg: 'bg-indigo-500'},
  heart: {icon: <Heart size={11} fill="currentColor" />, bg: 'bg-red-500'},
  pin: {icon: <Pin size={11} />, bg: 'bg-amber-500'},
  subscribe: {icon: <UserPlus size={11} />, bg: 'bg-green-600'},
  newVideo: {icon: <Video size={11} />, bg: 'bg-red-600'},
};

export default function NotificationItem({
  n,
  onOpen,
  onRemove,
}: {
  n: AppNotification;
  onOpen: (n: AppNotification) => void;
  onRemove?: (n: AppNotification) => void;
}) {
  const kind = ICONS[n.type] ?? {icon: <Bell size={11} />, bg: 'bg-neutral-600'};
  return (
    <div className={`group relative flex items-start gap-3 px-4 py-3 hover:bg-neutral-800 ${n.read ? '' : 'bg-blue-500/[0.06]'}`}>
      <span
        className={`mt-4 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-blue-500'}`}
        aria-label={n.read ? undefined : 'Уншаагүй'}
      />
      <Link href={notificationHref(n)} onClick={() => onOpen(n)} className="flex min-w-0 flex-1 items-start gap-3">
        <span className="relative shrink-0">
          <Avatar name={n.actorName} photo={n.actorPhoto} size={44} />
          <span className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-neutral-900 ${kind.bg}`}>
            {kind.icon}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`line-clamp-3 break-words text-sm ${n.read ? 'text-neutral-300' : 'text-white'}`}>{notificationText(n)}</span>
          <span className="mt-1 block text-xs text-neutral-400">{timeAgo(n.createdAt)}</span>
        </span>
        {n.thumbId && (
          <img
            src={driveThumbUrl(n.thumbId)}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
            className={`shrink-0 rounded-md bg-neutral-800 object-cover ${n.short ? 'h-16 w-10' : 'aspect-video w-20 sm:w-24'}`}
          />
        )}
      </Link>
      {onRemove && (
        <button
          onClick={() => onRemove(n)}
          className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          aria-label="Мэдэгдэл устгах"
          title="Устгах"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
