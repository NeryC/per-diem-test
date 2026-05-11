import "server-only";
import type { AvailabilityWindow } from "./schemas";

/**
 * Square API version 2024-12-18 removed scheduled availability from
 * CatalogCategory. The field is silently dropped on write and not echoed on
 * read. Scheduled menu availability moved to the dedicated Menus API which is
 * outside the scope of this take-home.
 *
 * To keep the time-of-day showcase demonstrable, the catalog normalizer
 * overlays the windows below when a category has empty `availabilityWindows`
 * and its name matches a key here. This is a development-time affordance; the
 * resolver, UI, tests, and wire types are unchanged.
 *
 * Production would either use the Menus API or fall back to a real
 * persistence layer keyed by category id.
 */
export const DEMO_CATEGORY_WINDOWS: Record<string, AvailabilityWindow[]> = {
  "seed: Breakfast": [
    { dayOfWeek: "MON", range: { startLocal: "06:00", endLocal: "11:00" } },
    { dayOfWeek: "TUE", range: { startLocal: "06:00", endLocal: "11:00" } },
    { dayOfWeek: "WED", range: { startLocal: "06:00", endLocal: "11:00" } },
    { dayOfWeek: "THU", range: { startLocal: "06:00", endLocal: "11:00" } },
    { dayOfWeek: "FRI", range: { startLocal: "06:00", endLocal: "11:00" } },
  ],
};

/**
 * Returns the demo windows for a category name, or null if no overlay is
 * defined. The normalizer should only apply the overlay when Square returned
 * an empty `availabilityPeriods` for the category.
 */
export function getDemoWindows(
  categoryName: string,
): AvailabilityWindow[] | null {
  return DEMO_CATEGORY_WINDOWS[categoryName] ?? null;
}
