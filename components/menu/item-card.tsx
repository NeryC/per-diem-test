"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AvailabilityBadge } from "@/components/menu/availability-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { InventorySnapshot } from "@/lib/menu";
import { formatMoney, parseMoney, type Money } from "@/lib/money";
import type { AvailabilityState } from "@/lib/square/availability";
import type { WireItem, WireItemVariation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Below this remaining quantity an IN_STOCK variation flips to a "Low" badge. */
const LOW_STOCK_THRESHOLD = 3;

type StockSummary = "ok" | "low" | "out";

/**
 * Roll up per-variation inventory into a single card-level state.
 *
 * - All variations OUT_OF_STOCK → "out"
 * - Any tracked IN_STOCK with quantity <= threshold → "low"
 * - No tracked variations (all OTHER, or none returned) → "ok" (treat as
 *   untracked-available so we don't badge merchants who don't run inventory)
 *
 * Refs: spec §6.2, §6.3
 */
function summarizeInventory(
  item: WireItem,
  inventory: InventorySnapshot,
): StockSummary {
  const counts = item.variations.map(
    (v) => inventory[v.id] ?? { state: "OTHER" as const, quantity: 0 },
  );
  if (counts.length === 0) return "ok";
  const tracked = counts.filter((c) => c.state !== "OTHER");
  if (tracked.length === 0) return "ok";
  if (tracked.every((c) => c.state === "OUT_OF_STOCK")) return "out";
  if (
    tracked.some(
      (c) => c.state === "IN_STOCK" && c.quantity <= LOW_STOCK_THRESHOLD,
    )
  ) {
    return "low";
  }
  return "ok";
}

export interface ItemCardProps {
  item: WireItem;
  availability: AvailabilityState;
  locationTimezone: string;
  inventory: InventorySnapshot;
}

/**
 * priceLabel
 *
 * Returns a single formatted price when every variation has the same
 * priceMoney, a range like "$1.00 – $3.00" when variations differ, or
 * null when no variation has a price (free or unpriced item).
 */
function priceLabel(variations: WireItemVariation[]): string | null {
  const prices: Money[] = [];
  for (const v of variations) {
    if (v.priceMoney) prices.push(parseMoney(v.priceMoney));
  }
  if (prices.length === 0) return null;

  let min = prices[0]!;
  let max = prices[0]!;
  for (const p of prices) {
    if (p.currency !== min.currency) {
      // Mixed-currency variations are not something the UI can sensibly
      // collapse to a single label; bail to a single first-price display.
      return formatMoney(min);
    }
    if (p.amount < min.amount) min = p;
    if (p.amount > max.amount) max = p;
  }
  if (min.amount === max.amount) return formatMoney(min);
  return `${formatMoney(min)} – ${formatMoney(max)}`;
}

export function ItemCard({
  item,
  availability,
  locationTimezone,
  inventory,
}: ItemCardProps): ReactNode {
  const price = priceLabel(item.variations);
  const dimmed = availability.kind !== "available";
  const stock = summarizeInventory(item, inventory);

  return (
    <Link
      href={`/items/${item.id}`}
      className="focus-visible:ring-ring block rounded-xl focus:outline-none focus-visible:ring-2"
    >
      <Card className={cn("h-full", dimmed && "opacity-60")}>
        {item.imageUrl ? (
          <div className="relative aspect-square w-full">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
            {stock === "out" ? (
              <span className="absolute top-2 left-2 rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                Out of stock
              </span>
            ) : stock === "low" ? (
              <span className="absolute top-2 left-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                Low stock
              </span>
            ) : null}
          </div>
        ) : null}
        <CardContent className="flex flex-col gap-1 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="leading-tight font-medium">{item.name}</h3>
            <AvailabilityBadge
              state={availability}
              locationTimezone={locationTimezone}
            />
            {!item.imageUrl && stock === "out" ? (
              <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                Out of stock
              </span>
            ) : !item.imageUrl && stock === "low" ? (
              <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                Low stock
              </span>
            ) : null}
          </div>
          {item.description ? (
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {item.description}
            </p>
          ) : null}
          {price ? <p className="mt-1 text-sm font-semibold">{price}</p> : null}
        </CardContent>
      </Card>
    </Link>
  );
}
