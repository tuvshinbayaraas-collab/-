// Turning a picked picture into the small square JPEG that is kept in the database.

/** The largest data URL saved (the rules allow 60000 characters). */
const MAX = 58000;
export const PHOTO_SIZE = 256;

/** Reads a picked, dropped or pasted file into a decoded image. */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith('image/')) throw new Error('Зураг сонгоно уу.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error();
    return img;
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Энэ зургийг уншиж чадсангүй. Өөр зураг сонгоно уу.');
  }
}

/** Where the picture sits in the square frame: `zoom` 1 just covers the frame, x/y move its centre (frame pixels). */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

/** How much a frame pixel is in picture pixels' terms at this zoom. */
export const coverScale = (img: HTMLImageElement, frame: number, zoom: number) => (frame / Math.min(img.naturalWidth, img.naturalHeight)) * zoom;

/** Keeps the picture covering the whole frame. */
export function clampCrop(img: HTMLImageElement, frame: number, c: Crop): Crop {
  const zoom = Math.min(Math.max(c.zoom, 1), 4);
  const s = coverScale(img, frame, zoom);
  const mx = (img.naturalWidth * s - frame) / 2;
  const my = (img.naturalHeight * s - frame) / 2;
  return {zoom, x: Math.min(Math.max(c.x, -mx), mx), y: Math.min(Math.max(c.y, -my), my)};
}

/** What the frame shows, as a PHOTO_SIZE square JPEG data URL small enough for the database. */
export function renderCrop(img: HTMLImageElement, frame: number, c: Crop): string {
  const s = coverScale(img, frame, c.zoom);
  const side = frame / s;
  const sx = img.naturalWidth / 2 - (frame / 2 + c.x) / s;
  const sy = img.naturalHeight / 2 - (frame / 2 + c.y) / s;
  // A big photo is first halved down in steps, which looks smoother than one big jump.
  let src: CanvasImageSource = img;
  let box = {x: sx, y: sy, w: side, h: side};
  while (box.w > PHOTO_SIZE * 4) {
    const half = document.createElement('canvas');
    half.width = half.height = Math.round(box.w / 2);
    const h = half.getContext('2d')!;
    h.imageSmoothingQuality = 'high';
    h.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, half.width, half.height);
    src = half;
    box = {x: 0, y: 0, w: half.width, h: half.height};
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  for (const q of [0.85, 0.75, 0.65, 0.5, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= MAX) return url;
  }
  throw new Error('Зураг хэт том байна. Өөр зураг сонгоно уу.');
}

/** The image file in a paste or drop, if there is one. */
export function imageFile(items: DataTransferItemList | null | undefined, files?: FileList | null): File | null {
  for (const f of files ?? []) if (f.type.startsWith('image/')) return f;
  for (const it of items ?? []) if (it.kind === 'file' && it.type.startsWith('image/')) return it.getAsFile();
  return null;
}
