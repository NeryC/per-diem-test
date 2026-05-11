import { describe, expect, it } from "vitest";
import { matchesQuery, normalize } from "@/lib/search";

describe("normalize", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalize("Café")).toBe("cafe");
    expect(normalize("  Mañana  ")).toBe("manana");
  });
});

describe("matchesQuery", () => {
  it("returns true when query is empty", () => {
    expect(matchesQuery(["anything"], "")).toBe(true);
  });
  it("matches case- and accent-insensitively across parts", () => {
    expect(matchesQuery(["Latte", "Caffè con leche"], "cafe con")).toBe(true);
    expect(matchesQuery(["Latte", null], "lAtTe")).toBe(true);
  });
  it("returns false on no match", () => {
    expect(matchesQuery(["Latte"], "donut")).toBe(false);
  });
});
