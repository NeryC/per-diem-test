import { describe, expect, it } from "vitest";
import {
  toZonedParts,
  zonedDateToUTC,
  type ZonedParts,
} from "@/lib/time/zoned";

describe("toZonedParts", () => {
  it("returns NY local parts for a UTC instant", () => {
    // 2026-05-12T19:00:00Z = 15:00 EDT (UTC-4)
    const parts = toZonedParts(
      new Date("2026-05-12T19:00:00Z"),
      "America/New_York",
    );
    expect(parts).toEqual<ZonedParts>({
      year: 2026,
      month: 5,
      day: 12,
      hour: 15,
      minute: 0,
      dayOfWeek: "TUE",
    });
  });

  it("handles DST forward in NY (March 8, 2026 02:30 -> 03:30)", () => {
    // 2026-03-08T07:30:00Z is 03:30 EDT.
    const parts = toZonedParts(
      new Date("2026-03-08T07:30:00Z"),
      "America/New_York",
    );
    expect(parts.hour).toBe(3);
    expect(parts.minute).toBe(30);
  });
});

describe("zonedDateToUTC", () => {
  it("returns the UTC instant for a wall-clock time in NY", () => {
    // 2026-05-12 15:00 EDT = 19:00 UTC
    const utc = zonedDateToUTC(
      { year: 2026, month: 5, day: 12, hour: 15, minute: 0 },
      "America/New_York",
    );
    expect(utc.toISOString()).toBe("2026-05-12T19:00:00.000Z");
  });

  it("returns a deterministic instant during DST fall-back ambiguity", () => {
    // Nov 1, 2026 01:30 in NY occurs twice. We deterministically pick the EDT
    // (earlier) instance: 05:30Z.
    const utc = zonedDateToUTC(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      "America/New_York",
    );
    expect(utc.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
});
