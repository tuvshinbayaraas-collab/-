import {Minus, Plus, X} from 'lucide-react';
import {useEffect, useRef, useState, type PointerEvent} from 'react';
import {createPortal} from 'react-dom';

const MAX = 6;
type View = {s: number; x: number; y: number};
const ONE: View = {s: 1, x: 0, y: 0};
type Point = {x: number; y: number};

/**
 * A picture on the whole screen, to read up close: two fingers or the mouse wheel zoom in where they are, a double
 * tap (double click) zooms in and back out, dragging moves the zoomed picture. A tap beside the picture or Esc closes.
 */
export default function ZoomView({url, onClose}: {url: string; onClose: () => void}) {
  const [view, setView] = useState<View>(ONE);
  const [smooth, setSmooth] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const current = useRef(ONE);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{d: number; at: Point; from: View} | null>(null);
  const moved = useRef(false);
  const onPicture = useRef(false);
  const lastTap = useRef(0);
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Keeps the zoom between 1× and MAX and the picture from leaving the screen. */
  const fit = (v: View): View => {
    const s = Math.min(MAX, Math.max(1, v.s));
    const b = box.current;
    const i = img.current;
    if (!b || !i) return {s, x: 0, y: 0};
    const mx = Math.max(0, (i.offsetWidth * s - b.clientWidth) / 2);
    const my = Math.max(0, (i.offsetHeight * s - b.clientHeight) / 2);
    return {s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y))};
  };
  /** Zoomed to `s`, keeping the picture's point under `p` (from the screen's centre) where it is. */
  const zoomAt = (from: View, s: number, p: Point) => {
    const k = Math.min(MAX, Math.max(1, s)) / from.s;
    return fit({s: from.s * k, x: p.x - (p.x - from.x) * k, y: p.y - (p.y - from.y) * k});
  };
  const apply = (v: View, animate = false) => {
    current.current = v;
    setSmooth(animate);
    setView(v);
  };
  const rel = (e: {clientX: number; clientY: number}): Point => {
    const r = box.current!.getBoundingClientRect();
    return {x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2};
  };
  const centre = () => {
    const ps = [...pointers.current.values()];
    return {x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length};
  };
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const begin = () => {
    gesture.current = {d: spread(), at: centre(), from: current.current};
  };

  const down = (e: PointerEvent) => {
    try {
      box.current?.setPointerCapture(e.pointerId);
    } catch {
      // a pointer the browser no longer tracks
    }
    if (!pointers.current.size) {
      moved.current = false;
      onPicture.current = e.target === img.current;
    }
    pointers.current.set(e.pointerId, rel(e));
    begin();
  };
  const move = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, rel(e));
    const g = gesture.current;
    const at = centre();
    if (Math.hypot(at.x - g.at.x, at.y - g.at.y) > 6) moved.current = true;
    if (pointers.current.size > 1 && g.d > 0) {
      moved.current = true;
      const z = zoomAt(g.from, (g.from.s * spread()) / g.d, g.at);
      apply(fit({s: z.s, x: z.x + at.x - g.at.x, y: z.y + at.y - g.at.y}));
    } else if (g.from.s > 1) {
      apply(fit({...g.from, x: g.from.x + at.x - g.at.x, y: g.from.y + at.y - g.at.y}));
    }
  };
  const up = (e: PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    // The finger left on the screen carries on moving the picture.
    if (pointers.current.size) return begin();
    gesture.current = null;
    if (moved.current || e.type === 'pointercancel') return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      clearTimeout(closing.current);
      const v = current.current;
      apply(v.s > 1.05 ? ONE : zoomAt(v, 2.5, rel(e)), true);
      return;
    }
    lastTap.current = now;
    // A tap beside the picture closes it, unless a second tap (zooming) follows.
    if (!onPicture.current && current.current.s <= 1.05) closing.current = setTimeout(() => lastTap.current === now && onClose(), 300);
  };
  const step = (k: number) => apply(zoomAt(current.current, current.current.s * k, {x: 0, y: 0}), true);

  useEffect(() => {
    const b = box.current;
    if (!b) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      apply(zoomAt(current.current, current.current.s * Math.exp(-e.deltaY * 0.0015), rel(e)));
    };
    // First (capture) and alone: Escape closes the picture, not a panel under it as well.
    const key = (e: KeyboardEvent) => {
      if (['Escape', '+', '=', '-', '0'].includes(e.key)) e.stopImmediatePropagation();
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') step(1.5);
      else if (e.key === '-') step(1 / 1.5);
      else if (e.key === '0') apply(ONE, true);
    };
    b.addEventListener('wheel', wheel, {passive: false});
    window.addEventListener('keydown', key, true);
    return () => {
      b.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key, true);
      clearTimeout(closing.current);
    };
    // The handlers only read refs and set state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const zoomed = view.s > 1.05;
  const btn = 'flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/85 text-neutral-100 hover:bg-neutral-800 disabled:opacity-40';
  // On top of everything, also when opened from inside a panel.
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/90" role="dialog" aria-modal="true" aria-label="Зураг">
      <div
        ref={box}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={`flex h-full w-full touch-none select-none items-center justify-center overflow-hidden p-3 ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
      >
        <img
          ref={img}
          src={url}
          alt=""
          draggable={false}
          className="max-h-full max-w-full rounded-lg bg-white object-contain"
          style={{transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: smooth ? 'transform 0.18s ease-out' : 'none'}}
        />
      </div>
      <button onClick={onClose} aria-label="Хаах" className={`${btn} absolute right-3 top-3`}>
        <X size={20} />
      </button>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <button onClick={() => step(1 / 1.5)} disabled={!zoomed} aria-label="Жижигрүүлэх" className={btn}>
          <Minus size={18} />
        </button>
        <button onClick={() => apply(ONE, true)} className="h-10 min-w-16 rounded-full bg-neutral-900/85 px-3 text-sm font-semibold tabular-nums text-neutral-100 hover:bg-neutral-800" aria-label="Анхны хэмжээ">
          {Math.round(view.s * 100)}%
        </button>
        <button onClick={() => step(1.5)} disabled={view.s >= MAX} aria-label="Томруулах" className={btn}>
          <Plus size={18} />
        </button>
      </div>
      {!zoomed && <p className="pointer-events-none absolute bottom-16 left-0 right-0 px-4 text-center text-xs text-neutral-400">Хоёр хуруугаар эсвэл хулганы дугуйгаар томруулна · давхар товшино</p>}
    </div>,
    document.body,
  );
}
