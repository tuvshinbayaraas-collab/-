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
 * A test's medal as drawn: a two-colour ribbon and a metal disc, with its week's animal and number («Морины алт», №1);
 * one from before the animals, with its place.
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

/** Points of a star around (32, cy): `n` rays between radius `out` and `inn`, the first straight up. */
const star = (n: number, out: number, inn: number, cy = 52) =>
  Array.from({length: n * 2}, (_, i) => {
    const r = i % 2 ? inn : out;
    const t = (Math.PI * i) / n - Math.PI / 2;
    return `${(32 + r * Math.cos(t)).toFixed(2)},${(cy + r * Math.sin(t)).toFixed(2)}`;
  }).join(' ');

/** The eight points' two facets: from the centre to the tip and the inner corner on either side. */
const FACETS = Array.from({length: 8}, (_, i) => {
  const at = (r: number, t: number) => `${(32 + r * Math.cos(t)).toFixed(2)},${(52 + r * Math.sin(t)).toFixed(2)}`;
  const t = (Math.PI * i) / 4 - Math.PI / 2;
  const tip = at(25, t);
  return [`32,52 ${tip} ${at(14, t - Math.PI / 8)}`, `32,52 ${tip} ${at(14, t + Math.PI / 8)}`] as const;
});

/**
 * The «Шилдэг оноогоор» order (одон), finer than a test's medal: a pentagonal ribbon in red-blue-red, a sixteen-ray
 * metal star with a faceted eight-pointed one on it, and a blue enamel centre with the place in a dotted ring and a glint.
 */
export function OrderArt({place, size = 64}: {place: 1 | 2 | 3; size?: number}) {
  const id = useId();
  const m = METAL[place];
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 64 80" aria-hidden className="shrink-0 drop-shadow">
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="0.55" stopColor={m.lo} />
          <stop offset="1" stopColor={m.hi} />
        </linearGradient>
        <radialGradient id={`${id}e`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#3b6cf0" />
          <stop offset="1" stopColor="#0f2370" />
        </radialGradient>
        <clipPath id={`${id}r`}>
          <path d="M18 0h28v17l-14 8-14-8z" />
        </clipPath>
      </defs>
      {/* The ribbon: red, blue, red, folded to a point, with a ring down to the star. */}
      <g clipPath={`url(#${id}r)`}>
        <rect x="18" y="0" width="28" height="26" fill="#c4272f" />
        <rect x="27" y="0" width="10" height="26" fill="#1d4ed8" />
      </g>
      <path d="M18 0h28v17l-14 8-14-8z" fill="none" stroke={m.rim} strokeWidth="1" />
      <circle cx="32" cy="27" r="2.6" fill="none" stroke={m.lo} strokeWidth="1.6" />
      {/* The star: sixteen rays behind, eight points on top. */}
      <polygon points={star(16, 27, 20)} fill={m.lo} stroke={m.rim} strokeWidth="0.8" strokeLinejoin="round" />
      <polygon points={star(8, 25, 14)} fill={`url(#${id}m)`} stroke={m.rim} strokeWidth="1" strokeLinejoin="round" />
      {/* Each point cut in two facets, one catching the light. */}
      {FACETS.map(([lit, dark], i) => (
        <g key={i}>
          <polygon points={lit} fill="#fff" fillOpacity="0.28" />
          <polygon points={dark} fill="#000" fillOpacity="0.12" />
        </g>
      ))}
      <circle cx="32" cy="52" r="12.5" fill={`url(#${id}e)`} stroke={m.hi} strokeWidth="2" />
      <circle cx="32" cy="52" r="9.6" fill="none" stroke={m.hi} strokeOpacity="0.8" strokeWidth="0.9" strokeDasharray="1.1 1.6" />
      <text x="32" y="56.5" textAnchor="middle" fontSize="12.5" fontWeight="900" fill={m.hi}>
        {place}
      </text>
      {/* A glint on the upper left point. */}
      <path d="M17 33l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z" fill="#fff" className="animate-pulse motion-reduce:animate-none" />
    </svg>
  );
}

/** A medal with its name, when it was won and (`detail`) with what. */
export default function MedalBadge({m, detail}: {m: Medal; detail?: boolean}) {
  return (
    <li className="flex flex-col items-center text-center" title={`${m.top ? '«Шилдэг оноогоор» · ' : ''}${weekLabel(m.week)}`}>
      {m.top ? <OrderArt place={m.place} size={56} /> : <MedalArt place={m.place} round={m.round} size={56} />}
      <span className={`mt-1.5 text-sm font-semibold ${PLACES[m.place].text}`}>{medalName(m)}</span>
      <span className="text-xs text-neutral-400">{weekLabel(m.week)}</span>
      {detail && <span className="text-[11px] text-neutral-500">{m.top ? `${m.score} оноо · ${m.tests ?? 1} тест` : `${testInfo(m.test)?.title ?? m.test} · ${m.score}/${m.total}`}</span>}
    </li>
  );
}
