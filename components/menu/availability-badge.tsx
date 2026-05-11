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
 */

export interface AvailabilityBadgeProps {
  state: AvailabilityState;
  locationTimezone: string;
}

export function AvailabilityBadge({
  state,
  locationTimezone,
}: AvailabilityBadgeProps): ReactNode {
  if (state.kind === "available") return null;

  if (state.kind === "opens_at") {
    const todayFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: locationTimezone,
      hour: "numeric",
      minute: "2-digit",
    });
    const futureFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: locationTimezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    const label =
      state.reason === "out_of_window_today"
        ? `Opens at ${todayFmt.format(state.nextOpen)}`
        : `Opens ${futureFmt.format(state.nextOpen)}`;
    // aria-label always includes weekday so screen-reader users get explicit
    // context regardless of which branch produced the visible label.
    const ariaLabel = `Opens at ${futureFmt.format(state.nextOpen)}, currently closed`;
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-100 text-amber-900"
        aria-label={ariaLabel}
      >
        <span aria-hidden="true">⏰</span>
        <span>{label}</span>
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
