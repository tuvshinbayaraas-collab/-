import {ArrowLeft, Award, Crown, Medal as MedalIcon, Pencil, Trophy} from 'lucide-react';
import Avatar from '../components/Avatar';
import {CenterNote, LockedNote} from '../components/Notices';
import {overall, PLACES, percentOf, ranking, usePics, useMedals, useWeekBoard} from '../lib/leaderboard';
import MedalBadge from '../components/MedalBadge';
import {formatDuration} from '../lib/attempt';
import {useClasses} from '../lib/classes';
import {useRoster} from '../lib/lead';
import {useLive} from '../lib/live';
import {usePerson} from '../lib/people';
import {Link} from '../lib/router';
import {dayLabel} from '../lib/time';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {BADGES} from '../lib/stats';
import {TESTS, testInfo} from '../tests';
import Loading from '../components/Loading';

/**
 * /u/{uid}: a student's profile as others see it — picture and frame, name (the real one to classmates and the
 * teacher, else the nickname or login name), class, «Миний тухай», the badges they earned, medals and this week's
 * places on the leaderboard. Open to every signed-in student, unless they hide it (then only what the leaderboard
 * shows).
 */
export default function PublicProfile({uid}: {uid: string}) {
  const session = useSession();
  const settings = useSettings();
  const allowed = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled));
  const lb = allowed && !!settings?.leaderboard;
  const person = usePerson(allowed ? uid : undefined);
  const pics = usePics(allowed ? [uid] : []);
  const myClass = session.admin ? undefined : session.profile?.class;
  const roster = useRoster(allowed ? myClass : undefined);
  const everyone = useLive(allowed && session.admin ? 'classRoster' : null, (v) => (v ?? {}) as Record<string, Record<string, string>>);
  const classes = useClasses();
  const board = useWeekBoard(lb);
  const medals = useMedals(uid, lb);

  if (session.ready && !session.user) return <LockedNote />;
  if (!allowed || person === null || !settings || (lb && (!board || !medals))) return <Loading />;

  // This week's places, every test they are on (the leaderboard's own order).
  const places = lb
    ? TESTS.flatMap((t) => {
        const r = ranking(board![t.id] ?? []);
        const i = r.findIndex((e) => e.uid === uid);
        return i < 0 ? [] : [{e: r[i], place: i + 1, of: r.length}];
      })
    : [];
  const sumRank = lb ? overall(board!) : [];
  const top = sumRank.findIndex((e) => e.uid === uid) + 1;
  if (!person && !places.length)
    return (
      <CenterNote title="Профайл олдсонгүй">
        <p className="text-sm text-neutral-400">Энэ сурагч профайлаа нуусан эсвэл одоогоор байхгүй байна.</p>
        <Link href="/people" className="mt-3 inline-block text-blue-400 hover:underline">
          Сурагчид
        </Link>
      </CenterNote>
    );

  const publicName = person?.name ?? places[0].e.name;
  const cls = person?.cls;
  // The real name: to classmates and the teacher.
  const real = cls ? (session.admin ? everyone?.[cls]?.[uid] : cls === myClass ? roster?.[uid] : undefined) : undefined;
  const title = real ?? publicName;
  const className = cls ? classes?.find((c) => c.id === cls)?.name : undefined;
  const mine = uid === session.user?.uid;
  const leader = top === 1;
  const got = new Set(person?.badges ?? []);
  const earned = BADGES.filter((b) => got.has(b.id));

  return (
    <div className="mx-auto max-w-xl space-y-4 py-4 sm:py-6">
      <button type="button" onClick={() => history.back()} className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={16} /> Буцах
      </button>
      <section className="flex flex-col items-center rounded-2xl bg-neutral-900 px-5 pb-6 pt-7 text-center">
        {leader && <Crown size={26} className="mb-1 text-amber-300" />}
        <span className={`rounded-full ${leader ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-neutral-900' : ''}`}>
          <Avatar name={publicName.replace(/^@/, '')} photo={pics[uid]?.photo} frame={pics[uid]?.frame ?? person?.frame} size={104} />
        </span>
        <h1 className="mt-4 max-w-full break-words text-2xl font-bold">{title}</h1>
        <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 text-sm text-neutral-400">
          {real && real !== publicName && <span>{publicName}</span>}
          {className && <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300">{className} анги</span>}
        </p>
        {person?.about && <p className="mt-3 max-w-sm whitespace-pre-wrap break-words text-[15px] text-neutral-200">“{person.about}”</p>}
        {top > 0 && top <= 3 && (
          <p className={`mt-3 rounded-full px-3 py-1 text-sm font-medium ${PLACES[top as 1 | 2 | 3].block} ${PLACES[top as 1 | 2 | 3].text}`}>
            {leader ? `Энэ долоо хоногийн тэргүүлэгч · ${sumRank[0].score} оноо` : `«Шилдэг оноогоор» ${top}-р байр · ${sumRank[top - 1].score} оноо`}
          </p>
        )}
        {mine && (
          <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-neutral-400">
            Бусдад таны профайл ингэж харагдана.
            <Link href="/profile" className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-3 py-1 font-medium text-neutral-200 hover:bg-neutral-700">
              <Pencil size={14} /> Засах
            </Link>
          </p>
        )}
      </section>

      {person && (
        <section className="rounded-2xl bg-neutral-900 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Award size={18} className="text-amber-300" /> Амжилтууд{' '}
            <span className="text-sm font-normal text-neutral-500">
              {earned.length}/{BADGES.length}
            </span>
          </h2>
          {earned.length ? (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {earned.map((b) => (
                <li key={b.id} className="flex flex-col items-center rounded-xl bg-neutral-800/60 px-2 py-3 text-center" title={b.hint}>
                  <span className="text-2xl" aria-hidden>
                    {b.icon}
                  </span>
                  <span className="mt-1 text-xs font-medium leading-tight">{b.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-neutral-400">{mine ? 'Профайл хуудсаа нээхэд амжилтууд тань энд гарна.' : 'Одоогоор амжилт алга.'}</p>
          )}
        </section>
      )}

      {lb && (
        <section className="rounded-2xl bg-neutral-900 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <MedalIcon size={18} className="text-amber-300" /> Медалиуд {medals!.length > 0 && <span className="text-sm font-normal text-neutral-500">{medals!.length}</span>}
          </h2>
          {medals!.length ? (
            <ul className="mt-4 grid grid-cols-3 gap-3">
              {medals!.map((m) => (
                <MedalBadge key={m.key} m={m} />
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-neutral-400">Одоогоор медаль аваагүй байна.</p>
          )}
        </section>
      )}

      {places.length > 0 && (
        <section className="rounded-2xl bg-neutral-900 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy size={18} className="text-amber-300" /> Энэ долоо хоногийн leaderboard
          </h2>
          <ul className="mt-3 divide-y divide-neutral-800">
            {places.map(({e, place, of}) => (
              <li key={e.test} className="flex items-center gap-3 py-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${place <= 3 ? PLACES[place as 1 | 2 | 3].badge : 'bg-neutral-800 text-neutral-300'}`}
                >
                  {place}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{testInfo(e.test)?.title}</span>
                  <span className="block text-xs text-neutral-500">
                    {of} сурагчаас {place}-р байр · {formatDuration(e.seconds)}
                    {e.at ? ` · ${dayLabel(e.at)}` : ''}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block font-semibold">
                    {e.score}/{e.total}
                  </span>
                  <span className="block text-xs text-neutral-400">{percentOf(e)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
