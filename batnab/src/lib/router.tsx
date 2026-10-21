import {useEffect, useState, type AnchorHTMLAttributes, type MouseEvent} from 'react';

const NAV_EVENT = 'batnab:navigate';

let guard: ((to: string) => boolean) | null = null;
let guarded = '';

/** While set, asked before going to another page of the site (an exam is on), also by the back button; false stays. */
export function setNavGuard(g: ((to: string) => boolean) | null) {
  guard = g;
  guarded = location.pathname + location.search;
}

// Back or forward while asked first: the address has already changed, so put it back when the answer is to stay
// (before the page follows it: this listener is the first one).
window.addEventListener('popstate', (e) => {
  const to = location.pathname + location.search;
  if (!guard || to === guarded || guard(to)) return;
  e.stopImmediatePropagation();
  history.pushState(null, '', guarded);
});

export function navigate(to: string) {
  if (to === location.pathname + location.search) return;
  if (guard && !guard(to)) return;
  history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
  window.scrollTo(0, 0);
}

export function useLocation() {
  const get = () => ({path: location.pathname, query: new URLSearchParams(location.search)});
  const [loc, setLoc] = useState(get);
  useEffect(() => {
    const update = () => setLoc(get());
    window.addEventListener('popstate', update);
    window.addEventListener(NAV_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAV_EVENT, update);
    };
  }, []);
  return loc;
}

export function Link({href, onClick, ...rest}: AnchorHTMLAttributes<HTMLAnchorElement> & {href: string}) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
