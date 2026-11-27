// After a new version is published, a page opened before it still asks for the old version's files, which are gone
// (the server answers with the page itself), so the screen would go blank. Loading the page again gets the new version.

/** A failed download of part of the site (each browser words it differently). */
export const isChunkError = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(String((e as Error)?.message ?? e));

const KEY = 'batnab.reloadedForUpdate';
let reloading = false;

/** Reloads onto the new version: only when online, and not again within a few seconds, so a real outage can't loop. */
export function reloadForUpdate() {
  if (reloading) return true;
  if (!navigator.onLine) return false;
  try {
    if (Date.now() - (Number(sessionStorage.getItem(KEY)) || 0) < 10_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // without storage there is no loop guard: leave it to the reload button
  }
  reloading = true;
  location.reload();
  return true;
}
