import {useEffect, useState, type AnchorHTMLAttributes, type MouseEvent} from 'react';

const NAV_EVENT = 'batnab:navigate';

export function navigate(to: string) {
  if (to === location.pathname + location.search) return;
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
