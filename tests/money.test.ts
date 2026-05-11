import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  multiplyMoney,
  parseMoney,
  zeroMoney,
} from "@/lib/money";

// tsconfig targets ES2017 (no bigint literals); use BigInt() instead.
const big = (n: number): bigint => BigInt(n);

describe("parseMoney", () => {
  it("converts decimal-string amount to bigint", () => {
    expect(parseMoney({ amount: "1234", currency: "USD" })).toEqual({
      amount: big(1234),
      currency: "USD",
    });
  });
});

describe("zeroMoney", () => {
  it("returns a zero-amount Money in the requested currency", () => {
    expect(zeroMoney("USD")).toEqual({ amount: big(0), currency: "USD" });
  });
});

describe("formatMoney", () => {
  it("formats USD with two minor units", () => {
    expect(formatMoney({ amount: big(1234), currency: "USD" })).toBe("$12.34");
  });

  it("formats zero as $0.00", () => {
    expect(formatMoney({ amount: big(0), currency: "USD" })).toBe("$0.00");
  });

  it("respects the currency's minor-unit count for EUR", () => {
    expect(formatMoney({ amount: big(100), currency: "EUR" }, "en-US")).toMatch(
      /€1\.00/,
    );
  });
});

describe("addMoney", () => {
  it("adds two same-currency amounts", () => {
    expect(
      addMoney(
        { amount: big(100), currency: "USD" },
        { amount: big(250), currency: "USD" },
      ),
    ).toEqual({ amount: big(350), currency: "USD" });
  });

  it("throws on currency mismatch", () => {
    expect(() =>
      addMoney(
        { amount: big(100), currency: "USD" },
        { amount: big(250), currency: "EUR" },
      ),
    ).toThrow(/currency mismatch/i);
  });
});

describe("multiplyMoney", () => {
  it("multiplies by an integer quantity", () => {
    expect(multiplyMoney({ amount: big(150), currency: "USD" }, 3)).toEqual({
      amount: big(450),
      currency: "USD",
    });
  });

  it("throws on a non-integer quantity", () => {
    expect(() =>
      multiplyMoney({ amount: big(1), currency: "USD" }, 1.5),
    ).toThrow();
  });

  it("throws on a negative quantity", () => {
    expect(() =>
      multiplyMoney({ amount: big(1), currency: "USD" }, -1),
    ).toThrow();
  });
});
