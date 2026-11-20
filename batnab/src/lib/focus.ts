// Opening a page at one item of it (/topics/{id}?p=…, /review/…?q=…): the item is brought into view and lit up for a
// moment. Pictures above it may still be loading and push it down, so it is brought into view again a few times
// while they come, until the reader scrolls themselves.

const LIT = ['ring-2', 'ring-sky-400', 'ring-offset-2', 'ring-offset-neutral-950'];

export function focusOn(el: HTMLElement) {
  let stop = false;
  const off = () => (stop = true);
  const opts = {passive: true, once: true} as const;
  window.addEventListener('wheel', off, opts);
  window.addEventListener('touchstart', off, opts);
  window.addEventListener('keydown', off, opts);
  const bring = () => !stop && el.isConnected && el.scrollIntoView({block: 'start'});
  bring();
  for (const ms of [300, 800, 1600]) setTimeout(bring, ms);
  el.classList.add(...LIT);
  setTimeout(() => {
    el.classList.remove(...LIT);
    window.removeEventListener('wheel', off);
    window.removeEventListener('touchstart', off);
    window.removeEventListener('keydown', off);
  }, 2600);
}
