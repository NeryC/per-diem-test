import type { WireCategory, WireItem } from "@/lib/types";
import { toZonedParts, zonedDateToUTC, type DayOfWeek } from "@/lib/time/zoned";

/**
 * Pure time-of-day availability resolver.
 *
 * The function is pure: `now` is injected, no globals are consulted.
 * Precedence runs presence -> override -> default -> always-on. Today's
 * windows are checked first for the available case; otherwise the
 * opens_at lookup walks up to 7 days forward and picks the earliest
 * start time in local minutes, then converts back through
 * zonedDateToUTC so the returned Date is a real instant the UI can
 * format in the location's timezone.
 *
 * Refs: spec §3.1, §3.2, §3.4
 */

export type AvailabilityState =
  | { kind: "available" }
  | {
      kind: "opens_at";
      nextOpen: Date;
      reason: "category_window" | "out_of_window_today";
    }
  | { kind: "closed_today" }
  | { kind: "unavailable_at_location" };

const DOW_ORDER: readonly DayOfWeek[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

function minutesOfDay(hh: string): number {
  const [h, m] = hh.split(":").map((n) => Number.parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

function isItemAtLocation(item: WireItem, locationId: string): boolean {
  if (item.absentAtLocationIds.includes(locationId)) return false;
  if (item.presentAtAllLocations) return true;
  return item.presentAtLocationIds.includes(locationId);
}

function effectiveWindows(
  category: WireCategory,
  locationId: string,
): WireCategory["availabilityWindows"] {
  const override = category.locationOverrides[locationId];
  if (override !== undefined) return override;
  return category.availabilityWindows;
}

export function resolveAvailability(input: {
  item: WireItem;
  category: WireCategory | null;
  locationId: string;
  locationTimezone: string;
  now: Date;
}): AvailabilityState {
  const { item, category, locationId, locationTimezone, now } = input;
  if (!isItemAtLocation(item, locationId)) {
    return { kind: "unavailable_at_location" };
  }
  if (!category) return { kind: "available" };

  const windows = effectiveWindows(category, locationId);
  if (windows.length === 0) return { kind: "available" };

  const here = toZonedParts(now, locationTimezone);
  const nowMinutes = here.hour * 60 + here.minute;
  const todayWindows = windows.filter((w) => w.dayOfWeek === here.dayOfWeek);
  for (const w of todayWindows) {
    const start = minutesOfDay(w.range.startLocal);
    const end = minutesOfDay(w.range.endLocal);
    if (nowMinutes >= start && nowMinutes <= end) {
      return { kind: "available" };
    }
  }

  // Look for the next opening within the next 7 days (today included).
  const todayIdx = DOW_ORDER.indexOf(here.dayOfWeek);
  for (let offset = 0; offset < 8; offset++) {
    const dayIdx = (todayIdx + offset) % 7;
    const dow = DOW_ORDER[dayIdx];
    if (!dow) continue;
    const candidates = windows
      .filter((w) => w.dayOfWeek === dow)
      .map((w) => minutesOfDay(w.range.startLocal))
      .filter((mins) => offset > 0 || mins > nowMinutes)
      .sort((a, b) => a - b);
    const startMin = candidates[0];
    if (startMin === undefined) continue;
    const startHour = Math.floor(startMin / 60);
    const startMinute = startMin % 60;
    const targetDateUTC = new Date(
      now.getTime() + offset * 24 * 60 * 60 * 1000,
    );
    const targetParts = toZonedParts(targetDateUTC, locationTimezone);
    const nextOpen = zonedDateToUTC(
      {
        year: targetParts.year,
        month: targetParts.month,
        day: targetParts.day,
        hour: startHour,
        minute: startMinute,
      },
      locationTimezone,
    );
    return {
      kind: "opens_at",
      nextOpen,
      reason: offset === 0 ? "out_of_window_today" : "category_window",
    };
  }
  return { kind: "closed_today" };
}
