"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, parseMoney, type Money } from "@/lib/money";
import type { WireItem, WireItemVariation } from "@/lib/types";

export interface ItemCardProps {
  item: WireItem;
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

export function ItemCard({ item }: ItemCardProps): ReactNode {
  const price = priceLabel(item.variations);

  return (
    <Link
      href={`/items/${item.id}`}
      className="focus-visible:ring-ring block rounded-xl focus:outline-none focus-visible:ring-2"
    >
      <Card className="h-full">
        {item.imageUrl ? (
          <div className="relative aspect-square w-full">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          </div>
        ) : null}
        <CardContent className="flex flex-col gap-1 px-4">
          <h3 className="leading-tight font-medium">{item.name}</h3>
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
