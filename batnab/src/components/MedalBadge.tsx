import {useId} from 'react';
import {gameOf} from '../lib/games';
import {animalOf, medalName, medalPeriod, PLACES, type Medal} from '../lib/leaderboard';
import {medalFor} from '../lib/medals';
import {testInfo} from '../tests';

/** The metals: a disc's light and dark, its rim, a glint, and the ribbon's two colours. */
export const METAL = {
  1: {hi: '#ffe27a', lo: '#d39b12', rim: '#9a6a05', edge: '#fff4c2', ribbon: ['#2f5bea', '#ffbf2e']},
  2: {hi: '#f4f6fa', lo: '#9aa3b2', rim: '#6b7381', edge: '#ffffff', ribbon: ['#2f5bea', '#c8ced8']},
  3: {hi: '#f2b27a', lo: '#b2622a', rim: '#7a3d14', edge: '#ffd9b8', ribbon: ['#2f5bea', '#cd7f45']},
} as const;

/** A four-pointed glint at (x, y). */
const glint = (x: number, y: number, r: number) => `M${x} ${y - r}l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28}-${r * 0.72} ${r * 0.28}-${r * 0.28} ${r * 0.72}-${r * 0.28}-${r * 0.72}-${r * 0.72}-${r * 0.28} ${r * 0.72}-${r * 0.28}z`;

/**
 * A test's medal as drawn: a striped ribbon through a ring, a bevelled metal disc lit from the upper left, with its
 * week's animal and number («Морины алт», №1); one from before the animals, with its place. Gold catches a glint.
 */
export function MedalArt({place, round, size = 64}: {place: 1 | 2 | 3; round?: number; size?: number}) {
  const id = useId();
  const m = METAL[place];
  const sign = round ? animalOf(round)[2] : null;
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 64 80" aria-hidden className="shrink-0 drop-shadow">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.edge} />
          <stop offset="0.45" stopColor={m.hi} />
          <stop offset="1" stopColor={m.rim} />
        </linearGradient>
        <radialGradient id={`${id}d`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="1" stopColor={m.lo} />
        </radialGradient>
      </defs>
      {/* The ribbon: two bands meeting under the ring, each with a light stripe, the far one in shade. */}
      <path d="M13 0h15l10 28H24z" fill={m.ribbon[0]} />
      <path d="M18.5 0h3.2l10 28h-3.2z" fill="#fff" fillOpacity="0.35" />
      <path d="M51 0H36L26 28h14z" fill={m.ribbon[1]} />
      <path d="M44 0h-3L31 28h3z" fill="#fff" fillOpacity="0.3" />
      <path d="M26 28h14l-3 5H29z" fill="#000" fillOpacity="0.18" />
      <circle cx="32" cy="24.5" r="3" fill="none" stroke={m.lo} strokeWidth="1.8" />
      {/* The disc: a bevelled rim, the face, a dotted ring. */}
      <circle cx="32" cy="51" r="27" fill={`url(#${id}b)`} />
      <circle cx="32" cy="51" r="23" fill={`url(#${id}d)`} stroke={m.rim} strokeOpacity="0.6" strokeWidth="1" />
      <circle cx="32" cy="51" r="19.5" fill="none" stroke={m.rim} strokeOpacity="0.45" strokeWidth="1.1" strokeDasharray="2 2.3" />
      {sign ? (
        <>
          <text x="32" y="56" textAnchor="middle" fontSize="20">
            {sign}
          </text>
          <text x="32" y="69" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={m.rim}>
            №{round}
          </text>
        </>
      ) : (
        <text x="32" y="60" textAnchor="middle" fontSize="24" fontWeight="900" fill={m.rim}>
          {place}
        </text>
      )}
      {/* The light on it. */}
      <path d="M14.5 44a19 19 0 0 1 13-14" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
      {place === 1 && <path d={glint(47, 36, 5)} fill="#fff" className="motion-safe:animate-pulse" />}
    </svg>
  );
}

/** A hexagon's points around (32, cy), one corner straight up. */
const hexagon = (r: number, cy = 51) =>
  Array.from({length: 6}, (_, i) => {
    const t = (Math.PI / 3) * i - Math.PI / 2;
    return `${(32 + r * Math.cos(t)).toFixed(2)},${(cy + r * Math.sin(t)).toFixed(2)}`;
  }).join(' ');

/**
 * A game's medal: a violet ribbon in the metal's colour, a bevelled metal hexagon (unlike the tests' round ones) with the
 * game's sign and its place.
 */
export function GameMedalArt({place, game, size = 64}: {place: 1 | 2 | 3; game: string; size?: number}) {
  const id = useId();
  const m = METAL[place];
  const sign = gameOf(game)?.sign ?? '🎮';
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 64 80" aria-hidden className="shrink-0 drop-shadow">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.edge} />
          <stop offset="0.45" stopColor={m.hi} />
          <stop offset="1" stopColor={m.rim} />
        </linearGradient>
        <radialGradient id={`${id}d`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor={m.hi} />
          <stop offset="1" stopColor={m.lo} />
        </radialGradient>
      </defs>
      {/* The ribbon: violet and the metal, crossed. */}
      <path d="M13 0h15l10 28H24z" fill="#7c3aed" />
      <path d="M18.5 0h3.2l10 28h-3.2z" fill="#fff" fillOpacity="0.3" />
      <path d="M51 0H36L26 28h14z" fill={m.ribbon[1]} />
      <path d="M44 0h-3L31 28h3z" fill="#fff" fillOpacity="0.3" />
      <path d="M26 28h14l-3 5H29z" fill="#000" fillOpacity="0.18" />
      <circle cx="32" cy="24.5" r="3" fill="none" stroke={m.lo} strokeWidth="1.8" />
      <polygon points={hexagon(27)} fill={`url(#${id}b)`} strokeLinejoin="round" />
      <polygon points={hexagon(22.5)} fill={`url(#${id}d)`} stroke={m.rim} strokeOpacity="0.6" strokeWidth="1" strokeLinejoin="round" />
      <polygon points={hexagon(19)} fill="none" stroke={m.rim} strokeOpacity="0.45" strokeWidth="1.1" strokeDasharray="2 2.3" />
      <text x="32" y="55" textAnchor="middle" fontSize="18">
        {sign}
      </text>
      <circle cx="32" cy="66" r="5.2" fill={m.rim} />
      <text x="32" y="68.7" textAnchor="middle" fontSize="7.5" fontWeight="900" fill={m.edge}>
        {place}
      </text>
      <path d="M15.5 40.5l10-6" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
      {place === 1 && <path d={glint(47, 35, 5)} fill="#fff" className="motion-safe:animate-pulse" />}
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

/** Any medal's art: a test's, an order, a game's. */
export function Art({m, size}: {m: Medal; size: number}) {
  return m.game ? <GameMedalArt place={m.place} game={m.game} size={size} /> : m.top ? <OrderArt place={m.place} size={size} /> : <MedalArt place={m.place} round={m.round} size={size} />;
}

export const testTitle = (id: string) => testInfo(id)?.title ?? id;

/** A medal with its name, when it was won and (`detail`) with what; a button opening its card when `onOpen` is given. */
export default function MedalBadge({m, detail, onOpen}: {m: Medal; detail?: boolean; onOpen?: (m: Medal) => void}) {
  const body = (
    <>
      <Art m={m} size={56} />
      <span className={`mt-1.5 text-sm font-semibold ${PLACES[m.place].text}`}>{medalName(m)}</span>
      <span className="text-xs text-neutral-400">{medalPeriod(m)}</span>
      {detail && <span className="text-[11px] text-neutral-500">{medalFor(m, testTitle)}</span>}
    </>
  );
  return (
    <li className="flex flex-col items-center text-center" data-medal={m.key}>
      {onOpen ? (
        <button type="button" onClick={() => onOpen(m)} className="flex w-full flex-col items-center rounded-xl px-1 py-1.5 hover:bg-neutral-800/60" aria-label={`${medalName(m)}, ${medalFor(m, testTitle)}`}>
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  );
}
