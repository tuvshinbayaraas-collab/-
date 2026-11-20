import type {CSSProperties, ReactNode} from 'react';
import {effectOf, themeOf, type Effect} from '../lib/themes';

/** The colours a theme puts on its card (index.css .profile-theme): top and bottom, on the dark and the light look. */
export const themeVars = (id: string | null | undefined): CSSProperties | undefined => {
  const t = themeOf(id);
  return t ? ({'--t1': t.dark[0], '--t2': t.dark[1], '--t1l': t.light[0], '--t2l': t.light[1]} as CSSProperties) : undefined;
};

/**
 * A profile's card, as on Discord: in its theme's two colours (lib/themes; the site's card colour without one), with its
 * effect drifting over it: over the banner, behind what is below it (the picture, the name and the words stay clear; the
 * part below has to be positioned, `relative`, to stay in front).
 */
export function ProfileCard({
  banner,
  theme,
  effect,
  className = '',
  children,
  as: Tag = 'section',
}: {
  banner?: ReactNode;
  theme?: string | null;
  effect?: string | null;
  className?: string;
  children: ReactNode;
  as?: 'section' | 'div';
}) {
  const t = themeOf(theme);
  return (
    <Tag className={`relative overflow-hidden ${t ? 'profile-theme' : 'bg-neutral-900'} ${className}`} style={themeVars(theme)} data-profile-theme={t?.id ?? ''}>
      {banner}
      <ProfileEffect id={effect} />
      {children}
    </Tag>
  );
}

const HEART = (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.6 1.2 4.6 2.7C12 6.2 13.6 5 15.6 5 19 5 21.1 8.4 19.6 11.8 17.5 16.4 12 21 12 21z" />
  </svg>
);

/** One bit of an effect: a dot, a ring, a strip, a streak, a heart or a sign. */
function Bit({e, i}: {e: Effect; i: number}) {
  const shape = e.shape === 'text' ? '' : `pe-${e.shape}`;
  return <i className={`pe-g ${shape} ${e.glow ? 'pe-glow' : ''}`}>{e.shape === 'heart' ? HEART : e.shape === 'text' ? e.glyphs![i % e.glyphs!.length] : null}</i>;
}

/**
 * The effect over a card (lib/themes): a dozen or so bits, each set a little apart from the others (the same every time,
 * nothing random), drifting where motion is welcome and still where it isn't (index.css .pe-*). Only to look at.
 */
export function ProfileEffect({id, count = 14}: {id?: string | null; count?: number}) {
  const e = effectOf(id);
  if (!e) return null;
  return (
    <div className={`pe pe-${e.motion} ${e.extra ? `pe-${e.extra}` : ''} pointer-events-none absolute inset-0 overflow-hidden`} aria-hidden data-effect={e.id}>
      {Array.from({length: count}, (_, i) => {
        const d = e.speed + ((i * 7) % 5) * (e.speed / 6);
        return (
          <span
            key={i}
            className="pe-p"
            style={
              {
                left: `${(i * 37 + 11) % 97}%`,
                color: e.colors[i % e.colors.length],
                '--y': `${(i * 53 + 17) % 92}%`,
                '--s': `${e.size + ((i * 5) % 6)}px`,
                '--d': `${d.toFixed(2)}s`,
                '--dl': `${(-((i * 1.7) % d)).toFixed(2)}s`,
              } as CSSProperties
            }
          >
            <Bit e={e} i={i} />
          </span>
        );
      })}
    </div>
  );
}
