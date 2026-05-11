import type { Money } from "@/lib/money";

/**
 * Cart domain types.
 *
 * Names and prices are snapshotted at add-time. A catalog refresh
 * between add and checkout never silently mutates a guest's order.
 * locationId is duplicated on the line and on the state so a
 * mistakenly cross-location cart fails fast at write time.
 *
 * Refs: spec §4.1
 */

export interface SelectedModifier {
  modifierId: string;
  modifierListId: string;
  name: string;
  /** Zero-money is allowed for modifiers without a price. */
  priceMoney: Money;
}

export interface CartLineItem {
  lineId: string;
  itemId: string;
  variationId: string;
  itemName: string;
  variationName: string;
  basePriceMoney: Money;
  modifiers: SelectedModifier[];
  qty: number;
  locationId: string;
}

export interface CartState {
  locationId: string | null;
  lines: CartLineItem[];
}
