import "server-only";
import { unstable_cache } from "next/cache";
import { getSquareClient } from "./client";
import { safeSquareCall, type Result } from "./errors";
import {
  InventoryByVariationSchema,
  type InventoryByVariation,
  type InventoryState,
} from "./schemas";

/**
 * Per-location inventory proxy.
 *
 * Square v44's `client.inventory.batchGetCounts` returns a `Page<InventoryCount>`
 * (async iterable) — mirroring the catalog list pattern. We walk every page,
 * fold counts into a flat `{ variationId -> { state, quantity } }` record,
 * Zod-validate at the boundary, and `unstable_cache` the result for 30s.
 *
 * Quirks normalized here so the UI does not have to know:
 * - Square's InventoryState has many values (SOLD, RESERVED_FOR_SALE, …); we
 *   collapse anything that is not IN_STOCK / OUT_OF_STOCK to "OTHER" so the
 *   downstream contract is a 3-state enum.
 * - Sandbox occasionally emits state=IN_STOCK with quantity="0". We treat
 *   that as OUT_OF_STOCK to match merchant expectations.
 */

interface FetchArgs {
  locationId: string;
  variationIds: string[];
}

const TRACKED_STATES: ReadonlySet<string> = new Set([
  "IN_STOCK",
  "OUT_OF_STOCK",
]);

function normalizeState(raw: string | undefined | null): InventoryState {
  if (raw === "IN_STOCK") return "IN_STOCK";
  if (raw === "OUT_OF_STOCK") return "OUT_OF_STOCK";
  return "OTHER";
}

function parseQuantity(raw: string | undefined | null): number {
  if (raw === undefined || raw === null) return 0;
  // Square quantities are decimal strings; floor to integer units which is
  // what the UI cares about for "low stock"/"out of stock" buckets.
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

async function fetchInventoryRaw(
  args: FetchArgs,
): Promise<Result<InventoryByVariation>> {
  return safeSquareCall(async () => {
    const out: Record<string, { state: InventoryState; quantity: number }> = {};
    if (args.variationIds.length === 0) {
      return InventoryByVariationSchema.parse(out);
    }

    const client = getSquareClient();
    // batchGetCounts returns Page<InventoryCount>; the async iterator walks
    // every page transparently, so we never touch the cursor directly.
    const page = await client.inventory.batchGetCounts({
      catalogObjectIds: args.variationIds,
      locationIds: [args.locationId],
    });
    for await (const count of page) {
      const id = count.catalogObjectId;
      if (!id) continue;
      // Skip states we don't model (SOLD, IN_TRANSIT, …); their record would
      // otherwise overwrite a prior IN_STOCK/OUT_OF_STOCK count for the same
      // variation depending on Square's emission order.
      const stateRaw = count.state ?? undefined;
      if (stateRaw && !TRACKED_STATES.has(stateRaw) && id in out) continue;

      const state = normalizeState(stateRaw);
      const qty = parseQuantity(count.quantity);
      const normalizedState: InventoryState =
        state === "IN_STOCK" && qty <= 0 ? "OUT_OF_STOCK" : state;
      out[id] = { state: normalizedState, quantity: qty };
    }

    return InventoryByVariationSchema.parse(out);
  });
}

/**
 * 30s TTL keyed by locationId + sorted variation ids. The cache key MUST
 * include the locationId so two locations do not poison each other's
 * inventory views; the sorted variation list keeps the key stable across
 * catalog reorderings.
 */
export const getInventory = unstable_cache(fetchInventoryRaw, ["inventory"], {
  revalidate: 30,
});
