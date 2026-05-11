"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns false on the SSR render and the first client render, then
 * true after mount. Backed by useSyncExternalStore so the snapshot
 * is consistent during hydration — used to gate client-only state
 * (persisted cart, persisted location) so SSR markup matches the
 * first client render and React does not warn about a mismatch.
 */

function subscribe(): () => void {
  return (): void => undefined;
}

function getSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
