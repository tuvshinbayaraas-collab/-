import {ChevronRight, Search, Users, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import Avatar from '../components/Avatar';
import Loading from '../components/Loading';
import {InactiveNote, LockedNote} from '../components/Notices';
import {useClasses} from '../lib/classes';
import {useRoster} from '../lib/lead';
import {usePics} from '../lib/leaderboard';
import {useLive} from '../lib/live';
import {usePeople, type Person} from '../lib/people';
import {Link} from '../lib/router';
import {useSession} from '../lib/session';
import {BADGES} from '../lib/stats';

type Scope = 'class' | 'all';
const ICON = new Map(BADGES.map((b) => [b.id, b.icon]));
/** Lower case, «ё» as «е», for matching what was typed. */
const fold = (s: string) => s.toLocaleLowerCase('mn').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

/**
 * /people — «Сурагчид»: find a student by name and open their profile. Classmates first (by their real names, which
 * only classmates and the teacher see), then everyone (by nickname or login name). Those who hide their profile aren't
 * here.
 */
export default function People() {
  const session = useSession();
  const allowed = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  const people = usePeople(allowed);
  const myClass = session.admin ? undefined : session.profile?.class;
  const roster = useRoster(allowed ? myClass : undefined);
  const everyone = useLive(allowed && session.admin ? 'classRoster' : null, (v) => (v ?? {}) as Record<string, Record<string, string>>);
  const classes = useClasses();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope | null>(null);

  if (session.ready && !session.user) return <LockedNote text="Сурагчдыг харахын тулд нэвтэрнэ үү." />;
  if (session.ready && !allowed) return <InactiveNote blocked={!!session.profile?.disabled} />;
  if (!allowed || !people || !classes) return <Loading />;

  const me = session.user!.uid;
  const realOf = (p: Person) => (p.cls ? (session.admin ? everyone?.[p.cls]?.[p.uid] : p.cls === myClass ? roster?.[p.uid] : undefined) : undefined);
  const classOf = (id?: string) => (id ? (classes.find((c) => c.id === id)?.name ?? '') : '');
  const shown = scope ?? (myClass ? 'class' : 'all');
  const mates = people.filter((p) => !!myClass && p.cls === myClass);
  const words = fold(q);
  const list = (shown === 'class' ? mates : people)
    .map((p) => ({p, real: realOf(p)}))
    .filter(({p, real}) => !words || fold(`${real ?? ''} ${p.name}`).includes(words))
    .sort(
      (a, b) =>
        Number(b.p.uid === me) - Number(a.p.uid === me) ||
        Number(!!myClass && b.p.cls === myClass) - Number(!!myClass && a.p.cls === myClass) ||
        classOf(a.p.cls).localeCompare(classOf(b.p.cls), 'mn') ||
        (a.real ?? a.p.name.replace(/^@/, '')).localeCompare(b.real ?? b.p.name.replace(/^@/, ''), 'mn'),
    );

  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
          <Users size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Сурагчид</h1>
          <p className="text-sm text-neutral-400">Нэрээр нь хайгаад профайлыг нь үзээрэй.</p>
        </div>
      </header>

      <div className="relative mt-5">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Нэрээр хайх…"
          aria-label="Нэрээр хайх"
          className="w-full rounded-full border border-neutral-700 bg-neutral-950 py-2.5 pl-10 pr-10 outline-none focus:border-blue-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Арилгах" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={16} />
          </button>
        )}
      </div>

      {myClass && (
        <div className="mt-3 grid grid-cols-2 rounded-full bg-neutral-900 p-1 text-sm font-medium" role="tablist" aria-label="Хэнийг харах">
          {(
            [
              ['class', `Миний анги (${mates.length})`],
              ['all', `Бүгд (${people.length})`],
            ] as [Scope, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={shown === id}
              onClick={() => setScope(id)}
              className={`rounded-full py-1.5 ${shown === id ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!list.length ? (
        <p className="mt-6 rounded-2xl bg-neutral-900 p-6 text-center text-neutral-400">
          {words ? `«${q.trim()}» нэртэй сурагч олдсонгүй.` : 'Одоогоор энд сурагч алга.'}
          {words && shown === 'class' && (
            <button type="button" onClick={() => setScope('all')} className="mt-2 block w-full text-sm text-blue-400 hover:underline">
              Бүх сурагчаас хайх
            </button>
          )}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-800 overflow-hidden rounded-2xl bg-neutral-900">
          {list.map(({p, real}) => (
            <PersonRow key={p.uid} p={p} real={real} me={p.uid === me} className={shown === 'all' ? classOf(p.cls) : ''} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One student: picture (loaded as the row comes into view), name, class, a line of «Миний тухай», badges. */
function PersonRow({p, real, me, className}: {p: Person; real?: string; me: boolean; className: string}) {
  const row = useRef<HTMLLIElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = row.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), {rootMargin: '200px'});
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const pics = usePics(seen ? [p.uid] : []);
  const icons = p.badges.flatMap((id) => ICON.get(id) ?? []).slice(0, 6);
  return (
    <li ref={row}>
      <Link href={`/u/${p.uid}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-800/60">
        <Avatar name={p.name.replace(/^@/, '')} photo={pics[p.uid]?.photo} frame={pics[p.uid]?.frame ?? p.frame} size={48} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold break-words">
              {real ?? p.name}
              {me && <span className="font-normal text-neutral-500"> (та)</span>}
            </span>
            {real && real !== p.name && <span className="text-xs text-neutral-500">{p.name}</span>}
            {className && <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">{className}</span>}
          </span>
          {p.about && <span className="block truncate text-sm text-neutral-400">{p.about}</span>}
          {icons.length > 0 && (
            <span className="mt-0.5 block text-sm leading-tight" aria-label={`${p.badges.length} амжилт`}>
              {icons.join(' ')}
              {p.badges.length > icons.length && <span className="ml-1 text-xs text-neutral-500">+{p.badges.length - icons.length}</span>}
            </span>
          )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-neutral-600" />
      </Link>
    </li>
  );
}
