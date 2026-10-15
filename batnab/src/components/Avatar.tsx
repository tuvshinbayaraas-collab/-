import {useState} from 'react';
import {avatarOf} from '../lib/avatars';
import {useSettings} from '../lib/settings';

const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** A round picture: the student's photo, a ready-made picture, or the first letter of the name. Photos are hidden while the teacher has them off. */
export default function Avatar({name, photo, size = 36}: {name: string; photo?: string | null; size?: number}) {
  const [broken, setBroken] = useState(false);
  const photosOff = useSettings()?.photos === false;
  const preset = avatarOf(photo);
  if (preset)
    return (
      <div className="flex shrink-0 select-none items-center justify-center rounded-full leading-none" style={{width: size, height: size, background: preset.bg, fontSize: size * 0.56}} aria-hidden>
        {preset.emoji}
      </div>
    );
  if (photo?.startsWith('data:image/') && !broken && !photosOff) {
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
