"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Persisted selected-location hook.
 *
 * Selection survives reloads via localStorage with a versioned key
 * (`perdiem-selected-location-v1`) so a future shape change can bump the
 * suffix without inheriting stale data.
 *
 * Backed by `useSyncExternalStore` so the SSR snapshot is `null` (no
 * persisted value visible) and the client snapshot reads localStorage —
 * giving consumers a stable `hasMounted` flag they can use to avoid
 * SSR/CSR hydration mismatches.
 */

const STORAGE_KEY = "perdiem-selected-location-v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return (): void => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export interface UseSelectedLocationResult {
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string) => void;
  hasMounted: boolean;
}

function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => (): void => undefined,
    () => true,
    () => false,
  );
}

export function useSelectedLocation(): UseSelectedLocationResult {
  const selectedLocationId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const hasMounted = useHasMounted();

  const setSelectedLocationId = useCallback((id: string): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage may throw in private mode / disabled storage; the
      // listener notification still keeps in-tab subscribers consistent.
    }
    for (const cb of listeners) cb();
  }, []);

  return { selectedLocationId, setSelectedLocationId, hasMounted };
}
