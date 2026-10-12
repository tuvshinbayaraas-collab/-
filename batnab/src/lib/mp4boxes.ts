// Reading the top-level structure of ISO-BMFF (MP4) / QuickTime (MOV) files.

export interface Box {
  type: string;
  start: number;
  size: number;
  /** Header length: 8, or 16 with a 64-bit size. */
  header: number;
}

export const fourcc = (v: DataView, at: number) =>
  String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

/** The file's top-level boxes, or null if it isn't a well-formed ISO-BMFF/QuickTime file. */
export async function topLevelBoxes(file: Blob): Promise<Box[] | null> {
  const boxes: Box[] = [];
  let offset = 0;
  while (offset + 8 <= file.size) {
    if (boxes.length >= 200_000) return null;
    const head = new DataView(await file.slice(offset, offset + 16).arrayBuffer());
    let size = head.getUint32(0);
    const header = size === 1 ? 16 : 8;
    if (size === 1) size = Number(head.getBigUint64(8));
    else if (size === 0) size = file.size - offset; // runs to the end of the file
    if (size < header || offset + size > file.size) return null; // corrupt or truncated
    boxes.push({type: fourcc(head, 4), start: offset, size, header});
    offset += size;
  }
  return boxes;
}
