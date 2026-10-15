import {ArrowLeft, Crown, Medal as MedalIcon} from 'lucide-react';
import Avatar from '../components/Avatar';
import {CenterNote, LockedNote} from '../components/Notices';
import {overall, PLACES, percentOf, ranking, usePhotos, useMedals, useWeekBoard, weekLabel} from '../lib/leaderboard';
import {formatDuration} from '../lib/attempt';
import {Link} from '../lib/router';
import {dayLabel} from '../lib/time';
import {useSession} from '../lib/session';
import {useSettings} from '../lib/settings';
import {TESTS, testInfo} from '../tests';

/**
 * A classmate's profile as others see it, opened from the leaderboard: nickname (or login name), photo, this week's
 * places and medals. The real name is never shown.
 */
export default function PublicProfile({uid}: {uid: string}) {
  const session = useSession();
  const settings = useSettings();
  const allowed = session.ready && !!session.user && (session.admin || (!!session.profile && !session.profile.disabled)) && !!settings?.leaderboard;
  const board = useWeekBoard(allowed);
  const photos = usePhotos(allowed ? [uid] : []);
  const medals = useMedals(uid, allowed);

  if (session.ready && !session.user) return <LockedNote />;
  if (settings && !settings.leaderboard) return <CenterNote title="Leaderboard одоогоор хаалттай байна" />;
  if (!allowed || !board || !medals) return <p className="py-24 text-center text-neutral-400">Ачаалж байна…</p>;

  // Only the tests where the student is in the top 3 this week; someone who is in no top 3 has no profile here.
  const mine = TESTS.flatMap((t) => {
    const i = ranking(board[t.id] ?? [])
      .slice(0, 3)
      .findIndex((e) => e.uid === uid);
    return i < 0 ? [] : [{e: ranking(board[t.id] ?? [])[i], place: i + 1}];
  });
  if (!mine.length) return <CenterNote title="Энэ сурагч энэ долоо хоногт эхний 3-т ороогүй байна" />;
  const name = mine[0].e.name;
  const top = overall(board).findIndex((e) => e.uid === uid) + 1;
  const leader = top === 1;

  return (
    <div className="mx-auto max-w-xl space-y-4 py-4 sm:py-6">
      <Link href="/leaderboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={16} /> Leaderboard
      </Link>
      <section className="flex flex-col items-center rounded-2xl bg-neutral-900 px-5 pb-6 pt-7 text-center">
        {leader && <Crown size={26} className="mb-1 text-amber-300" />}
        <span className={`rounded-full ${leader ? 'ring-4 ring-amber-400' : ''}`}>
          <Avatar name={name.replace(/^@/, '')} photo={photos[uid]} size={104} />
        </span>
        <h1 className="mt-4 max-w-full break-words text-2xl font-bold">{name}</h1>
        {top > 0 && top <= 3 && (
          <p className={`mt-2 rounded-full px-3 py-1 text-sm font-medium ${PLACES[top as 1 | 2 | 3].block} ${PLACES[top as 1 | 2 | 3].text}`}>
            {leader ? 'Энэ долоо хоногийн тэргүүлэгч' : `«Хамгийн өндөр оноо»-нд ${top}-р байр`}
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="font-semibold">Эхний 3-т орсон тестүүд</h2>
        <ul className="mt-3 divide-y divide-neutral-800">
          {mine.map(({e, place}) => (
            <li key={e.test} className="flex items-center gap-3 py-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${PLACES[place as 1 | 2 | 3].badge}`}>{place}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{testInfo(e.test)?.title}</span>
                <span className="block text-xs text-neutral-500">
                  {place}-р байр · {formatDuration(e.seconds)}
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

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <MedalIcon size={18} className="text-amber-300" /> Медалиуд {medals.length > 0 && <span className="text-sm font-normal text-neutral-500">{medals.length}</span>}
        </h2>
        {medals.length ? (
          <ul className="mt-4 grid grid-cols-3 gap-3">
            {medals.map((m) => (
              <li key={m.week} className="flex flex-col items-center text-center">
                <span className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-extrabold ${PLACES[m.place].badge}`}>{m.place}</span>
                <span className={`mt-2 text-sm font-semibold ${PLACES[m.place].text}`}>{PLACES[m.place].name}</span>
                <span className="text-xs text-neutral-400">{weekLabel(m.week)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-neutral-400">Одоогоор медаль аваагүй байна.</p>
        )}
      </section>
    </div>
  );
}
