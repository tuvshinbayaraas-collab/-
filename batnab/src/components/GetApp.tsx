import {lazy, Suspense, useSyncExternalStore} from 'react';
import {downloadWindowsApp, install, isWindows, useInstall} from '../lib/install';

const InstallHelp = lazy(() => import('./InstallHelp'));

// The step-by-step guide has one place on the page (InstallHelpHost in App), so any button can open it.
let helpOpen = false;
const listeners = new Set<() => void>();
const setHelp = (v: boolean) => {
  helpOpen = v;
  listeners.forEach((l) => l());
};
const useHelpOpen = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => helpOpen,
  );

/**
 * "Апп татах": on a Windows computer downloads the real program and shows how to install it; elsewhere opens the
 * browser's install dialog where there is one, otherwise the step-by-step guide.
 * `installed` is true when the site already runs as an installed app (nothing to offer then).
 */
export function useGetApp() {
  const {installed} = useInstall();
  const start = async () => {
    if (isWindows()) {
      downloadWindowsApp();
      setHelp(true);
    } else if (!(await install())) setHelp(true);
  };
  return {installed, start};
}

export function InstallHelpHost() {
  const open = useHelpOpen();
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <InstallHelp onClose={() => setHelp(false)} />
    </Suspense>
  );
}

export const BetaBadge = () => <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">туршилт</span>;
