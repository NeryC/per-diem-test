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
  it("returns true when query is whitespace only", () => {
    expect(matchesQuery(["anything"], "   ")).toBe(true);
  });
  it("matches case- and accent-insensitively across parts", () => {
    expect(matchesQuery(["Café latte", "with oat milk"], "cafe oat")).toBe(
      true,
    );
    expect(matchesQuery(["Latte", null], "lAtTe")).toBe(true);
  });
  it("matches when every token appears somewhere in the joined haystack", () => {
    expect(
      matchesQuery(["Iced latte", "with caramel and oat milk"], "latte oat"),
    ).toBe(true);
  });
  it("returns false when at least one token is missing", () => {
    expect(matchesQuery(["Latte"], "latte donut")).toBe(false);
  });
  it("returns false on full no-match", () => {
    expect(matchesQuery(["Latte"], "donut")).toBe(false);
  });
});
