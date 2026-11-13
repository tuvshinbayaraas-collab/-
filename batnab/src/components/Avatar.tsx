import {useState} from 'react';
import {avatarOf} from '../lib/avatars';
import {frameOf} from '../lib/frames';
import {useSettings} from '../lib/settings';

// Deep enough for the white letter on them (4.5:1 and up).
const AVATAR_COLORS = ['#dc2626', '#c2410c', '#b45309', '#15803d', '#0f766e', '#0369a1', '#7c3aed', '#db2777'];

function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/**
 * A round picture: the student's photo, a ready-made picture, or the first letter of the name; in their frame, if they
 * took one (lib/frames), the whole still `size` across. Photos are hidden while the teacher has them off.
 */
export default function Avatar({name, photo, frame, size = 36}: {name: string; photo?: string | null; frame?: string | null; size?: number}) {
  const f = frameOf(frame);
  if (!f) return <Picture name={name} photo={photo} size={size} />;
  // The ring, then a thin dark gap, so the picture stands apart from it.
  const ring = Math.max(2, Math.round(size * 0.07));
  const gap = Math.max(1, Math.round(size * 0.025));
  return (
    <div className="relative shrink-0 rounded-full" style={{width: size, height: size, padding: ring, background: f.bg}} data-frame={f.id}>
      <div className="rounded-full bg-neutral-950" style={{padding: gap}}>
        <Picture name={name} photo={photo} size={size - 2 * ring - 2 * gap} />
      </div>
      {f.mark && size >= 72 && (
        <span
          className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-neutral-950 leading-none"
          style={{bottom: -Math.round(size * 0.06), width: size * 0.3, height: size * 0.3, fontSize: size * 0.17}}
          aria-hidden
        >
          {f.mark}
        </span>
      )}
    </div>
  );
}

function Picture({name, photo, size}: {name: string; photo?: string | null; size: number}) {
  // The photo that failed to load, so a new one is tried again.
  const [broken, setBroken] = useState<string | null>(null);
  const photosOff = useSettings()?.photos === false;
  const preset = avatarOf(photo);
  if (preset)
    return (
      <div className="flex shrink-0 select-none items-center justify-center rounded-full leading-none" style={{width: size, height: size, background: preset.bg, fontSize: size * 0.56}} aria-hidden>
        {preset.emoji}
      </div>
    );
  if (photo?.startsWith('data:image/') && broken !== photo && !photosOff) {
    return (
      <img
        src={photo}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(photo)}
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
