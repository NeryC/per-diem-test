"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AvailabilityBadge } from "@/components/menu/availability-badge";
import { ModifierSelector } from "@/components/cart/modifier-selector";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/store";
import type { SelectedModifier } from "@/lib/cart/types";
import type { InventorySnapshot } from "@/lib/menu";
import { addMoney, formatMoney, parseMoney } from "@/lib/money";
import type { AvailabilityState } from "@/lib/square/availability";
import type { WireCatalog, WireItem } from "@/lib/types";

/**
 * ItemDetail
 *
 * Add-to-cart is gated on three conditions in one place: availability
 * is 'available', modifier validation has no errors, and the selected
 * variation has a price. The button label switches to a contextual
 * 'Not available right now' so the user gets feedback that matches
 * the badge.
 */
export interface ItemDetailProps {
  item: WireItem;
  catalog: WireCatalog;
  availability: AvailabilityState;
  locationId: string;
  locationTimezone: string;
  /** Currency from the resolved location (fallback "USD"). */
  currency: string;
  /** Per-variation inventory snapshot for this location. */
  inventory: InventorySnapshot;
}

function pickInitialVariationId(
  item: WireItem,
  inventory: InventorySnapshot,
): string {
  const inStock = item.variations.find(
    (v) => inventory[v.id]?.state !== "OUT_OF_STOCK",
  );
  return (inStock ?? item.variations[0])?.id ?? "";
}

export function ItemDetail({
  item,
  catalog,
  availability,
  locationId,
  locationTimezone,
  currency,
  inventory,
}: ItemDetailProps): ReactNode {
  const initialVariation = item.variations[0];
  const [variationId, setVariationId] = useState<string>(() =>
    pickInitialVariationId(item, inventory),
  );
  const [userTouchedVariation, setUserTouchedVariation] = useState(false);
  const [mods, setMods] = useState<SelectedModifier[]>([]);
  const [modErrors, setModErrors] = useState<string[]>([]);
  const addLine = useCart((s) => s.addLine);

  // If the user hasn't manually changed selection AND the current selection is
  // OOS but a fresh inventory snapshot has an in-stock alternative, switch
  // over. Once the user clicks a radio, respect their choice.
  useEffect(() => {
    if (userTouchedVariation) return;
    const current = inventory[variationId];
    if (current?.state !== "OUT_OF_STOCK") return;
    const next = item.variations.find(
      (v) => inventory[v.id]?.state !== "OUT_OF_STOCK",
    );
    if (next && next.id !== variationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs selection to fresh inventory; only fires when user hasn't manually picked
      setVariationId(next.id);
    }
  }, [inventory, variationId, item.variations, userTouchedVariation]);

  const variation =
    item.variations.find((v) => v.id === variationId) ?? initialVariation;

  const totalPerUnit = useMemo(() => {
    if (!variation || !variation.priceMoney) return null;
    let total = parseMoney(variation.priceMoney);
    for (const m of mods) total = addMoney(total, m.priceMoney);
    return total;
  }, [variation, mods]);

  if (!variation) {
    return (
      <p className="text-muted-foreground">
        This item has no variations to order.
      </p>
    );
  }

  const blocked = availability.kind !== "available";
  const variationIsOOS = inventory[variation.id]?.state === "OUT_OF_STOCK";
  const canAdd =
    !blocked &&
    !variationIsOOS &&
    modErrors.length === 0 &&
    variation.priceMoney !== null;

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
              const oos = inventory[v.id]?.state === "OUT_OF_STOCK";
              return (
                <Button
                  key={v.id}
                  type="button"
                  variant={checked ? "default" : "outline"}
                  role="radio"
                  aria-checked={checked}
                  disabled={oos}
                  title={
                    oos ? "This option is currently out of stock." : undefined
                  }
                  onClick={() => {
                    setUserTouchedVariation(true);
                    setVariationId(v.id);
                  }}
                >
                  <span>{v.name || "Default"}</span>
                  {oos ? (
                    <span className="ml-1 opacity-70">(Out of stock)</span>
                  ) : null}
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

      <ModifierSelector
        item={item}
        modifierLists={catalog.modifierLists}
        currency={currency}
        onChange={(selected, errors) => {
          setMods(selected);
          setModErrors(errors);
        }}
      />

      <div className="flex flex-col gap-2 border-t pt-4">
        {totalPerUnit ? (
          <p className="text-2xl font-semibold">{formatMoney(totalPerUnit)}</p>
        ) : (
          <p className="text-muted-foreground text-lg">—</p>
        )}
        {modErrors.map((e) => (
          <p key={e} className="text-sm text-amber-700">
            {e}
          </p>
        ))}
        <Button
          className="w-full"
          disabled={!canAdd}
          title={
            variationIsOOS && !blocked
              ? "This option is currently out of stock."
              : undefined
          }
          onClick={() => {
            if (!variation.priceMoney) return;
            addLine({
              itemId: item.id,
              variationId: variation.id,
              itemName: item.name,
              variationName: variation.name,
              basePriceMoney: parseMoney(variation.priceMoney),
              modifiers: mods,
              qty: 1,
              locationId,
            });
          }}
        >
          {blocked
            ? "Not available right now"
            : variationIsOOS
              ? "Out of stock"
              : "Add to cart"}
        </Button>
      </div>
    </article>
  );
}
