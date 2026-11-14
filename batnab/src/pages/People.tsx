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
const fold = (s: string) => s.toLocaleLowerCase('mn').replace(/ё/g, 'е').replace(/@/g, '').replace(/\s+/g, ' ').trim();

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
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
          <Users size={18} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Сурагчид</h1>
          <p className="text-sm text-neutral-400">Сурагч хайж, профайлыг нь үзээрэй</p>
        </div>
      </header>

      <div className="relative mt-3">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Нэр эсвэл @хочоор хайх"
          aria-label="Нэр эсвэл @хочоор хайх"
          className="w-full rounded-full border border-neutral-700 bg-neutral-950 py-2.5 pl-10 pr-10 outline-none focus:border-blue-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Арилгах" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={16} />
          </button>
        )}
      </div>

      {myClass && (
        <div className="mt-2 grid grid-cols-2 rounded-full bg-neutral-900 p-1 text-sm font-medium" role="tablist" aria-label="Хэнийг харах">
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
        <div className="mt-4 rounded-2xl bg-neutral-900 p-6 text-center">
          <p className="font-medium">{words ? 'Сурагч олдсонгүй' : 'Одоогоор энд сурагч алга'}</p>
          {words && <p className="mt-1 text-sm text-neutral-400">«{q.trim()}» гэсэн нэр, хоч алга.</p>}
          {words && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setQ('')} className="rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium hover:bg-neutral-700">
                Хайлтаа цэвэрлэх
              </button>
              {shown === 'class' && (
                <button type="button" onClick={() => setScope('all')} className="rounded-full px-4 py-1.5 text-sm font-medium text-blue-300 hover:bg-neutral-800">
                  Бүх сурагчаас хайх
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <ul className="@container mt-3 divide-y divide-neutral-800 overflow-hidden rounded-2xl bg-neutral-900">
          {list.map(({p, real}) => (
            <PersonRow key={p.uid} p={p} real={real} me={p.uid === me} className={shown === 'all' ? classOf(p.cls) : ''} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A name as a handle: «@хоч» (the nickname), or the login name already written so. */
const handle = (name: string) => (name.startsWith('@') ? name : `@${name}`);
/** How many badges show in a row; the rest as «+N» (all of them on the profile). */
const SHOWN = 3;

/**
 * One student, every row the same shape: picture (loaded as the row comes into view) → the name in bold, «@хоч» under
 * it (and the class, among everyone) → up to three badges. «Миний тухай» is on the profile.
 */
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
  const icons = p.badges.flatMap((id) => ICON.get(id) ?? []);
  const main = real ?? p.name.replace(/^@/, '');
  return (
    <li ref={row}>
      <Link href={`/u/${p.uid}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800/60">
        <Avatar name={p.name.replace(/^@/, '')} photo={pics[p.uid]?.photo} frame={pics[p.uid]?.frame ?? p.frame} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{main}</span>
            {me && <span className="shrink-0 rounded-full bg-blue-500/20 px-1.5 py-px text-[10px] font-semibold leading-4 text-blue-200">Та</span>}
          </span>
          <span className="block truncate text-sm text-neutral-400">
            {handle(p.name)}
            {className && ` · ${className}`}
          </span>
        </span>
        {icons.length > 0 && (
          // Only where the row has room: on a narrow screen with big text the name keeps it (all are on the profile).
          <span className="hidden shrink-0 items-center gap-0.5 text-[15px] leading-none @[20rem]:flex" aria-label={`${icons.length} амжилт`}>
            {icons.slice(0, SHOWN).map((icon, i) => (
              <span key={i} aria-hidden>
                {icon}
              </span>
            ))}
            {icons.length > SHOWN && <span className="ml-0.5 text-xs font-medium text-neutral-400">+{icons.length - SHOWN}</span>}
          </span>
        )}
        <ChevronRight size={18} className="shrink-0 text-neutral-500" />
      </Link>
    </li>
  );
}
