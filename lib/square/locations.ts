import "server-only";
import { unstable_cache } from "next/cache";
import type { Square } from "square";

type SquareLocation = Square.Location;
import { getSquareClient } from "./client";
import { safeSquareCall, type Result } from "./errors";
import { LocationSchema, type Location } from "./schemas";

/**
 * Square sandbox occasionally returns half-built records (missing id, name,
 * timezone, or status). Filter those out before normalization so they never
 * surface in the UI.
 */
function isWellFormed(loc: SquareLocation): loc is SquareLocation & {
  id: string;
  name: string;
  timezone: string;
  status: string;
} {
  return (
    typeof loc.id === "string" &&
    loc.id.length > 0 &&
    typeof loc.name === "string" &&
    loc.name.length > 0 &&
    typeof loc.timezone === "string" &&
    loc.timezone.length > 0 &&
    typeof loc.status === "string" &&
    loc.status.length > 0
  );
}

async function fetchLocations(): Promise<Result<Location[]>> {
  return safeSquareCall(async () => {
    const client = getSquareClient();
    const response = await client.locations.list();
    const raw: SquareLocation[] = response.locations ?? [];
    const normalized: Location[] = raw.filter(isWellFormed).map((loc) =>
      LocationSchema.parse({
        id: loc.id,
        name: loc.name,
        timezone: loc.timezone,
        status: loc.status,
        currency: loc.currency ?? "USD",
      }),
    );
    return normalized;
  });
}

/**
 * 1h TTL keyed by `locations`; a typical session hits Square once per
 * deployment instance until the cache tag is invalidated.
 */
export const getLocations = unstable_cache(fetchLocations, ["locations"], {
  revalidate: 3600,
  tags: ["locations"],
});
