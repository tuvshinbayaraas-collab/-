// In-browser re-encode to 720p H.264/AAC MP4 before uploading, using WebCodecs (via mediabunny).
// Smaller files start faster and stall less for viewers on mobile data. Loaded on demand from the
// upload page so the library never weighs on other pages.
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  StreamTarget,
  type StreamTargetChunk,
} from 'mediabunny';
import {TARGET_SHORT_SIDE} from './compressCheck';

/** No progress for this long means the encoder is stuck. */
const STALL_MS = 20_000;

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function compressVideo(file: File, onProgress: (fraction: number) => void): Promise<File> {
  const input = new Input({source: new BlobSource(file), formats: ALL_FORMATS});
  const output = new Output({format: new Mp4OutputFormat({fastStart: 'in-memory'}), target: new BufferTarget()});

  const conversion = await Conversion.init({
    input,
    output,
    tracks: 'primary',
    video: (track) => {
      const w = track.displayWidth;
      const h = track.displayHeight;
      const scale = Math.min(1, TARGET_SHORT_SIDE / Math.min(w, h));
      return {
        codec: 'avc',
        width: even(w * scale),
        height: even(h * scale),
        fit: 'fill',
        quality: QUALITY_MEDIUM,
        // Bake rotation into the frames so every player shows it upright.
        allowTransformationMetadata: false,
      };
    },
    audio: {codec: 'aac', quality: QUALITY_MEDIUM},
  });
  if (!conversion.isValid) throw new Error('Энэ бичлэгийг хөтөч дээр хувиргах боломжгүй');

  // Some devices report encoder support but then stall; give up rather than hang the upload.
  let lastProgress = Date.now();
  conversion.onProgress = (p) => {
    lastProgress = Date.now();
    onProgress(p);
  };
  let stalled = false;
  const watchdog = setInterval(() => {
    if (Date.now() - lastProgress > STALL_MS) {
      stalled = true;
      clearInterval(watchdog);
      conversion.cancel().catch(() => {});
    }
  }, 1000);
  try {
    await conversion.execute();
  } catch (e) {
    throw stalled ? new Error('Шахалт зогсчихлоо') : e;
  } finally {
    clearInterval(watchdog);
  }

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error('Хувиргалт амжилтгүй боллоо');
  const name = file.name.replace(/\.[^.]+$/, '') + '.mp4';
  return new File([buffer], name, {type: 'video/mp4'});
}

/**
 * Rewrite an MP4/MOV with its index at the front, copying the audio/video data untouched (no
 * re-encoding), so playback over Drive can start without first fetching the end of the file.
 */
export async function remuxFastStart(file: File, onProgress: (fraction: number) => void): Promise<File> {
  // Collect the output as a list of pieces rather than one growing buffer, so a big file never needs
  // a single huge allocation (the browser can also page a large Blob out to disk).
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let written = 0;
  const target = new StreamTarget(
    new WritableStream<StreamTargetChunk>({
      write({data, position}) {
        // With an in-memory fast start the whole file is written front to back at the end.
        if (position !== written) throw new Error('Файлыг бэлдэж чадсангүй');
        parts.push(data as Uint8Array<ArrayBuffer>);
        written += data.byteLength;
      },
    }),
  );
  const input = new Input({source: new BlobSource(file), formats: ALL_FORMATS});
  const output = new Output({format: new Mp4OutputFormat({fastStart: 'in-memory'}), target});
  // 'forced' copy never re-encodes: a track that can't be copied as-is (or whose codec is unknown) is
  // discarded instead. Any discard means we'd lose picture or sound, so give up and upload the original.
  const conversion = await Conversion.init({input, output, tracks: 'primary', copy: {mode: 'forced'}});
  if (!conversion.isValid || conversion.discardedTracks.length || !conversion.utilizedTracks.some((t) => t.isVideoTrack())) {
    throw new Error('Файлыг бэлдэж чадсангүй');
  }
  conversion.onProgress = (p) => onProgress(p);
  await conversion.execute();
  if (!written) throw new Error('Файлыг бэлдэж чадсангүй');
  return new File(parts, file.name.replace(/\.[^.]+$/, '') + '.mp4', {type: 'video/mp4'});
}
