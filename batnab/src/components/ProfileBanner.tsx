import type {ReactNode} from 'react';
import {bannerOf, NO_BANNER, ownBanner} from '../lib/banners';

/** A banner's shape, as on Discord: the card's full width, a little under three times as wide as it is tall. */
export const BANNER_SHAPE = 'aspect-[17/6] w-full';

/** The banner across the top of a profile (lib/banners): drawn, nothing to download; shown whole, edge to edge. */
export default function ProfileBanner({id, seed, className = '', children}: {id?: string | null; seed?: string; className?: string; children?: ReactNode}) {
  const b = bannerOf(id);
  // None picked: a soft one in a colour of the student's own (from `seed`, their name), so the profile isn't bare.
  const plain = seed ? ownBanner(seed) : NO_BANNER;
  return (
    <div className={`relative overflow-hidden ${b?.fx ? `banner-${b.fx}` : ''} ${className}`} style={{background: b?.bg ?? plain}} data-banner={b?.id ?? ''}>
      {children}
    </div>
  );
}
