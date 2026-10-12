// Turn a fragmented MP4 (a small moov followed by many moof+mdat pairs, as written by OBS, some
// downloaders and screen recorders) into a regular fast-start MP4, losslessly. Browsers have no index
// for a fragmented file, so to learn its duration or to seek they read fragment after fragment — in
// practice more than the whole file on every view, which is slow and quickly uses up Drive's download
// quota. Here the per-fragment sample lists (trun) are gathered into ordinary sample tables in one
// moov that points at the original media data, gathered into a single mdat (with many top-level boxes
// after the index, the demuxer in browsers still walks them all looking for more fragments). Nothing
// is decoded or re-encoded, and the media data is never copied: the result is a Blob made of the new
// moov plus slices of the original file.
import {fourcc, type Box} from './mp4boxes';

interface Region {
  type: string;
  start: number; // offset of the box header within its buffer
  body: number; // offset of the payload
  end: number;
}

function children(v: DataView, start: number, end: number): Region[] | null {
  const out: Region[] = [];
  let at = start;
  while (at + 8 <= end) {
    let size = v.getUint32(at);
    let header = 8;
    if (size === 1) {
      size = Number(v.getBigUint64(at + 8));
      header = 16;
    } else if (size === 0) size = end - at;
    if (size < header || at + size > end) return null;
    out.push({type: fourcc(v, at + 4), start: at, body: at + header, end: at + size});
    at += size;
  }
  return out;
}

const child = (list: Region[], type: string) => list.find((r) => r.type === type);

interface Defaults {
  duration: number;
  size: number;
  flags: number;
}

interface Track {
  id: number;
  trak: Region;
  parts: Region[]; // trak children
  mdiaParts: Region[];
  minfParts: Region[];
  stsd: Region;
  timescale: number;
  trex: Defaults;
  // Samples, in decode order.
  durations: number[];
  sizes: number[];
  ctos: number[];
  nonSync: number[]; // 1-based sample numbers that are NOT sync samples
  chunks: {offset: number; count: number}[]; // offsets in the original file
  firstDecodeTime: number | null;
}

const SYNC_MASK = 0x10000; // sample_is_non_sync_sample

// ----- writing -----

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function box(type: string, ...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const size = 8 + parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(ascii(type), 4);
  let at = 8;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

/** A full box whose payload (after version+flags) is written by `fill` into `bytes` bytes. */
function fullBox(type: string, version: number, bytes: number, fill: (v: DataView, at: number) => void) {
  const body = new Uint8Array(4 + bytes);
  body[0] = version;
  fill(new DataView(body.buffer), 4);
  return box(type, body);
}

/** Run-length table of (count, value) pairs, as in stts and ctts. */
function runs(values: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const v of values) {
    const last = out[out.length - 1];
    if (last && last[1] === v) last[0]++;
    else out.push([1, v]);
  }
  return out;
}

const raw = (buf: Uint8Array, r: Region) => buf.subarray(r.start, r.end);

/** Copy of a box (mvhd/tkhd/mdhd) with its duration field replaced; null if it doesn't fit. */
function withDuration(buf: Uint8Array, r: Region, durationAt: [number, number], duration: number) {
  const copy = buf.slice(r.start, r.end);
  const v = new DataView(copy.buffer);
  const version = copy[r.body - r.start];
  const at = r.body - r.start + 4 + durationAt[version === 1 ? 1 : 0];
  if (version === 1) v.setBigUint64(at, BigInt(duration));
  else if (duration > 0xffffffff) return null;
  else v.setUint32(at, duration);
  return copy;
}

// Offsets of the duration field after version+flags, for version 0 / version 1.
const MVHD_DURATION: [number, number] = [12, 20];
const TKHD_DURATION: [number, number] = [16, 24];
const MDHD_DURATION: [number, number] = [12, 20];

/**
 * A regular fast-start version of a fragmented MP4, or null if the file isn't one this can convert
 * safely (then the original is uploaded).
 */
export async function defragment(file: File, boxes: Box[]): Promise<File | null> {
  if (boxes[0]?.type !== 'ftyp') return null;
  const moovBoxes = boxes.filter((b) => b.type === 'moov');
  if (moovBoxes.length !== 1 || moovBoxes[0].size > 64 * 1024 ** 2) return null;
  const moovBox = moovBoxes[0];
  const moovBuf = new Uint8Array(await file.slice(moovBox.start, moovBox.start + moovBox.size).arrayBuffer());
  const mv = new DataView(moovBuf.buffer);
  const moovRoot = children(mv, 0, moovBuf.byteLength)?.[0];
  if (!moovRoot || moovRoot.type !== 'moov') return null;
  const moovParts = children(mv, moovRoot.body, moovRoot.end);
  const mvhd = moovParts && child(moovParts, 'mvhd');
  const mvex = moovParts && child(moovParts, 'mvex');
  if (!moovParts || !mvhd || !mvex) return null;
  const movieTimescale = mv.getUint32(mvhd.body + (mv.getUint8(mvhd.body) === 1 ? 20 : 12));

  const trexById = new Map<number, Defaults>();
  for (const r of children(mv, mvex.body, mvex.end) ?? []) {
    if (r.type !== 'trex') continue;
    trexById.set(mv.getUint32(r.body + 4), {
      duration: mv.getUint32(r.body + 12),
      size: mv.getUint32(r.body + 16),
      flags: mv.getUint32(r.body + 20),
    });
  }

  const tracks = new Map<number, Track>();
  for (const trak of moovParts.filter((r) => r.type === 'trak')) {
    const parts = children(mv, trak.body, trak.end);
    const tkhd = parts && child(parts, 'tkhd');
    const mdia = parts && child(parts, 'mdia');
    const mdiaParts = mdia && children(mv, mdia.body, mdia.end);
    const mdhd = mdiaParts && child(mdiaParts, 'mdhd');
    const minf = mdiaParts && child(mdiaParts, 'minf');
    const minfParts = minf && children(mv, minf.body, minf.end);
    const stbl = minfParts && child(minfParts, 'stbl');
    const stblParts = stbl && children(mv, stbl.body, stbl.end);
    const stsd = stblParts && child(stblParts, 'stsd');
    const stsz = stblParts && child(stblParts, 'stsz');
    if (!parts || !tkhd || !mdiaParts || !mdhd || !minfParts || !stsd || !stsz) return null;
    // A fragmented file's moov carries no samples itself; anything else is a layout we don't handle.
    if (mv.getUint32(stsz.body + 8) !== 0) return null;
    // Only a plain edit list (optional empty edit + one normal edit at rate 1) is supported.
    const id = mv.getUint32(tkhd.body + (mv.getUint8(tkhd.body) === 1 ? 20 : 12));
    const trex = trexById.get(id);
    if (!trex) return null;
    tracks.set(id, {
      id,
      trak,
      parts,
      mdiaParts,
      minfParts,
      stsd,
      timescale: mv.getUint32(mdhd.body + (mv.getUint8(mdhd.body) === 1 ? 20 : 12)),
      trex,
      durations: [],
      sizes: [],
      ctos: [],
      nonSync: [],
      chunks: [],
      firstDecodeTime: null,
    });
  }
  if (!tracks.size) return null;

  // ----- read every fragment's sample list -----
  const mdats = boxes.filter((b) => b.type === 'mdat');
  for (const moof of boxes.filter((b) => b.type === 'moof')) {
    if (moof.size > 16 * 1024 ** 2) return null;
    const buf = new Uint8Array(await file.slice(moof.start, moof.start + moof.size).arrayBuffer());
    const v = new DataView(buf.buffer);
    const top = children(v, 0, buf.byteLength)?.[0];
    const trafs = top && children(v, top.body, top.end);
    if (!trafs) return null;
    let previousTrafEnd = moof.start;
    for (const traf of trafs.filter((r) => r.type === 'traf')) {
      const parts = children(v, traf.body, traf.end);
      const tfhd = parts && child(parts, 'tfhd');
      if (!parts || !tfhd) return null;
      const tfFlags = v.getUint32(tfhd.body) & 0xffffff;
      const track = tracks.get(v.getUint32(tfhd.body + 4));
      if (!track) return null;
      let at = tfhd.body + 8;
      let base = tfFlags & 0x20000 ? moof.start : previousTrafEnd;
      if (tfFlags & 0x1) {
        base = Number(v.getBigUint64(at));
        at += 8;
      }
      if (tfFlags & 0x2) {
        if (v.getUint32(at) !== 1) return null; // a second sample description
        at += 4;
      }
      const defaults = {...track.trex};
      if (tfFlags & 0x8) (defaults.duration = v.getUint32(at)), (at += 4);
      if (tfFlags & 0x10) (defaults.size = v.getUint32(at)), (at += 4);
      if (tfFlags & 0x20) defaults.flags = v.getUint32(at);

      const tfdt = child(parts, 'tfdt');
      if (tfdt && track.firstDecodeTime === null) {
        track.firstDecodeTime = v.getUint8(tfdt.body) === 1 ? Number(v.getBigUint64(tfdt.body + 4)) : v.getUint32(tfdt.body + 4);
      }

      let dataEnd = base;
      for (const trun of parts.filter((r) => r.type === 'trun')) {
        const version = v.getUint8(trun.body);
        const flags = v.getUint32(trun.body) & 0xffffff;
        const count = v.getUint32(trun.body + 4);
        let p = trun.body + 8;
        let offset = dataEnd;
        if (flags & 0x1) (offset = base + v.getInt32(p)), (p += 4);
        let firstFlags: number | null = null;
        if (flags & 0x4) (firstFlags = v.getUint32(p)), (p += 4);
        const perSample = ((flags & 0x100 ? 1 : 0) + (flags & 0x200 ? 1 : 0) + (flags & 0x400 ? 1 : 0) + (flags & 0x800 ? 1 : 0)) * 4;
        if (p + count * perSample > trun.end) return null;
        let bytes = 0;
        for (let i = 0; i < count; i++) {
          const duration = flags & 0x100 ? v.getUint32((p += 4) - 4) : defaults.duration;
          const size = flags & 0x200 ? v.getUint32((p += 4) - 4) : defaults.size;
          const sampleFlags = flags & 0x400 ? v.getUint32((p += 4) - 4) : i === 0 && firstFlags !== null ? firstFlags : defaults.flags;
          const cto = flags & 0x800 ? (version === 0 ? v.getUint32((p += 4) - 4) : v.getInt32((p += 4) - 4)) : 0;
          track.durations.push(duration);
          track.sizes.push(size);
          track.ctos.push(cto);
          if (sampleFlags & SYNC_MASK) track.nonSync.push(track.durations.length);
          bytes += size;
        }
        if (count) {
          // The run's data must sit inside one mdat.
          if (!mdats.some((m) => offset >= m.start + m.header && offset + bytes <= m.start + m.size)) return null;
          track.chunks.push({offset, count});
        }
        dataEnd = offset + bytes;
      }
      previousTrafEnd = dataEnd;
    }
  }

  // ----- build the new moov -----
  const useCo64 = file.size > 0xffffffff;
  const trakBoxes: {track: Track; bytes: Uint8Array; offsetsAt: number}[] = [];
  let movieDuration = 0;
  for (const track of tracks.values()) {
    const n = track.durations.length;
    if (!n) return null;
    const mediaDuration = track.durations.reduce((a, b) => a + b, 0);

    // Composition offsets: keep them non-negative (ctts version 0, the most widely supported form)
    // and move the shift into the edit list instead.
    const minCto = Math.min(...track.ctos.slice(0, 1000), 0, ...track.ctos.slice(1000).filter((c) => c < 0));
    const shift = -minCto;
    const ctos = shift ? track.ctos.map((c) => c + shift) : track.ctos;

    // Edit list: the original's (empty edit + normal edit at rate 1), adjusted for the shift and for a
    // track that starts later than zero.
    let empty = 0;
    let mediaTime = 0;
    const edts = child(track.parts, 'edts');
    const elst = edts && children(mv, edts.body, edts.end)?.find((r) => r.type === 'elst');
    if (elst) {
      const version = mv.getUint8(elst.body);
      const count = mv.getUint32(elst.body + 4);
      const step = version === 1 ? 20 : 12;
      let normal = 0;
      for (let i = 0; i < count; i++) {
        const at = elst.body + 8 + i * step;
        const segment = version === 1 ? Number(mv.getBigUint64(at)) : mv.getUint32(at);
        const time = version === 1 ? Number(mv.getBigInt64(at + 8)) : mv.getInt32(at + 4);
        const rate = mv.getInt16(at + (version === 1 ? 16 : 8));
        if (time === -1) empty += segment;
        else if (rate !== 1 || ++normal > 1) return null;
        else mediaTime = time;
      }
    }
    empty += Math.round(((track.firstDecodeTime ?? 0) * movieTimescale) / track.timescale);
    mediaTime += shift;
    const segment = Math.max(0, Math.round(((mediaDuration - (mediaTime - shift)) * movieTimescale) / track.timescale));
    const trackDuration = empty + segment;
    movieDuration = Math.max(movieDuration, trackDuration);

    const edit: Uint8Array[] = [];
    if (empty || mediaTime) {
      const entries: [number, number][] = [...(empty ? [[empty, -1] as [number, number]] : []), [segment, mediaTime]];
      edit.push(
        box(
          'edts',
          fullBox('elst', 0, 4 + entries.length * 12, (v, at) => {
            v.setUint32(at, entries.length);
            entries.forEach(([seg, time], i) => {
              v.setUint32(at + 4 + i * 12, seg);
              v.setInt32(at + 8 + i * 12, time);
              v.setInt16(at + 12 + i * 12, 1);
            });
          }),
        ),
      );
    }

    const stts = runs(track.durations);
    const ctts = ctos.some((c) => c !== 0) ? runs(ctos) : null;
    const uniform = track.sizes.every((s) => s === track.sizes[0]);
    const stscRuns: [number, number][] = [];
    track.chunks.forEach((c, i) => {
      if (stscRuns[stscRuns.length - 1]?.[1] !== c.count) stscRuns.push([i + 1, c.count]);
    });
    const tables = [
      raw(moovBuf, track.stsd),
      fullBox('stts', 0, 4 + stts.length * 8, (v, at) => {
        v.setUint32(at, stts.length);
        stts.forEach(([count, value], i) => (v.setUint32(at + 4 + i * 8, count), v.setUint32(at + 8 + i * 8, value)));
      }),
      ...(ctts
        ? [
            fullBox('ctts', 0, 4 + ctts.length * 8, (v, at) => {
              v.setUint32(at, ctts.length);
              ctts.forEach(([count, value], i) => (v.setUint32(at + 4 + i * 8, count), v.setUint32(at + 8 + i * 8, value)));
            }),
          ]
        : []),
      fullBox('stsc', 0, 4 + stscRuns.length * 12, (v, at) => {
        v.setUint32(at, stscRuns.length);
        stscRuns.forEach(([first, count], i) => {
          v.setUint32(at + 4 + i * 12, first);
          v.setUint32(at + 8 + i * 12, count);
          v.setUint32(at + 12 + i * 12, 1);
        });
      }),
      fullBox('stsz', 0, 8 + (uniform ? 0 : n * 4), (v, at) => {
        v.setUint32(at, uniform ? track.sizes[0] : 0);
        v.setUint32(at + 4, n);
        if (!uniform) track.sizes.forEach((s, i) => v.setUint32(at + 8 + i * 4, s));
      }),
      ...(track.nonSync.length
        ? [
            fullBox('stss', 0, 4 + (n - track.nonSync.length) * 4, (v, at) => {
              const sync: number[] = [];
              let k = 0;
              for (let i = 1; i <= n; i++) {
                if (track.nonSync[k] === i) k++;
                else sync.push(i);
              }
              v.setUint32(at, sync.length);
              sync.forEach((s, i) => v.setUint32(at + 4 + i * 4, s));
            }),
          ]
        : []),
    ];
    // The chunk offset table goes last so its position in the finished trak is easy to find.
    const offsets = fullBox(useCo64 ? 'co64' : 'stco', 0, 4 + track.chunks.length * (useCo64 ? 8 : 4), (v, at) =>
      v.setUint32(at, track.chunks.length),
    );
    const stbl = box('stbl', ...tables, offsets);

    const mdhd = withDuration(moovBuf, child(track.mdiaParts, 'mdhd')!, MDHD_DURATION, mediaDuration);
    const tkhd = withDuration(moovBuf, child(track.parts, 'tkhd')!, TKHD_DURATION, trackDuration);
    if (!mdhd || !tkhd) return null;
    const minf = box('minf', ...track.minfParts.filter((r) => r.type !== 'stbl').map((r) => raw(moovBuf, r)), stbl);
    const mdia = box('mdia', mdhd, ...track.mdiaParts.filter((r) => r.type !== 'mdhd' && r.type !== 'minf').map((r) => raw(moovBuf, r)), minf);
    const others = track.parts.filter((r) => !['tkhd', 'edts', 'mdia'].includes(r.type)).map((r) => raw(moovBuf, r));
    const trakBytes = box('trak', tkhd, ...edit, mdia, ...others);
    // stco/co64 is the last box of stbl, which is the last of minf, the last of mdia; after mdia
    // only `others` follow.
    const tail = others.reduce((n, o) => n + o.byteLength, 0);
    trakBoxes.push({track, bytes: trakBytes, offsetsAt: trakBytes.byteLength - tail - offsets.byteLength + 16});
  }

  const mvhdBytes = withDuration(moovBuf, mvhd, MVHD_DURATION, movieDuration);
  if (!mvhdBytes) return null;
  const otherMoov = moovParts.filter((r) => !['mvhd', 'trak', 'mvex'].includes(r.type)).map((r) => raw(moovBuf, r));
  const newMoov = box('moov', mvhdBytes, ...trakBoxes.map((t) => t.bytes), ...otherMoov);

  // ----- lay out the file: ftyp, new moov, then one mdat holding the original payloads in order -----
  const ftyp = boxes[0];
  const payload = mdats.reduce((n, m) => n + m.size - m.header, 0);
  const mdatHeader = new Uint8Array(payload + 8 > 0xffffffff ? 16 : 8);
  const hv = new DataView(mdatHeader.buffer);
  if (mdatHeader.byteLength === 16) (hv.setUint32(0, 1), hv.setBigUint64(8, BigInt(payload + 16)));
  else hv.setUint32(0, payload + 8);
  mdatHeader.set(ascii('mdat'), 4);
  let position = ftyp.size + newMoov.byteLength + mdatHeader.byteLength;
  const newStart = new Map<Box, number>(); // where each original payload begins in the new file
  for (const m of mdats) {
    newStart.set(m, position);
    position += m.size - m.header;
  }
  if (!useCo64 && position > 0xffffffff) return null;
  const nv = new DataView(newMoov.buffer);
  let trakAt = 8 + mvhdBytes.byteLength;
  for (const {track, bytes, offsetsAt} of trakBoxes) {
    let at = trakAt + offsetsAt;
    for (const c of track.chunks) {
      const m = mdats.find((b) => c.offset >= b.start && c.offset < b.start + b.size)!;
      const moved = newStart.get(m)! + (c.offset - m.start - m.header);
      if (useCo64) nv.setBigUint64(at, BigInt(moved)), (at += 8);
      else nv.setUint32(at, moved), (at += 4);
    }
    trakAt += bytes.byteLength;
  }

  const parts: BlobPart[] = [
    file.slice(0, ftyp.size),
    newMoov,
    mdatHeader,
    ...mdats.map((m) => file.slice(m.start + m.header, m.start + m.size)),
  ];
  return new File(parts, file.name, {type: file.type, lastModified: file.lastModified});
}
