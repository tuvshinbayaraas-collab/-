// Installing the site as an app ("Нүүр дэлгэцэд нэмэх"). Chrome, Edge and Samsung Internet offer an install prompt
// we can open from our own button; iPhone/iPad Safari and others only do it from their own menu, so we explain how.
import {useSyncExternalStore} from 'react';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

let prompt: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // keep the browser's own banner away; the menu has a button for it
  prompt = e as InstallPrompt;
  emit();
});
window.addEventListener('appinstalled', () => {
  prompt = null;
  installed = true;
  emit();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

/** Opened from the home-screen icon, or inside the Windows program (already an app). */
export const runningAsApp = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as {standalone?: boolean}).standalone === true ||
  (window as {__BATNAB_DESKTOP__?: boolean}).__BATNAB_DESKTOP__ === true;

/** A Windows computer: it gets the real program (batnab/desktop, built by .github/workflows/batnab-desktop.yml). */
export const isWindows = () => platform() === 'desktop' && /Windows/.test(navigator.userAgent);
export const WINDOWS_APP = 'https://github.com/tuvshinbayaraas-collab/-/releases/download/batnab-desktop/Batnab-Setup.exe';

/** Starts downloading the Windows installer (the server sends it as a file, so the page stays). */
export function downloadWindowsApp() {
  const a = document.createElement('a');
  a.href = WINDOWS_APP;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type Platform = 'ios' | 'android' | 'desktop';
export function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

let snapshot = {canPrompt: false, installed: false};
const read = () => {
  const next = {canPrompt: !!prompt, installed: installed || runningAsApp()};
  if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed) snapshot = next;
  return snapshot;
};

export const useInstall = () =>
  useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, read);

/** Opens the browser's install dialog; false when the browser offers none (show instructions instead). */
export async function install() {
  if (!prompt) return false;
  const p = prompt;
  prompt = null;
  emit();
  await p.prompt();
  const {outcome} = await p.userChoice;
  if (outcome === 'accepted') {
    installed = true;
    emit();
  }
  return true;
}
