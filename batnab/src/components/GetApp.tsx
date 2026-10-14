import {lazy, Suspense, useState} from 'react';
import {install, useInstall} from '../lib/install';

const InstallHelp = lazy(() => import('./InstallHelp'));

/**
 * "Апп татах": opens the browser's install dialog where there is one, otherwise the step-by-step guide.
 * `installed` is true when the site already runs as an installed app (nothing to offer then).
 */
export function useGetApp() {
  const {installed} = useInstall();
  const [help, setHelp] = useState(false);
  const start = async () => {
    if (!(await install())) setHelp(true);
  };
  const dialog = help ? (
    <Suspense fallback={null}>
      <InstallHelp onClose={() => setHelp(false)} />
    </Suspense>
  ) : null;
  return {installed, start, dialog};
}

export const BetaBadge = () => <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">туршилт</span>;
