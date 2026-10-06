import {Link} from '../lib/router';

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-1.5 shrink-0" aria-label="Batnab нүүр">
      <svg viewBox="0 0 28 20" className="h-6 w-auto" aria-hidden>
        <rect width="28" height="20" rx="5" fill="#ef4444" />
        <path d="M11 5.5l7.5 4.5-7.5 4.5z" fill="#fff" />
      </svg>
      <span className="text-xl font-extrabold tracking-tight">Batnab</span>
    </Link>
  );
}
