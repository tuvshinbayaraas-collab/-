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
