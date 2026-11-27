// The site's look on this device: dark (as it always was), light, or following the device's own setting. Kept in the
// browser (index.html applies it before the page draws, so it never flashes the other way).
import {useSyncExternalStore} from 'react';

export type Theme = 'dark' | 'light' | 'auto';
const KEY = 'batnab.theme';

/**
 * Whether this browser can draw the light look: its see-through colours (a card's tint, the sticky bars) are mixed
 * with `color-mix`; without it (iOS before 16.2) they would stay dark, so the site stays dark there.
 */
export const lightSupported = typeof CSS !== 'undefined' && !!CSS.supports?.('color', 'color-mix(in lab, red, red)');

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'auto' ? t : 'dark';
  } catch {
    return 'dark';
  }
}

const deviceLight = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
const listeners = new Set<() => void>();
let current = readTheme();

/** Puts the look on the page: `data-theme` on <html> (theme-light.css) and the browser's bar colour. */
export function applyTheme(t: Theme = readTheme()) {
  const light = lightSupported && (t === 'light' || (t === 'auto' && !!deviceLight?.matches));
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#eff0f2' : '#0f0f0f');
  listeners.forEach((l) => l());
}

/** Whether the page shows the light look now. */
export const isLight = () => document.documentElement.dataset.theme === 'light';

// "Төхөөрөмжийн": follows the device switching between day and night.
const follow = () => current === 'auto' && applyTheme('auto');
if (deviceLight?.addEventListener) deviceLight.addEventListener('change', follow);
else deviceLight?.addListener?.(follow);

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // private window: only for this visit
  }
  current = t;
  applyTheme(t);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** The look picked, and whether the page is light now: the same everywhere (menu, settings) when either changes it. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current);
  const light = useSyncExternalStore(subscribe, isLight);
  return {theme, light, setTheme};
}
