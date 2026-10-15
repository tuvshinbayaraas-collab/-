import {Camera, ImagePlus, Minus, Plus, UserRound} from 'lucide-react';
import {useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {AVATARS, avatarId} from '../lib/avatars';
import {clampCrop, coverScale, imageFile, loadImage, renderCrop, type Crop} from '../lib/photo';
import {authError} from '../lib/session';
import {useSettings} from '../lib/settings';
import Avatar from './Avatar';
import Sheet from './Sheet';

const primary = 'rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50';
const secondary = 'flex items-center justify-center gap-2 rounded-full bg-neutral-800 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50';

const saveError = (e: unknown) => (/permission/i.test((e as Error)?.message ?? '') ? 'Хадгалж чадсангүй: эрх хүрэхгүй байна.' : authError(e));

/**
 * Changing one's picture: a photo (camera or gallery on a phone; choose, drop or paste on a PC) placed in a round frame
 * before it is saved, or one of the ready-made pictures. While the teacher has photos off, only the ready-made ones.
 */
export default function PhotoPicker({name, photo, onSave, onClose}: {name: string; photo?: string; onSave: (photo: string | null) => Promise<void>; onClose: () => void}) {
  const allowed = useSettings()?.photos !== false;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [choice, setChoice] = useState<string | null>(photo ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [touch] = useState(() => matchMedia('(pointer: coarse)').matches);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const open = async (file: File | null | undefined) => {
    if (!file) return;
    setError('');
    try {
      setImg(await loadImage(file));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = async (value: string | null) => {
    setBusy(true);
    setError('');
    try {
      await onSave(value);
      onClose();
    } catch (e) {
      setError(saveError(e));
      setBusy(false);
    }
  };

  // The picture's memory is let go once it's replaced or the sheet closes.
  useEffect(
    () => () => {
      if (img) URL.revokeObjectURL(img.src);
    },
    [img],
  );
  // While the sheet is open, a picture pasted or dropped anywhere on the page opens in the frame (and a dropped file
  // doesn't make the browser leave the site).
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!allowed) return;
    const paste = (e: ClipboardEvent) => {
      const f = imageFile(e.clipboardData?.items, e.clipboardData?.files);
      if (!f) return;
      e.preventDefault();
      openRef.current(f);
    };
    const over = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => !e.relatedTarget && setDragging(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = imageFile(e.dataTransfer?.items, e.dataTransfer?.files);
      if (f) openRef.current(f);
      else if (e.dataTransfer?.files.length) setError('Зураг биш файл байна. Зураг оруулна уу.');
    };
    window.addEventListener('paste', paste);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('paste', paste);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [allowed]);

  const input = (ref: typeof galleryRef, capture?: 'user') => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture={capture}
      hidden
      onChange={(e) => {
        open(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  if (img && allowed)
    return (
      <Sheet title="Зургаа тааруулах" sub={touch ? 'Чирж байрлуулаад, хоёр хуруугаар эсвэл доорх гулсуулагчаар томруулна.' : 'Чирж байрлуулаад, хулганы дугуйгаар эсвэл гулсуулагчаар томруулна.'} onClose={onClose}>
        <Editor key={img.src} img={img} busy={busy} error={error} onBack={() => setImg(null)} onSave={(url) => save(url)} />
      </Sheet>
    );

  const unchanged = choice === (photo ?? null);
  return (
    <Sheet title="Зураг солих" sub={allowed ? 'Өөрийн зураг эсвэл бэлэн дүрс.' : undefined} onClose={onClose}>
      <div className="flex justify-center">
        <Avatar name={name} photo={choice} size={96} />
      </div>
      {allowed ? (
        // On a PC the buttons sit in a zone a picture can be dropped on; a phone has no dropping, so just the buttons.
        <div className={touch ? 'mt-4' : `mt-4 rounded-2xl border-2 border-dashed p-3 text-center transition-colors ${dragging ? 'border-blue-400 bg-blue-500/10' : 'border-neutral-700'}`}>
          <div className={`grid gap-2 ${touch ? 'grid-cols-2' : ''}`}>
            {touch && (
              <button type="button" onClick={() => cameraRef.current?.click()} className={secondary}>
                <Camera size={16} /> Камераар авах
              </button>
            )}
            <button type="button" onClick={() => galleryRef.current?.click()} className={secondary}>
              <ImagePlus size={16} /> {touch ? 'Галерейгаас' : 'Зураг сонгох'}
            </button>
          </div>
          {!touch && <p className="mt-2 text-xs text-neutral-500">{dragging ? 'Энд тавина уу' : 'эсвэл зургаа энд чирж оруулах, Ctrl+V-ээр буулгах'}</p>}
          {input(galleryRef)}
          {input(cameraRef, 'user')}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-neutral-800/60 px-3 py-2.5 text-sm text-neutral-300">Багш өөрийн зураг тавихыг хаасан байна. Доорх дүрснүүдээс сонгоорой.</p>
      )}
      <p className="mt-5 text-sm font-medium text-neutral-300">Бэлэн дүрс</p>
      <div className="mt-2 grid grid-cols-6 gap-2">
        {Object.entries(AVATARS).map(([id, a]) => {
          const on = choice === avatarId(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setChoice(avatarId(id))}
              aria-label={a.name}
              aria-pressed={on}
              className={`flex aspect-square items-center justify-center rounded-full text-2xl leading-none sm:text-3xl transition-transform hover:scale-105 ${on ? 'ring-[3px] ring-blue-400 ring-offset-2 ring-offset-neutral-900' : ''}`}
              style={{background: a.bg}}
            >
              {a.emoji}
            </button>
          );
        })}
      </div>
      {choice && (
        <button type="button" onClick={() => setChoice(null)} className="mt-4 flex items-center gap-2 rounded-full px-1 text-sm text-neutral-400 hover:text-neutral-200">
          <UserRound size={16} /> Зураггүй болгох
        </button>
      )}
      {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className={secondary}>
          Болих
        </button>
        <button type="button" disabled={busy || unchanged} onClick={() => save(choice)} className={primary}>
          {busy ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </div>
    </Sheet>
  );
}

/** The picture in a square with a round window over it: drag to move it, pinch, scroll or slide to zoom. */
function Editor({img, busy, error, onBack, onSave}: {img: HTMLImageElement; busy: boolean; error: string; onBack: () => void; onSave: (url: string) => void}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [crop, setCrop] = useState<Crop>({x: 0, y: 0, zoom: 1});
  const pointers = useRef(new Map<number, {x: number; y: number}>());
  const pinch = useRef<{dist: number; zoom: number} | null>(null);
  const [failed, setFailed] = useState('');

  // Zooming keeps the point in the middle of the frame where it is.
  const zoomed = (c: Crop, zoom: number, size = frame) => {
    const z = Math.min(Math.max(zoom, 1), 4);
    return clampCrop(img, size, {zoom: z, x: (c.x * z) / c.zoom, y: (c.y * z) / c.zoom});
  };
  const moved = (c: Crop, dx: number, dy: number) => clampCrop(img, frame, {...c, x: c.x + dx, y: c.y + dy});

  // The frame's width in pixels; if it changes (a phone turned sideways) the picture keeps its place in it.
  const measured = useRef(0);
  useLayoutEffect(() => {
    const el = frameRef.current!;
    const measure = () => {
      const size = el.clientWidth;
      const old = measured.current;
      if (!size || size === old) return;
      measured.current = size;
      if (old) setCrop((c) => clampCrop(img, size, {...c, x: (c.x * size) / old, y: (c.y * size) / old}));
      setFrame(size);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  useEffect(() => {
    const el = frameRef.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setCrop((c) => zoomed(c, c.zoom * Math.exp(-e.deltaY * 0.0015)));
    };
    el.addEventListener('wheel', wheel, {passive: false});
    return () => el.removeEventListener('wheel', wheel);
  }, [img, frame]);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  const down = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    pinch.current = pointers.current.size === 2 ? {dist: distance(), zoom: crop.zoom} : null;
  };
  const move = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.current.size === 1) setCrop((c) => moved(c, dx, dy));
    else if (pinch.current) {
      // Two fingers: the gap between them zooms, and their midpoint (half of this finger's move) pans.
      const zoom = (pinch.current.zoom * distance()) / pinch.current.dist;
      setCrop((c) => {
        const z = zoomed(c, zoom);
        return moved(z, dx / 2, dy / 2);
      });
    }
  };
  const up = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = pointers.current.size === 2 ? {dist: distance(), zoom: crop.zoom} : null;
  };
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const go: Record<string, () => Crop> = {
      ArrowLeft: () => moved(crop, step, 0),
      ArrowRight: () => moved(crop, -step, 0),
      ArrowUp: () => moved(crop, 0, step),
      ArrowDown: () => moved(crop, 0, -step),
      '+': () => zoomed(crop, crop.zoom * 1.15),
      '=': () => zoomed(crop, crop.zoom * 1.15),
      '-': () => zoomed(crop, crop.zoom / 1.15),
    };
    if (!go[e.key]) return;
    e.preventDefault();
    setCrop(go[e.key]());
  };

  const s = frame ? coverScale(img, frame, crop.zoom) : 0;
  const finish = () => {
    setFailed('');
    try {
      onSave(renderCrop(img, frame, crop));
    } catch (e) {
      setFailed((e as Error).message);
    }
  };

  return (
    <div>
      <div
        ref={frameRef}
        tabIndex={0}
        role="group"
        aria-label="Зургийн байрлал: сумаар зөөж, + − товчоор томруулна"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        className="relative mx-auto aspect-square w-full max-w-[300px] cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-neutral-950 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 active:cursor-grabbing"
      >
        {frame > 0 && (
          <img
            src={img.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={{width: img.naturalWidth * s, height: img.naturalHeight * s, transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px)`}}
          />
        )}
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-white/80" />
      </div>
      <div className="mx-auto mt-4 flex max-w-[300px] items-center gap-3">
        <button type="button" onClick={() => setCrop((c) => zoomed(c, c.zoom - 0.25))} aria-label="Жижигрүүлэх" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
          <Minus size={18} />
        </button>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => setCrop((c) => zoomed(c, Number(e.target.value)))}
          aria-label="Томруулах"
          className="min-w-0 flex-1 accent-blue-500"
        />
        <button type="button" onClick={() => setCrop((c) => zoomed(c, c.zoom + 0.25))} aria-label="Томруулах" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800">
          <Plus size={18} />
        </button>
      </div>
      {(failed || error) && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{failed || error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onBack} className={secondary}>
          Болих
        </button>
        <button type="button" disabled={busy || !frame} onClick={finish} className={primary}>
          {busy ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </div>
    </div>
  );
}
