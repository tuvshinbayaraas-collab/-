import {avatarColor} from '../lib/format';

export default function Avatar({name, size = 36}: {name: string; size?: number}) {
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
