import {X} from 'lucide-react';
import {useEffect, useId, type ReactNode} from 'react';

/** A panel over the page: slides up from the bottom on a phone, centered on a wider screen. Escape or the backdrop closes it. */
export default function Sheet({title, sub, onClose, children}: {title: string; sub?: string; onClose: () => void; children: ReactNode}) {
  const id = useId();
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={id}>
      <div
        className="max-h-[90dvh] w-full max-w-md animate-[sheet-up_.22s_ease-out] text-left motion-reduce:animate-none overflow-y-auto rounded-t-3xl bg-neutral-900 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:animate-none sm:rounded-3xl sm:pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-neutral-700 sm:hidden" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={id} className="text-lg font-semibold">
              {title}
            </h2>
            {sub && <p className="mt-0.5 text-sm text-neutral-400">{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Хаах" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
