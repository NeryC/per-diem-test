/**
 * IANA-aware wall-clock helpers.
 *
 * Wraps native Intl.DateTimeFormat to translate between UTC Date
 * instants and the wall-clock parts a guest reads in the store's
 * timezone. No third-party tz library (no luxon, no date-fns-tz,
 * no temporal polyfill) by design: we ship to Node 22 / modern
 * browsers, and Intl already knows the tz database.
 *
 * The formatter map memoizes per-zone Intl objects so the hot path
 * (every badge re-render through the resolver) does not pay the
 * formatter-construction cost on each call.
 *
 * Refs: spec §3.3
 */

export type DayOfWeek = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: DayOfWeek;
}

const DOW: readonly DayOfWeek[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

function isDayOfWeek(s: string): s is DayOfWeek {
  return (DOW as readonly string[]).includes(s);
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  const cached = partsCache.get(timezone);
  if (cached) return cached;
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  partsCache.set(timezone, f);
  return f;
}

export function toZonedParts(d: Date, timezone: string): ZonedParts {
  const parts = formatter(timezone).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const dayName = (map.weekday ?? "").slice(0, 3).toUpperCase();
  const dayOfWeek: DayOfWeek = isDayOfWeek(dayName) ? dayName : "SUN";
  // Intl returns "24" for midnight in some locales; normalize to 0.
  let hour = Number.parseInt(map.hour ?? "0", 10);
  if (hour === 24) hour = 0;
  return {
    year: Number.parseInt(map.year ?? "0", 10),
    month: Number.parseInt(map.month ?? "0", 10),
    day: Number.parseInt(map.day ?? "0", 10),
    hour,
    minute: Number.parseInt(map.minute ?? "0", 10),
    dayOfWeek,
  };
}

/**
 * Convert a wall-clock time in a given IANA timezone back to a UTC Date.
 *
 * Handles DST edge cases by computing the offset implied by the formatter
 * and refining once. During fall-back ambiguity (clock runs 01:00-02:00
 * twice in November in NY), the earlier (DST) instance is picked because
 * the initial offset probe lands inside the DST side of the boundary.
 */
export function zonedDateToUTC(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
  timezone: string,
): Date {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const probed = toZonedParts(new Date(naive), timezone);
  const probedUTC = Date.UTC(
    probed.year,
    probed.month - 1,
    probed.day,
    probed.hour,
    probed.minute,
  );
  const offsetMs = naive - probedUTC;
  let candidate = new Date(naive + offsetMs);
  // One refinement pass to handle DST boundaries.
  const probed2 = toZonedParts(candidate, timezone);
  if (
    probed2.year !== parts.year ||
    probed2.month !== parts.month ||
    probed2.day !== parts.day ||
    probed2.hour !== parts.hour ||
    probed2.minute !== parts.minute
  ) {
    const probedUTC2 = Date.UTC(
      probed2.year,
      probed2.month - 1,
      probed2.day,
      probed2.hour,
      probed2.minute,
    );
    const delta = naive - probedUTC2;
    candidate = new Date(candidate.getTime() + delta);
  }
  return candidate;
}
