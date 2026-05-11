"use client";

import { useSearchParams } from "next/navigation";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

/**
 * TimeProvider — supplies `now` to every consumer.
 *
 * In real-time mode the provider re-renders every 60s so badges
 * flip from "Opens 11 AM" to "Available" without a page reload.
 * When the URL contains `?at=<ISO>`, the provider serves that
 * instant and skips the interval — useful for demoing a specific
 * time without changing system clocks.
 */

interface TimeContextValue {
  now: Date;
  isSimulated: boolean;
  simulatedAt: Date | null;
}

const TimeContext = createContext<TimeContextValue | null>(null);

function parseAtParam(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function TimeProvider({ children }: { children: ReactNode }): ReactNode {
  const params = useSearchParams();
  const simulatedAt = parseAtParam(params.get("at"));
  const [realNow, setRealNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (simulatedAt) return;
    const id = setInterval(() => setRealNow(new Date()), 60_000);
    return (): void => clearInterval(id);
    // simulatedAt is compared by reference each render, but we only
    // care whether simulation is active; using its presence is fine.
  }, [simulatedAt]);

  const value: TimeContextValue = simulatedAt
    ? { now: simulatedAt, isSimulated: true, simulatedAt }
    : { now: realNow, isSimulated: false, simulatedAt: null };

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useNow(): Date {
  const ctx = use(TimeContext);
  if (!ctx) throw new Error("useNow must be used inside <TimeProvider>");
  return ctx.now;
}

export function useTimeContext(): TimeContextValue {
  const ctx = use(TimeContext);
  if (!ctx)
    throw new Error("useTimeContext must be used inside <TimeProvider>");
  return ctx;
}
