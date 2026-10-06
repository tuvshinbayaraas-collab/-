import {useState} from 'react';
import {avatarColor} from '../lib/format';

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
