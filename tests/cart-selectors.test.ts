import { describe, expect, it } from "vitest";
import { cartCount, cartSubtotal, lineItemTotal } from "@/lib/cart/selectors";
import type { CartLineItem } from "@/lib/cart/types";

// tsconfig targets ES2017 (no bigint literals); use BigInt() instead.
const big = (n: number): bigint => BigInt(n);

function line(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    lineId: "l1",
    itemId: "i1",
    variationId: "v1",
    itemName: "Latte",
    variationName: "Large",
    basePriceMoney: { amount: big(500), currency: "USD" },
    modifiers: [],
    qty: 1,
    locationId: "loc-1",
    ...overrides,
  };
}

describe("lineItemTotal", () => {
  it("returns base * qty when no modifiers", () => {
    expect(lineItemTotal(line({ qty: 3 })).amount).toBe(big(1500));
  });
  it("adds modifier prices before multiplying by qty", () => {
    const total = lineItemTotal(
      line({
        qty: 2,
        modifiers: [
          {
            modifierId: "m1",
            modifierListId: "ml1",
            name: "Oat milk",
            priceMoney: { amount: big(50), currency: "USD" },
          },
          {
            modifierId: "m2",
            modifierListId: "ml1",
            name: "Extra shot",
            priceMoney: { amount: big(75), currency: "USD" },
          },
        ],
      }),
    );
    expect(total.amount).toBe((big(500) + big(50) + big(75)) * big(2));
  });
});

describe("cartSubtotal", () => {
  it("sums multiple lines", () => {
    const sub = cartSubtotal({
      locationId: "loc-1",
      lines: [line({ qty: 1 }), line({ lineId: "l2", qty: 2 })],
    });
    expect(sub.amount).toBe(big(1500));
  });
  it("returns zero in fallback currency when empty", () => {
    expect(cartSubtotal({ locationId: null, lines: [] }).amount).toBe(big(0));
  });
  it("throws on currency mismatch across lines", () => {
    expect(() =>
      cartSubtotal({
        locationId: "loc-1",
        lines: [
          line(),
          line({
            lineId: "l2",
            basePriceMoney: { amount: big(1), currency: "EUR" },
          }),
        ],
      }),
    ).toThrow();
  });
});

describe("cartCount", () => {
  it("sums qty across lines", () => {
    expect(
      cartCount({
        locationId: "loc-1",
        lines: [line({ qty: 2 }), line({ lineId: "l2", qty: 3 })],
      }),
    ).toBe(5);
  });
  it("returns 0 on empty cart", () => {
    expect(cartCount({ locationId: null, lines: [] })).toBe(0);
  });
});
