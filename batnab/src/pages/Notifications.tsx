import {Bell, BellRing, CheckCheck, Trash2} from 'lucide-react';
import {useState} from 'react';
import NotificationItem from '../components/NotificationItem';
import {EmptyState} from '../components/VideoCard';
import {signIn, useUser} from '../lib/auth';
import {
  clearNotifications,
  desktopNotify,
  markRead,
  NOTIFICATION_GROUPS,
  removeNotification,
  useNotifications,
} from '../lib/notifications';

export default function Notifications() {
  const {user, ready} = useUser();
  const {items, loaded, unread} = useNotifications();
  const [group, setGroup] = useState('all');
  const [desktop, setDesktop] = useState(desktopNotify.enabled());

  if (ready && !user)
    return (
      <EmptyState title="Мэдэгдлээ харахын тулд нэвтэрнэ үү">
        <button onClick={signIn} className="mt-2 rounded-full bg-white px-5 py-2 font-semibold text-black hover:bg-neutral-200">
          Нэвтрэх
        </button>
      </EmptyState>
    );

  const types = NOTIFICATION_GROUPS.find((g) => g.key === group)?.types ?? [];
  const shown = types.length ? items.filter((n) => types.includes(n.type)) : items;

  const toggleDesktop = async () => {
    if (desktop) {
      desktopNotify.disable();
      setDesktop(false);
    } else {
      const ok = await desktopNotify.enable();
      setDesktop(ok);
      if (!ok) alert('Хөтөч мэдэгдэл харуулахыг зөвшөөрөөгүй байна. Хөтчийн тохиргооноос зөвшөөрнө үү.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Мэдэгдэл</h1>
        <div className="flex flex-wrap gap-2">
          {unread > 0 && (
            <button
              onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))}
              className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
            >
              <CheckCheck size={16} /> Бүгдийг уншсан
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={() => confirm('Бүх мэдэгдлийг устгах уу?') && clearNotifications()}
              className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
            >
              <Trash2 size={16} /> Бүгдийг устгах
            </button>
          )}
        </div>
      </div>

      {desktopNotify.supported() && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl bg-neutral-900 p-4">
          <div className="flex items-start gap-3">
            <BellRing size={22} className="mt-0.5 shrink-0 text-neutral-300" />
            <div>
              <p className="text-sm font-semibold">Хөтчийн мэдэгдэл</p>
              <p className="text-xs text-neutral-400">Batnab өөр цонхонд нээлттэй байхад шинэ мэдэгдэл ирвэл дэлгэцэнд гаргана.</p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={desktop}
            onClick={toggleDesktop}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${desktop ? 'bg-blue-500' : 'bg-neutral-600'}`}
            aria-label="Хөтчийн мэдэгдэл"
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${desktop ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      )}

      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {NOTIFICATION_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setGroup(g.key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
              group === g.key ? 'bg-white text-black' : 'bg-neutral-800 hover:bg-neutral-700'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <p className="text-neutral-400">Ачаалж байна…</p>
      ) : !shown.length ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Bell size={52} className="text-neutral-600" />
          <p className="mt-4 font-semibold">Мэдэгдэл алга</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">
            Сэтгэгдэл, хариулт, лайк, захиалга болон захиалсан сувгийн шинэ бичлэгийн мэдэгдэл энд харагдана.
          </p>
        </div>
      ) : (
        <div className="-mx-4 overflow-hidden sm:mx-0 sm:rounded-xl sm:bg-neutral-900">
          {shown.map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              onOpen={(x) => !x.read && markRead([x.id]).catch(() => {})}
              onRemove={(x) => removeNotification(x.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
