"use client";

import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";
import { AvailabilityBadge } from "@/components/menu/availability-badge";
import { Button } from "@/components/ui/button";
import { formatMoney, parseMoney } from "@/lib/money";
import type { AvailabilityState } from "@/lib/square/availability";
import type { WireItem } from "@/lib/types";

export interface ItemDetailProps {
  item: WireItem;
  availability: AvailabilityState;
  locationTimezone: string;
}

/**
 * ItemDetail
 *
 * Variation selector previews price per option because that's what guests
 * need before deciding. The "Add to cart" button is intentionally disabled
 * here; cart wiring lights up in stage 5.
 *
 * Refs: spec §2 core requirement 5
 */
export function ItemDetail({
  item,
  availability,
  locationTimezone,
}: ItemDetailProps): ReactNode {
  const first = item.variations[0];
  const [variationId, setVariationId] = useState<string | null>(
    first ? first.id : null,
  );

  const selected = item.variations.find((v) => v.id === variationId) ?? first;
  const priceLabel =
    selected && selected.priceMoney
      ? formatMoney(parseMoney(selected.priceMoney))
      : null;

  return (
    <article className="flex flex-col gap-6">
      {item.imageUrl ? (
        <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-xl">
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 1024px) 100vw, 800px"
            className="object-cover"
          />
        </div>
      ) : null}

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          <AvailabilityBadge
            state={availability}
            locationTimezone={locationTimezone}
          />
        </div>
        {item.description ? (
          <p className="text-muted-foreground text-sm">{item.description}</p>
        ) : null}
      </header>

      {item.variations.length > 1 ? (
        <fieldset
          className="flex flex-col gap-2"
          aria-label="Choose a variation"
        >
          <legend className="text-sm font-medium">Variation</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {item.variations.map((v) => {
              const checked = v.id === variationId;
              return (
                <Button
                  key={v.id}
                  type="button"
                  variant={checked ? "default" : "outline"}
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setVariationId(v.id)}
                >
                  <span>{v.name || "Default"}</span>
                  {v.priceMoney ? (
                    <span className="ml-2 opacity-80">
                      {formatMoney(parseMoney(v.priceMoney))}
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <div className="text-lg font-semibold">{priceLabel ?? "—"}</div>
        <Button disabled>Add to cart (coming next stage)</Button>
      </div>
    </article>
  );
}
