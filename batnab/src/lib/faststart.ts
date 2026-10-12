// Move an MP4/MOV's index ("moov") in front of the media data, like ffmpeg's `-movflags +faststart`
// or qt-faststart. Many cameras and editors write the index at the end, so a player has to fetch the
// end of the file before it can show the first frame. This is a lossless reshuffle of the top-level
// boxes plus a fix-up of the chunk offsets inside the index: nothing is decoded or re-encoded, every
// other byte stays exactly as it was, and the media data is never copied (the result is a Blob made of
// slices of the original file), so it is instant even for multi-gigabyte files.

interface Box {
  type: string;
  start: number;
  size: number;
}

const fourcc = (v: DataView, at: number) =>
  String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

/** The file's top-level boxes, or null if it isn't a well-formed ISO-BMFF/QuickTime file. */
async function topLevelBoxes(file: Blob): Promise<Box[] | null> {
  const boxes: Box[] = [];
  let offset = 0;
  while (offset + 8 <= file.size) {
    if (boxes.length >= 1000) return null;
    const head = new DataView(await file.slice(offset, offset + 16).arrayBuffer());
    let size = head.getUint32(0);
    if (size === 1) size = Number(head.getBigUint64(8));
    else if (size === 0) size = file.size - offset; // runs to the end of the file
    if (size < 8 || offset + size > file.size) return null; // corrupt or truncated
    boxes.push({type: fourcc(head, 4), start: offset, size});
    offset += size;
  }
  return boxes;
}

// Boxes on the way from moov down to the chunk offset tables.
const PATH = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);

/**
 * Adds `shift` to every chunk offset (stco/co64) that points into [from, to). Returns false for files
 * this simple rewrite can't handle safely (compressed index, absolute offsets elsewhere, overflow).
 */
function shiftChunkOffsets(moov: DataView, shift: number, from: number, to: number): boolean {
  const walk = (start: number, end: number): boolean => {
    let at = start;
    while (at + 8 <= end) {
      let size = moov.getUint32(at);
      let header = 8;
      if (size === 1) {
        size = Number(moov.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) return false;
      const type = fourcc(moov, at + 4);
      if (type === 'cmov' || type === 'saio' || type === 'iloc') return false;
      if (type === 'stco' || type === 'co64') {
        const wide = type === 'co64';
        const count = moov.getUint32(at + header + 4);
        let entry = at + header + 8;
        if (entry + count * (wide ? 8 : 4) > at + size) return false;
        for (let i = 0; i < count; i++, entry += wide ? 8 : 4) {
          const value = wide ? Number(moov.getBigUint64(entry)) : moov.getUint32(entry);
          if (value < from || value >= to) continue;
          if (wide) moov.setBigUint64(entry, BigInt(value + shift));
          else if (value + shift > 0xffffffff) return false;
          else moov.setUint32(entry, value + shift);
        }
      } else if (PATH.has(type) && !walk(at + header, at + size)) {
        return false;
      }
      at += size;
    }
    return true;
  };
  return walk(0, moov.byteLength);
}

/**
 * The same file with its index moved right after `ftyp`, or null when that isn't needed or isn't safe
 * (not an MP4/MOV, index already first, unusual layout) — then upload the original.
 */
export async function fastStart(file: File): Promise<File | null> {
  const boxes = await topLevelBoxes(file);
  if (!boxes || boxes[0]?.type !== 'ftyp') return null;
  const moovs = boxes.filter((b) => b.type === 'moov');
  const firstMdat = boxes.findIndex((b) => b.type === 'mdat');
  if (moovs.length !== 1 || firstMdat < 0) return null;
  const moovBox = moovs[0];
  if (boxes.indexOf(moovBox) < firstMdat || moovBox.size > 256 * 1024 ** 2) return null;

  const insertAt = boxes[0].size; // right after ftyp
  const moov = new Uint8Array(await file.slice(moovBox.start, moovBox.start + moovBox.size).arrayBuffer());
  // Everything between ftyp and the old index moves down by the index's size; data after it stays put.
  if (!shiftChunkOffsets(new DataView(moov.buffer), moov.byteLength, insertAt, moovBox.start)) return null;

  const parts: BlobPart[] = [file.slice(0, insertAt), moov];
  for (const b of boxes.slice(1)) if (b !== moovBox) parts.push(file.slice(b.start, b.start + b.size));
  return new File(parts, file.name, {type: file.type, lastModified: file.lastModified});
}
