import { describe, expect, it } from "vitest";
import { useCart } from "@/lib/cart/store";

function reset() {
  useCart.setState({ locationId: null, lines: [] });
}

describe("cart store — addLine locationId invariant", () => {
  it("initializes store locationId to the first added line's locationId", () => {
    reset();
    useCart.getState().addLine({
      itemId: "i1",
      variationId: "v1",
      itemName: "Latte",
      variationName: "L",
      basePriceMoney: { amount: BigInt(500), currency: "USD" },
      modifiers: [],
      qty: 1,
      locationId: "loc-A",
    });
    expect(useCart.getState().locationId).toBe("loc-A");
    expect(useCart.getState().lines.length).toBe(1);
  });

  it("throws when adding a line whose locationId differs from the store", () => {
    reset();
    useCart.getState().addLine({
      itemId: "i1",
      variationId: "v1",
      itemName: "Latte",
      variationName: "L",
      basePriceMoney: { amount: BigInt(500), currency: "USD" },
      modifiers: [],
      qty: 1,
      locationId: "loc-A",
    });
    expect(() =>
      useCart.getState().addLine({
        itemId: "i2",
        variationId: "v2",
        itemName: "Espresso",
        variationName: "S",
        basePriceMoney: { amount: BigInt(300), currency: "USD" },
        modifiers: [],
        qty: 1,
        locationId: "loc-B",
      }),
    ).toThrow(/locationId mismatch/);
  });

  it("allows adding more lines at the same location", () => {
    reset();
    useCart.getState().addLine({
      itemId: "i1",
      variationId: "v1",
      itemName: "Latte",
      variationName: "L",
      basePriceMoney: { amount: BigInt(500), currency: "USD" },
      modifiers: [],
      qty: 1,
      locationId: "loc-A",
    });
    useCart.getState().addLine({
      itemId: "i2",
      variationId: "v2",
      itemName: "Espresso",
      variationName: "S",
      basePriceMoney: { amount: BigInt(300), currency: "USD" },
      modifiers: [],
      qty: 1,
      locationId: "loc-A",
    });
    expect(useCart.getState().lines.length).toBe(2);
  });
});
