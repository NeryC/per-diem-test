/**
 * SSR-safe, version-keyed wrapper around `localStorage` that round-trips
 * JSON. Only suitable for plain-JSON-serializable values — no `Date`,
 * no `bigint`, no `Map`. Shapes that carry `bigint` (e.g. cart lines)
 * must be serialized into JSON-safe form before being passed in.
 *
 * The helper is intentionally tiny and side-effect-light:
 *   - On SSR / missing `localStorage`, reads return `null` and writes
 *     are silent no-ops rather than throwing.
 *   - Corrupted JSON is treated like a cache miss and the bad key is
 *     dropped on the floor so the next write starts fresh.
 *   - Quota errors during `writeCache` clear the key (same recovery as
 *     a corrupt entry) instead of propagating to the caller.
 *
 * Callers MUST version their keys (e.g. `"perdiem-catalog-cache-v1"`)
 * so future shape changes can bump the suffix and shed stale caches
 * without a runtime migration.
 */

export interface CachedEntry<T> {
  /** The cached value as it was passed to {@link writeCache}. */
  value: T;
  /** Milliseconds since epoch when the value was written. */
  savedAt: number;
}

interface StoredShape<T> {
  v: T;
  t: number;
}

function getStorage(): Storage | null {
  // `typeof` guards against both server-side rendering and the rare
  // browser where storage is disabled (private mode in old Safari, etc.).
  if (typeof globalThis === "undefined") return null;
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function readCache<T>(key: string): CachedEntry<T> | null {
  const storage = getStorage();
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as StoredShape<T>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.t !== "number"
    ) {
      clearCache(key);
      return null;
    }
    return { value: parsed.v, savedAt: parsed.t };
  } catch {
    clearCache(key);
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  const storage = getStorage();
  if (!storage) return;
  const payload: StoredShape<T> = { v: value, t: Date.now() };
  try {
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded or serialization failure: drop the key so a later
    // smaller payload has a chance to land cleanly.
    clearCache(key);
  }
}

export function clearCache(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Nothing actionable from here.
  }
}
