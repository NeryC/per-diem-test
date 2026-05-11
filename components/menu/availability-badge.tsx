"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { AvailabilityState } from "@/lib/square/availability";

/**
 * AvailabilityBadge — state-aware indicator for an item's time/location
 * availability.
 *
 * Returns null when the item is available so the menu stays visually
 * quiet under normal conditions. Each non-available state combines an
 * icon glyph, text, and a color variant so the signal does not depend
 * on color alone (a11y). Time formatting uses the LOCATION's timezone,
 * not the browser's, so "Opens 11 AM" always means 11 AM at the store.
 *
 * Refs: spec §3.6, §9.1
 */

export interface AvailabilityBadgeProps {
  state: AvailabilityState;
  locationTimezone: string;
}

function formatOpenLabel(nextOpen: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return fmt.format(nextOpen);
}

export function AvailabilityBadge({
  state,
  locationTimezone,
}: AvailabilityBadgeProps): ReactNode {
  if (state.kind === "available") return null;

  if (state.kind === "opens_at") {
    const label = formatOpenLabel(state.nextOpen, locationTimezone);
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-100 text-amber-900"
        aria-label={`Opens ${label}`}
      >
        <span aria-hidden="true">⏰</span>
        <span>Opens {label}</span>
      </Badge>
    );
  }

  if (state.kind === "closed_today") {
    return (
      <Badge
        variant="outline"
        className="border-gray-300 bg-gray-100 text-gray-800"
        aria-label="Closed today"
      >
        <span aria-hidden="true">✕</span>
        <span>Closed today</span>
      </Badge>
    );
  }

  // unavailable_at_location
  return (
    <Badge variant="destructive" aria-label="Not available at this location">
      <span aria-hidden="true">⊘</span>
      <span>Not at this location</span>
    </Badge>
  );
}
