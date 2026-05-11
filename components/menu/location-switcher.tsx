"use client";

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WireLocation } from "@/lib/types";

export interface LocationSwitcherProps {
  locations: WireLocation[];
  value: string | null;
  onChange: (id: string) => void;
}

/**
 * LocationSwitcher: filters out INACTIVE locations and exposes the
 * remaining set as a shadcn Select. The aria-label keeps the trigger
 * meaningful for assistive tech because the visible label is the
 * selected location's name.
 */
export function LocationSwitcher({
  locations,
  value,
  onChange,
}: LocationSwitcherProps): ReactNode {
  const active = locations.filter((l) => l.status !== "INACTIVE");
  const selected = value === null ? null : active.find((l) => l.id === value);

  return (
    <Select
      value={value ?? ""}
      onValueChange={(next) => {
        if (typeof next === "string" && next.length > 0) onChange(next);
      }}
    >
      <SelectTrigger aria-label="Select location" className="min-w-48">
        <SelectValue placeholder="Select a location">
          {selected ? selected.name : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {active.map((loc) => (
          <SelectItem key={loc.id} value={loc.id}>
            {loc.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
