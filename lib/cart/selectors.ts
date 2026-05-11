import { addMoney, multiplyMoney, zeroMoney, type Money } from "@/lib/money";
import type { CartLineItem, CartState } from "./types";

/**
 * Pure cart math.
 *
 * All operations go through addMoney/multiplyMoney so the currency-
 * mismatch invariant is enforced at every step. Empty cart returns
 * zero in USD as a harmless fallback; callers should branch on
 * cartCount === 0 before showing money anyway.
 *
 * Refs: spec §4.3
 */

export function lineItemTotal(line: CartLineItem): Money {
  let perUnit = line.basePriceMoney;
  for (const m of line.modifiers) {
    perUnit = addMoney(perUnit, m.priceMoney);
  }
  return multiplyMoney(perUnit, line.qty);
}

export function cartSubtotal(state: CartState): Money {
  const first = state.lines[0];
  if (!first) return zeroMoney("USD");
  let total = lineItemTotal(first);
  for (let i = 1; i < state.lines.length; i++) {
    const l = state.lines[i];
    if (!l) continue;
    total = addMoney(total, lineItemTotal(l));
  }
  return total;
}

export function cartCount(state: CartState): number {
  let n = 0;
  for (const l of state.lines) n += l.qty;
  return n;
}
