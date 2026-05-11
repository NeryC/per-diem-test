import { getCatalog } from "@/lib/square/catalog";
import { getInventory } from "@/lib/square/inventory";
import { errorResponse, jsonResponse } from "@/lib/square/responses";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventory?locationId=X
 *
 * Returns `{ [variationId]: { state, quantity } }`. The variation set is
 * derived from the cached catalog (no extra Square call), so a typical
 * request costs a single batch-get-counts hit and is then memoized for
 * 30s by `getInventory`'s `unstable_cache` wrapper.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId");
  if (!locationId) {
    return jsonResponse({ error: "missing locationId" }, { status: 400 });
  }
  const catalog = await getCatalog();
  if (!catalog.ok) return errorResponse(catalog.error);
  const variationIds = catalog.value.items.flatMap((i) =>
    i.variations.map((v) => v.id),
  );
  const inv = await getInventory({ locationId, variationIds });
  if (!inv.ok) return errorResponse(inv.error);
  return jsonResponse(inv.value, { revalidateSeconds: 30 });
}
