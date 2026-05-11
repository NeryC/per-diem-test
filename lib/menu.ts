import type {
  WireCatalog,
  WireCategory,
  WireItem,
  WireLocation,
} from "./types";

/**
 * Client-side fetchers and pure menu selectors.
 *
 * isItemAtLocation encodes Square's three-flag presence contract
 * (presentAtAllLocations, presentAtLocationIds, absentAtLocationIds)
 * exactly once so every UI surface filters consistently.
 */

export async function fetchLocations(): Promise<WireLocation[]> {
  const res = await fetch("/api/locations", { cache: "no-store" });
  if (!res.ok) throw new Error(`locations: ${res.status}`);
  return (await res.json()) as WireLocation[];
}

export async function fetchCatalog(): Promise<WireCatalog> {
  const res = await fetch("/api/catalog", { cache: "no-store" });
  if (!res.ok) throw new Error(`catalog: ${res.status}`);
  return (await res.json()) as WireCatalog;
}

/**
 * Inventory snapshot keyed by variation id. `OTHER` covers Square states
 * the proxy could not collapse (e.g. SOLD, RESERVED_FOR_SALE) and is
 * treated by the UI as "untracked / assume available".
 */
export interface InventoryEntry {
  state: "IN_STOCK" | "OUT_OF_STOCK" | "OTHER";
  quantity: number;
}
export type InventorySnapshot = Record<string, InventoryEntry>;

export async function fetchInventory(
  locationId: string,
): Promise<InventorySnapshot> {
  const res = await fetch(
    `/api/inventory?locationId=${encodeURIComponent(locationId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`inventory: ${res.status}`);
  return (await res.json()) as InventorySnapshot;
}

export function isItemAtLocation(item: WireItem, locationId: string): boolean {
  if (item.absentAtLocationIds.includes(locationId)) return false;
  if (item.presentAtAllLocations) return true;
  return item.presentAtLocationIds.includes(locationId);
}

export interface CategoryGroup {
  category: WireCategory | null;
  items: WireItem[];
}

/**
 * Group items by category using the wire-order of `categories` as the
 * source of truth for sort order. Items whose categoryId is null or
 * references an unknown category are returned in a tail `{ category: null }`
 * group so they remain visible rather than silently dropped.
 */
export function groupItemsByCategory(
  items: WireItem[],
  categories: WireCategory[],
): CategoryGroup[] {
  const byId = new Map<string, WireItem[]>();
  for (const c of categories) byId.set(c.id, []);
  const uncategorized: WireItem[] = [];

  for (const item of items) {
    if (item.categoryId !== null && byId.has(item.categoryId)) {
      // Map.get can return undefined per the type, but we just `set` it
      // above so it is always defined here.
      const bucket = byId.get(item.categoryId);
      if (bucket) bucket.push(item);
    } else {
      uncategorized.push(item);
    }
  }

  const groups: CategoryGroup[] = [];
  for (const c of categories) {
    const bucket = byId.get(c.id);
    if (bucket && bucket.length > 0) {
      groups.push({ category: c, items: bucket });
    }
  }
  if (uncategorized.length > 0) {
    groups.push({ category: null, items: uncategorized });
  }
  return groups;
}
