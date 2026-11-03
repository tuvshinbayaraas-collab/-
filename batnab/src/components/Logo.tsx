import {useId} from 'react';
import {Link} from '../lib/router';

/**
 * Batnab's mark: a square root that is also a tick (a right answer), and a gold dot under its bar (the x under the
 * root), on a tile of the site's own blue. The same drawing makes the favicon and the app icons (public/icons).
 */
export function LogoMark({size = 30, className = ''}: {size?: number; className?: string}) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6b86ff" />
          <stop offset="1" stopColor="#2f3fc9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M6.6 16.9 10.4 15.2 14.3 23.4 19.5 8.7H25.8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.7" cy="16.9" r="2.55" fill="var(--color-gold)" />
    </svg>
  );
}

/** The mark and the name, to the home page. */
export default function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Batnab нүүр">
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight">Batnab</span>
    </Link>
  );
}
