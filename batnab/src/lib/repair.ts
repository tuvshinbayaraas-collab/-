// Fixing videos uploaded before uploads were made stream-friendly (see faststart.ts): fragmented
// MP4s, which browsers read in full on every view, and MP4s with their index at the end. The owner's
// browser downloads the file with their own Drive access, rewrites it losslessly and replaces the
// contents of the same Drive file, so the video keeps its link, views and comments.
import {downloadFile, driveMediaUrl, driveStreamUrl, getDriveToken, replaceFileContent} from './drive';
import {streamable} from './faststart';
import {fourcc} from './mp4boxes';

export type SlowLayout = 'fragmented' | 'moovAtEnd';
export type LayoutCheck = {layout: SlowLayout; size: number} | 'fine' | 'unknown';

/**
 * Looks at the start of the file: with the public key, or with the owner's token (which works even
 * when Drive is limiting public downloads of the file). 'unknown' when Drive refused the public read.
 */
export async function checkLayout(driveId: string, token?: string): Promise<LayoutCheck> {
  try {
    const res = await fetch(token ? driveMediaUrl(driveId) : driveStreamUrl(driveId), {
      headers: {Range: 'bytes=0-262143', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    });
    // 403 is Drive limiting public downloads (worth checking with the owner's login); anything else,
    // e.g. a deleted file, isn't something a rewrite can help with.
    if (res.status === 403) return 'unknown';
    if (res.status !== 206) return 'fine';
    const size = Number(res.headers.get('Content-Range')?.split('/')[1]) || 0;
    const v = new DataView(await res.arrayBuffer());
    let at = 0;
    let seenMoov = false;
    while (at + 8 <= v.byteLength) {
      let boxSize = v.getUint32(at);
      const type = fourcc(v, at + 4);
      if (boxSize === 1 && at + 16 <= v.byteLength) boxSize = Number(v.getBigUint64(at + 8));
      if (at === 0 && type !== 'ftyp') return 'fine'; // not an MP4/MOV
      if (type === 'moof') return {layout: 'fragmented', size};
      if (type === 'mdat') return seenMoov ? 'fine' : {layout: 'moovAtEnd', size};
      if (type === 'moov') seenMoov = true;
      if (boxSize < 8) return 'fine';
      at += boxSize;
    }
    return 'fine';
  } catch {
    return 'fine';
  }
}

export type RepairStage = 'check' | 'download' | 'fix' | 'upload';

/**
 * Rewrites the video's Drive file in place. Must be called straight from a click (Drive consent
 * popup). 'fine' when the file needs nothing, 'unchanged' when it can't be rewritten automatically.
 */
export async function repairVideo(
  driveId: string,
  onProgress: (stage: RepairStage, fraction: number) => void,
): Promise<'fixed' | 'fine' | 'unchanged'> {
  const token = await getDriveToken();
  onProgress('check', 0);
  const check = await checkLayout(driveId, token);
  if (check === 'fine') return 'fine';
  const blob = await downloadFile(token, driveId, (loaded, total) => onProgress('download', total ? loaded / total : 0));
  onProgress('fix', 0);
  const type = blob.type || 'video/mp4';
  const fixed = await streamable(new File([blob], 'video.mp4', {type}));
  if (!fixed) return 'unchanged';
  await replaceFileContent(token, driveId, fixed, type, (loaded) => onProgress('upload', loaded / fixed.size));
  return 'fixed';
}
