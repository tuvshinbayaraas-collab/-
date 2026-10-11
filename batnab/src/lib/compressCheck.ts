// Cheap checks that decide whether to offer compression, without loading the encoder library.

export const TARGET_SHORT_SIDE = 720;
/** Above this average bitrate a file is worth shrinking even if it is already 720p. */
const MAX_BITRATE = 4_000_000;
/** Very long videos would need too much memory/time to convert in a tab. */
const MAX_DURATION = 30 * 60;

export async function compressionSupported(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') return false;
  try {
    const [video, audio] = await Promise.all([
      VideoEncoder.isConfigSupported({codec: 'avc1.4d401f', width: 1280, height: 720, bitrate: 2_500_000}),
      AudioEncoder.isConfigSupported({codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128_000}),
    ]);
    return !!video.supported && !!audio.supported;
  } catch {
    return false;
  }
}

/** Whether shrinking this file would help, judging by its size, resolution and length. */
export function worthCompressing(meta: {width: number; height: number; duration: number; size: number}) {
  if (!meta.duration || meta.duration > MAX_DURATION || !meta.width || !meta.height) return false;
  const shortSide = Math.min(meta.width, meta.height);
  const bitrate = (meta.size * 8) / meta.duration;
  return shortSide > TARGET_SHORT_SIDE || bitrate > MAX_BITRATE;
}

/**
 * Biggest file we rewrite just to move the index; beyond this we upload as-is. The rewrite briefly
 * holds the file in memory about twice over, so phones (which crash a tab sooner) get a lower cap.
 */
export function maxRemuxBytes() {
  const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return (phone ? 300 : 800) * 1024 ** 2;
}

/**
 * True for an MP4/MOV whose index ("moov") sits after the media data, as many cameras and editors
 * write it. Players then have to fetch the end of the file before the first frame, so start-up is
 * slower over Drive. Reads only the box headers, not the file.
 */
export async function needsFastStart(file: Blob): Promise<boolean> {
  const view = async (at: number, len: number) => new DataView(await file.slice(at, at + len).arrayBuffer());
  let offset = 0;
  for (let i = 0; i < 64 && offset + 8 <= file.size; i++) {
    const head = await view(offset, 16);
    let size = head.getUint32(0);
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
    if (i === 0 && type !== 'ftyp') return false; // not an ISO-BMFF file (e.g. WebM)
    if (type === 'moov') return false;
    if (type === 'mdat') return true;
    if (size === 1) size = Number(head.getBigUint64(8));
    if (size < 8) return false; // size 0 = "to end of file", or corrupt
    offset += size;
  }
  return false;
}
