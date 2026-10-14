import {useState} from 'react';

const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function Avatar({name, photo, size = 36}: {name: string; photo?: string | null; size?: number}) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover"
        style={{width: size, height: size}}
      />
    );
  }
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-semibold text-white select-none"
      style={{width: size, height: size, background: avatarColor(name), fontSize: size * 0.42}}
      aria-hidden
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </div>
  );
}
