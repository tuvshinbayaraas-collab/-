// Whether the screen is a computer's (Tailwind's lg, 1024px and up), kept up to date as the window is resized. Parts
// shown only there (the header's links, the home page's side column) are left out of the page altogether elsewhere,
// not just hidden, so the page has one of each link.
import {useSyncExternalStore} from 'react';

const query = typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)') : null;

export const useWide = () =>
  useSyncExternalStore(
    (l) => {
      query?.addEventListener('change', l);
      return () => query?.removeEventListener('change', l);
    },
    () => !!query?.matches,
  );
