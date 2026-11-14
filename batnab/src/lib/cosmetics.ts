// What a badge (lib/stats) or being a class leader opens: the special frames and banners (lib/frames, lib/banners).
// When one opens, the student is told once (users/{uid}/prefs/unlocked/{key} = when; the bell lists it for two weeks,
// lib/notifications), so they know there is something new to put on their profile.
import {BANNERS} from './banners';
import {FRAMES} from './frames';

/** The key of what opens a frame or banner: a badge's id, or 'lead'. */
const keyOf = (earn: {badge?: string; lead?: true} | undefined) => (earn ? (earn.lead ? 'lead' : (earn.badge ?? null)) : null);

/** Every key that opens something. */
export const UNLOCK_KEYS = [...new Set([...FRAMES, ...BANNERS].flatMap((x) => keyOf(x.earn) ?? []))];

/** «Галт» хүрээ, «Галт» баннер…: what the keys open. */
export const opened = (keys: string[]) => [
  ...FRAMES.filter((f) => keys.includes(keyOf(f.earn) ?? '')).map((f) => `«${f.name}» хүрээ`),
  ...BANNERS.filter((b) => keys.includes(keyOf(b.earn) ?? '')).map((b) => `«${b.name}» баннер`),
];

/** The keys open to a student: the badges earned (ids) that open something, and 'lead' for a class leader. */
export const openKeys = (earned: Iterable<string>, lead: boolean) => {
  const got = new Set(earned);
  return UNLOCK_KEYS.filter((k) => (k === 'lead' ? lead : got.has(k)));
};
