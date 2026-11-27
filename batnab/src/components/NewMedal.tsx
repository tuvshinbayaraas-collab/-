import {useEffect, useState} from 'react';
import {medalEnd, medalName, PLACES, type Medal} from '../lib/leaderboard';
import {kindOf, medalFor, useMedals} from '../lib/medals';
import {navigate} from '../lib/router';
import {serverNow} from '../lib/time';
import {Art, testTitle} from './MedalBadge';
import {KIND_NAMES} from './MedalCase';
import Sheet from './Sheet';

// The medals a student has seen celebrated on this device, by account: {uid: [key…]}.
const SEEN = 'batnab.medalsSeen';
/** A medal is celebrated within a week of being won; an older one not seen here (a new phone) is only noted. */
const RECENT = 7 * 86_400_000;

function seenBy(uid: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN) ?? '{}') as Record<string, unknown>;
    return Array.isArray(v?.[uid]) ? (v[uid] as unknown[]).filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}
function note(uid: string, keys: string[]) {
  try {
    const v = (JSON.parse(localStorage.getItem(SEEN) ?? '{}') ?? {}) as Record<string, unknown>;
    localStorage.setItem(SEEN, JSON.stringify({...v, [uid]: [...new Set([...seenBy(uid), ...keys])]}));
  } catch {
    // A private window: shown again next visit.
  }
}

/** A student's new medals, once each: what they won, large, with a way to their profile. */
export default function NewMedal({uid}: {uid: string}) {
  const medals = useMedals(uid, true);
  const [fresh, setFresh] = useState<Medal[]>([]);
  const sig = medals ? medals.map((m) => m.key).join(',') : null;
  useEffect(() => {
    if (!medals) return;
    const seen = new Set(seenBy(uid));
    const now = serverNow();
    const unseen = medals.filter((m) => !seen.has(m.key));
    const show = unseen.filter((m) => now - medalEnd(m) < RECENT);
    if (show.length < unseen.length) note(uid, unseen.filter((m) => !show.includes(m)).map((m) => m.key));
    setFresh(show);
    // `sig` stands for the medals (a new list each time it is read).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, sig]);
  if (!fresh.length) return null;
  const close = () => {
    note(uid, fresh.map((m) => m.key));
    setFresh([]);
  };
  const one = fresh.length === 1;
  return (
    <Sheet title={one ? 'Шинэ медаль' : `${fresh.length} шинэ медаль`} sub="Баяр хүргэе!" onClose={close}>
      <ul className={`grid gap-4 ${one ? '' : 'grid-cols-2 sm:grid-cols-3'}`} data-new-medals>
        {fresh.slice(0, 6).map((m, i) => (
          <li key={m.key} className="flex flex-col items-center text-center">
            <span className="relative flex items-center justify-center">
              <span className={`absolute rounded-full blur-2xl ${PLACES[m.place].block} ${one ? 'h-32 w-32' : 'h-20 w-20'}`} aria-hidden />
              <span className="relative motion-safe:animate-[medal-in_.55s_ease-out_both]" style={{animationDelay: `${i * 120}ms`}}>
                <Art m={m} size={one ? 120 : 72} />
              </span>
            </span>
            <span className={`mt-2 font-semibold ${PLACES[m.place].text}`}>{medalName(m)}</span>
            <span className="text-xs text-neutral-400">
              {KIND_NAMES[kindOf(m)]} · {m.place}-р байр
            </span>
            <span className="text-xs text-neutral-300">{medalFor(m, testTitle)}</span>
          </li>
        ))}
      </ul>
      {fresh.length > 6 && <p className="mt-3 text-center text-sm text-neutral-400">Бас {fresh.length - 6} медаль профайл дээр байна.</p>}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            close();
            navigate('/profile');
          }}
          className="flex-1 rounded-xl bg-amber-400 py-2.5 font-semibold text-neutral-950 hover:bg-amber-300"
        >
          Профайлд харах
        </button>
        <button type="button" onClick={close} className="rounded-xl border border-neutral-700 px-4 py-2.5 text-neutral-200 hover:border-neutral-500">
          Хаах
        </button>
      </div>
    </Sheet>
  );
}
