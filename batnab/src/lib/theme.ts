// The site's look on this device: dark (as it always was), light, or following the device's own setting. Kept in the
// browser (index.html applies it before the page draws, so it never flashes the other way).
import {useState} from 'react';

export type Theme = 'dark' | 'light' | 'auto';
const KEY = 'batnab.theme';

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'auto' ? t : 'dark';
  } catch {
    return 'dark';
  }
}

const deviceLight = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;

/** Puts the look on the page: `data-theme` on <html> (theme-light.css) and the browser's bar colour. */
export function applyTheme(t: Theme = readTheme()) {
  const light = t === 'light' || (t === 'auto' && !!deviceLight?.matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#eff0f2' : '#0f0f0f');
}

// "Төхөөрөмжийн дагуу": follows the device switching between day and night.
const follow = () => readTheme() === 'auto' && applyTheme('auto');
if (deviceLight?.addEventListener) deviceLight.addEventListener('change', follow);
else deviceLight?.addListener?.(follow);

export function useTheme() {
  const [theme, setState] = useState(readTheme);
  const set = (t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // private window: only for this visit
    }
    applyTheme(t);
    setState(t);
  };
  return [theme, set] as const;
}
