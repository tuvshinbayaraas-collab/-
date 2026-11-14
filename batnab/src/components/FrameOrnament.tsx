import {useId} from 'react';

// The special frames' ornaments (lib/frames), drawn over the ring in a 100×100 box around the picture (its centre at
// 50,50, the ring at radius 50) and spilling a little outside it: they grow and shrink with the picture.

/** A point on the circle around the picture: `deg` from the right, clockwise (down is 90). */
const at = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as const;
};
const arc = (from: number, to: number, r: number) => {
  const [x1, y1] = at(from, r);
  const [x2, y2] = at(to, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};
/** A four-pointed sparkle. */
const star = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`;
/** A cut gem with its point down. */
const gem = (cx: number, cy: number, w: number) => `M${cx} ${cy - w} L${cx + w} ${cy} L${cx} ${cy + w * 1.25} L${cx - w} ${cy}Z`;
/** A flame in a 1-high box, its base at 0,0. */
const FLAME = 'M0 0C-.55 0-.62-.45-.36-.72C-.3-.5-.16-.45-.1-.56C-.2-.82 0-1 .16-1.12C.12-.86.46-.7.46-.36C.5-.1.3 0 0 0Z';

export const ORNAMENTED = new Set(['fire', 'perfect', 'master', 'rainbow', 'gold', 'galaxy', 'lead']);

/** `live`: it moves a little (big pictures only; never where reduced motion is asked for). */
export default function FrameOrnament({id, live}: {id: string; live?: boolean}) {
  const uid = useId().replace(/:/g, '');
  const g = (name: string) => `${name}-${uid}`;
  const url = (name: string) => `url(#${g(name)})`;
  return (
    <svg viewBox="0 0 100 100" className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible ${live ? 'fx-live' : ''}`} aria-hidden>
      {id === 'fire' && (
        <>
          <defs>
            <linearGradient id={g('f')} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#ef4444" />
              <stop offset=".55" stopColor="#f97316" />
              <stop offset="1" stopColor="#fde047" />
            </linearGradient>
          </defs>
          <g className="fx fx-base fx-flicker">
            <path d={FLAME} transform="translate(86 99) rotate(-28) scale(30)" fill={url('f')} />
            <path d={FLAME} transform="translate(85 97) rotate(-28) scale(16)" fill="#fef08a" />
            <path d={FLAME} transform="translate(73 104) rotate(-55) scale(15)" fill={url('f')} opacity=".9" />
          </g>
        </>
      )}
      {id === 'perfect' && (
        <>
          <path d={arc(100, 172, 55)} fill="none" stroke="#15803d" strokeWidth="1.6" strokeLinecap="round" />
          {[106, 121, 136, 151, 166].map((d, i) => {
            const [x, y] = at(d, 55 + (i % 2 ? 4 : -3));
            return <ellipse key={d} cx={x} cy={y} rx="7" ry="3" transform={`rotate(${d + 90 + (i % 2 ? 35 : -35)} ${x} ${y})`} fill={i % 2 ? '#4ade80' : '#22c55e'} />;
          })}
        </>
      )}
      {id === 'master' && (
        <>
          <defs>
            <linearGradient id={g('m')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a5f3fc" />
              <stop offset="1" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <path d={arc(-72, -22, 53)} fill="none" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />
          <path d={arc(-66, -30, 53)} fill="none" stroke="#cffafe" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
          <path d={gem(50, 99, 8.5)} fill={url('m')} stroke="#e0f2fe" strokeWidth=".9" className="fx-glint" />
          <path d="M41.5 99 L58.5 99 M50 90.5 L50 109.6" stroke="#e0f2fe" strokeWidth=".6" opacity=".7" />
        </>
      )}
      {id === 'rainbow' && (
        <>
          <defs>
            <linearGradient id={g('r')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f472b6" stopOpacity="0" />
              <stop offset=".5" stopColor="#f472b6" />
              <stop offset="1" stopColor="#fb923c" />
            </linearGradient>
          </defs>
          <g className="fx-hub fx-orbit">
            <path d={arc(-100, -12, 57)} fill="none" stroke={url('r')} strokeWidth="4.5" strokeLinecap="round" />
            <circle cx={at(-12, 57)[0]} cy={at(-12, 57)[1]} r="3" fill="#fdba74" />
          </g>
        </>
      )}
      {id === 'gold' && (
        <>
          <defs>
            <linearGradient id={g('c')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fef3c7" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <path d="M36 7 L33.5 -10 L43.5 -1.5 L50 -14 L56.5 -1.5 L66.5 -10 L64 7 Z" fill={url('c')} stroke="#b45309" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="33.5" cy="-10" r="2.3" fill="#fde68a" stroke="#b45309" strokeWidth=".8" />
          <circle cx="50" cy="-14" r="2.6" fill="#fde68a" stroke="#b45309" strokeWidth=".8" className="fx-glint" />
          <circle cx="66.5" cy="-10" r="2.3" fill="#fde68a" stroke="#b45309" strokeWidth=".8" />
        </>
      )}
      {id === 'galaxy' && (
        <>
          <defs>
            <radialGradient id={g('s')}>
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#fcd34d" />
            </radialGradient>
          </defs>
          <path d={arc(-78, -38, 56)} fill="none" stroke="#c4b5fd" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
          <path d={star(87, 13, 12)} fill={url('s')} stroke="#f59e0b" strokeWidth=".5" className="fx fx-twinkle" />
          <path d={star(12, 88, 8)} fill={url('s')} stroke="#f59e0b" strokeWidth=".5" className="fx fx-twinkle fx-late" />
          <path d={star(96, 31, 3.5)} fill="#ede9fe" />
        </>
      )}
      {id === 'lead' && (
        <>
          <path d={arc(155, 205, 58)} fill="none" stroke="#2dd4bf" strokeWidth="4" strokeLinecap="round" />
          <path d={arc(-25, 25, 58)} fill="none" stroke="#2dd4bf" strokeWidth="4" strokeLinecap="round" />
          <path d={arc(164, 196, 63)} fill="none" stroke="#99f6e4" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
          <path d={arc(-16, 16, 63)} fill="none" stroke="#99f6e4" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
          <path d={gem(50, 99, 7)} fill="#5eead4" stroke="#ccfbf1" strokeWidth=".9" className="fx-glint" />
        </>
      )}
    </svg>
  );
}
