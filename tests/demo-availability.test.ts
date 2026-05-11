import { describe, expect, it } from "vitest";
import { getDemoWindows } from "@/lib/square/demo-availability";

describe("demo availability overlay", () => {
  it("returns Breakfast windows for the seeded breakfast category", () => {
    const windows = getDemoWindows("seed: Breakfast");
    expect(windows).not.toBeNull();
    if (!windows) throw new Error("expected breakfast windows");
    expect(windows).toHaveLength(5);
    expect(windows[0]).toEqual({
      dayOfWeek: "MON",
      range: { startLocal: "06:00", endLocal: "11:00" },
    });
  });

  it("returns null for unknown categories", () => {
    expect(getDemoWindows("seed: Coffee")).toBeNull();
    expect(getDemoWindows("anything else")).toBeNull();
  });
});
