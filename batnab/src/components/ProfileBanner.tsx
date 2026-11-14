import type {ReactNode} from 'react';
import {bannerOf, NO_BANNER, ownBanner} from '../lib/banners';

/**
 * The banner across the top of a profile (lib/banners): drawn, nothing to download; fading into the card below it so
 * the picture over its lower edge stands out.
 */
export default function ProfileBanner({id, seed, className = '', children}: {id?: string | null; seed?: string; className?: string; children?: ReactNode}) {
  const b = bannerOf(id);
  // None picked: a soft one in a colour of the student's own (from `seed`, their name), so the profile isn't bare.
  const plain = seed ? ownBanner(seed) : NO_BANNER;
  return (
    <div className={`relative overflow-hidden ${b?.fx ? `banner-${b.fx}` : ''} ${className}`} style={{background: b?.bg ?? plain}} data-banner={b?.id ?? ''}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-neutral-900/70 to-transparent" aria-hidden />
      {children}
    </div>
  );
}
