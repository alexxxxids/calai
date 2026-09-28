'use client';

import { useSyncExternalStore } from 'react';

// These values never change while the page is open, so there is nothing to subscribe to.
function subscribeToNothing(): () => void {
  return () => {};
}

function onServer(): null {
  return null;
}

/**
 * A value that only the browser knows, such as its time zone: null while the server renders and
 * while React hydrates that HTML, the real value right after. Reading it straight away would make
 * the first browser render differ from the server HTML (a hydration error).
 * `read` must return a primitive (string, number, boolean) so repeated reads compare equal.
 */
export function useBrowserValue<T extends string | number | boolean>(read: () => T): T | null {
  return useSyncExternalStore(subscribeToNothing, read, onServer);
}
