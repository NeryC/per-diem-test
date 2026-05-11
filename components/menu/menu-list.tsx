"use client";

import type { ReactNode } from "react";
import { ItemCard } from "@/components/menu/item-card";
import type { CategoryGroup, InventorySnapshot } from "@/lib/menu";
import type { AvailabilityState } from "@/lib/square/availability";

export interface MenuListProps {
  groups: CategoryGroup[];
  availabilityById: Map<string, AvailabilityState>;
  locationTimezone: string;
  hideUnavailable: boolean;
  inventory: InventorySnapshot;
}

/**
 * MenuList — renders grouped item cards with availability decoration.
 *
 * When `hideUnavailable` is true, items that are not present at the
 * selected location are filtered out before render so guests do not
 * see surfaces they cannot buy. opens_at and closed_today states
 * stay visible (and clickable) so guests can preview the item.
 */
export function MenuList({
  groups,
  availabilityById,
  locationTimezone,
  hideUnavailable,
  inventory,
}: MenuListProps): ReactNode {
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => {
        const key = group.category?.id ?? "__uncategorized";
        const name = group.category?.name ?? "Other";
        const items = hideUnavailable
          ? group.items.filter(
              (it) =>
                availabilityById.get(it.id)?.kind !== "unavailable_at_location",
            )
          : group.items;
        if (items.length === 0) return null;
        return (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => {
                const availability = availabilityById.get(item.id) ?? {
                  kind: "available" as const,
                };
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    availability={availability}
                    locationTimezone={locationTimezone}
                    inventory={inventory}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
