import {useId} from 'react';
import {animalOf, medalName, PLACES, weekLabel, type Medal} from '../lib/leaderboard';
import {testInfo} from '../tests';

/** The metals: a disc's light and dark, its rim, and the ribbon's two colours. */
const METAL = {
  1: {hi: '#ffe27a', lo: '#d39b12', rim: '#9a6a05', ribbon: ['#2f5bea', '#ffbf2e']},
  2: {hi: '#f4f6fa', lo: '#9aa3b2', rim: '#6b7381', ribbon: ['#2f5bea', '#c8ced8']},
  3: {hi: '#f2b27a', lo: '#b2622a', rim: '#7a3d14', ribbon: ['#2f5bea', '#cd7f45']},
} as const;

/**
 * A medal as drawn: a two-colour ribbon and a metal disc, with its week's animal and number («Морины алт», №1); one from
 * before the animals, with its place.
 */
export function MedalArt({place, round, size = 64}: {place: 1 | 2 | 3; round?: number; size?: number}) {
  const id = useId();
  const m = METAL[place];
  const sign = round ? animalOf(round)[2] : null;
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 64 80" aria-hidden className="shrink-0 drop-shadow">
      <defs>
        <radialGradient id={`${id}d`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="1" stopColor={m.lo} />
        </radialGradient>
      </defs>
      {/* The ribbon: two bands meeting under the disc. */}
      <path d="M14 0h14l10 30H24z" fill={m.ribbon[0]} />
      <path d="M50 0H36L26 30h14z" fill={m.ribbon[1]} />
      <circle cx="32" cy="50" r="27" fill={`url(#${id}d)`} stroke={m.rim} strokeWidth="2.5" />
      <circle cx="32" cy="50" r="21" fill="none" stroke={m.rim} strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="2 2.4" />
      {sign ? (
        <>
          <text x="32" y="55" textAnchor="middle" fontSize="22">
            {sign}
          </text>
          <text x="32" y="69" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={m.rim}>
            №{round}
          </text>
        </>
      ) : (
        <text x="32" y="59" textAnchor="middle" fontSize="24" fontWeight="900" fill={m.rim}>
          {place}
        </text>
      )}
    </svg>
  );
}

/** A medal with its name, when it was won and (`detail`) with what. */
export default function MedalBadge({m, detail}: {m: Medal; detail?: boolean}) {
  return (
    <li className="flex flex-col items-center text-center" title={weekLabel(m.week)}>
      <MedalArt place={m.place} round={m.round} size={56} />
      <span className={`mt-1.5 text-sm font-semibold ${PLACES[m.place].text}`}>{medalName(m)}</span>
      <span className="text-xs text-neutral-400">{weekLabel(m.week)}</span>
      {detail && (
        <span className="text-[11px] text-neutral-500">
          {testInfo(m.test)?.title} · {m.score}/{m.total}
        </span>
      )}
    </li>
  );
}
