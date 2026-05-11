import { describe, expect, it } from "vitest";
import { resolveAvailability } from "@/lib/square/availability";
import type { WireCategory, WireItem } from "@/lib/types";

const NY = "America/New_York";

function makeItem(overrides: Partial<WireItem> = {}): WireItem {
  return {
    id: "item-1",
    name: "Test Item",
    description: null,
    imageUrl: null,
    categoryId: "cat-1",
    variations: [
      {
        id: "var-1",
        name: "Default",
        priceMoney: { amount: "100", currency: "USD" },
        ordinal: 0,
        presentAtAllLocations: true,
        presentAtLocationIds: [],
        absentAtLocationIds: [],
      },
    ],
    modifierListInfo: [],
    presentAtAllLocations: true,
    presentAtLocationIds: [],
    absentAtLocationIds: [],
    ...overrides,
  };
}

function makeCategory(
  windows: WireCategory["availabilityWindows"] = [],
  overrides: WireCategory["locationOverrides"] = {},
): WireCategory {
  return {
    id: "cat-1",
    name: "Test",
    availabilityWindows: windows,
    locationOverrides: overrides,
    presentAtAllLocations: true,
    presentAtLocationIds: [],
    absentAtLocationIds: [],
  };
}

describe("resolveAvailability", () => {
  it("1. item with no category restrictions is always available", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"),
    });
    expect(result.kind).toBe("available");
  });

  it("2. item inside its category window is available", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "08:00", endLocal: "20:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"), // 15:00 EDT Tue
    });
    expect(result.kind).toBe("available");
  });

  it("3. item outside window today but opens later same day → opens_at", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "16:00", endLocal: "20:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T17:00:00Z"), // 13:00 EDT Tue — opens at 16:00 EDT
    });
    expect(result.kind).toBe("opens_at");
    if (result.kind !== "opens_at") return;
    expect(result.nextOpen.toISOString()).toBe("2026-05-12T20:00:00.000Z");
  });

  it("4. item already closed today, opens tomorrow → opens_at next day", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "08:00", endLocal: "10:00" } },
        { dayOfWeek: "WED", range: { startLocal: "08:00", endLocal: "10:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"), // 15:00 EDT Tue — closed; opens Wed
    });
    expect(result.kind).toBe("opens_at");
    if (result.kind !== "opens_at") return;
    expect(result.nextOpen.toISOString()).toBe("2026-05-13T12:00:00.000Z");
  });

  it("5. DST forward: resolver does not crash near 02:30 in March in NY", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "SUN", range: { startLocal: "02:00", endLocal: "04:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-03-08T07:30:00Z"),
    });
    expect(
      result.kind === "available" ||
        result.kind === "opens_at" ||
        result.kind === "closed_today",
    ).toBe(true);
  });

  it("6. DST backward: resolver picks deterministic instant", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "SUN", range: { startLocal: "01:00", endLocal: "03:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-11-01T05:30:00Z"),
    });
    expect(result.kind).toBe("available");
  });

  it("7. window crossing midnight: hour 23 and hour 01 are both available", () => {
    // Pre-split at normalization time — TUE 22:00-23:59 + WED 00:00-02:00.
    const cat = makeCategory([
      { dayOfWeek: "TUE", range: { startLocal: "22:00", endLocal: "23:59" } },
      { dayOfWeek: "WED", range: { startLocal: "00:00", endLocal: "02:00" } },
    ]);
    const at23 = resolveAvailability({
      item: makeItem(),
      category: cat,
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-13T03:00:00Z"), // 23:00 EDT Tue
    });
    expect(at23.kind).toBe("available");
    const at01 = resolveAvailability({
      item: makeItem(),
      category: cat,
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-13T05:00:00Z"), // 01:00 EDT Wed
    });
    expect(at01.kind).toBe("available");
  });

  it("8. location override beats category default", () => {
    const cat = makeCategory(
      [{ dayOfWeek: "TUE", range: { startLocal: "08:00", endLocal: "20:00" } }],
      {
        "loc-1": [
          {
            dayOfWeek: "TUE",
            range: { startLocal: "16:00", endLocal: "20:00" },
          },
        ],
      },
    );
    const result = resolveAvailability({
      item: makeItem(),
      category: cat,
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T17:00:00Z"), // 13:00 EDT Tue — covered by default but not by override
    });
    expect(result.kind).toBe("opens_at");
  });

  it("9. item absent at location → unavailable_at_location", () => {
    const result = resolveAvailability({
      item: makeItem({
        presentAtAllLocations: true,
        absentAtLocationIds: ["loc-1"],
      }),
      category: makeCategory(),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"),
    });
    expect(result.kind).toBe("unavailable_at_location");
  });

  it("11. closed_today when only window is today's and it has passed", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "08:00", endLocal: "10:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"), // 15:00 EDT TUE — already closed, no other window
    });
    expect(result.kind).toBe("closed_today");
  });

  it("10. multiple overlapping windows: takes the active one or earliest next", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "10:00", endLocal: "14:00" } },
        { dayOfWeek: "TUE", range: { startLocal: "12:00", endLocal: "16:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T16:00:00Z"), // 12:00 EDT Tue — covered by both
    });
    expect(result.kind).toBe("available");
  });
});
