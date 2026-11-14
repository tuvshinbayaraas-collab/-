import type {ReactNode} from 'react';
import {bannerOf, NO_BANNER} from '../lib/banners';

/**
 * The banner across the top of a profile (lib/banners): drawn, nothing to download; fading into the card below it so
 * the picture over its lower edge stands out.
 */
export default function ProfileBanner({id, className = '', children}: {id?: string | null; className?: string; children?: ReactNode}) {
  const b = bannerOf(id);
  return (
    <div className={`relative overflow-hidden ${className}`} style={{background: b?.bg ?? NO_BANNER}} data-banner={b?.id ?? ''}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-neutral-900/70 to-transparent" aria-hidden />
      {children}
    </div>
  );
}
