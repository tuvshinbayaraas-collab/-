import {Check, Loader2} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';

/** A setting row that is one big on/off switch: whatever is passed in on the left, the switch on the right. */
export default function Switch({on, busy, onChange, children, className = ''}: {on: boolean; busy?: boolean; onChange: (on: boolean) => void; children: ReactNode; className?: string}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={`flex w-full items-center gap-3 text-left outline-none transition-colors hover:bg-neutral-800/50 focus-visible:bg-neutral-800/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 disabled:cursor-wait ${className}`}
    >
      {children}
      <Knob on={on} busy={busy} />
    </button>
  );
}

/** The switch itself, like a phone's: blue with a tick when on, grey when off, a spinner while it saves. */
function Knob({on, busy}: {on: boolean; busy?: boolean}) {
  return (
    <span aria-hidden className={`inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors duration-200 ${on ? 'bg-blue-500' : 'bg-neutral-700'}`}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200 motion-reduce:transition-none ${on ? 'translate-x-6' : 'translate-x-0'}`}
      >
        {busy ? <Loader2 size={14} className="animate-spin text-neutral-500" /> : on && <Check size={14} strokeWidth={3} className="text-blue-600" />}
      </span>
    </span>
  );
}

/** "Хадгалагдлаа" for a moment after a change is saved. */
export function useSavedNote() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!count) return;
    const t = setTimeout(() => setCount(0), 1800);
    return () => clearTimeout(t);
  }, [count]);
  return [count > 0, () => setCount((n) => n + 1)] as const;
}

export function SavedNote({show}: {show: boolean}) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex justify-center">
      {show && (
        <span className="flex animate-[saved-in_.18s_ease-out] items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 shadow-lg ring-1 ring-white/10 motion-reduce:animate-none">
          <Check size={16} className="text-green-400" /> Хадгалагдлаа
        </span>
      )}
    </div>
  );
}
