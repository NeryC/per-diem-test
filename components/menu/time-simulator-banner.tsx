"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTimeContext } from "@/lib/time/provider";

/**
 * TimeSimulatorBanner — opt-in surface for demoing alternate times.
 *
 * Only renders when the URL contains ?at=, so real users never see
 * it. Exit clears the param via router.replace so back-navigation
 * does not collect history entries from toggling simulation.
 */
export function TimeSimulatorBanner(): ReactNode {
  const ctx = useTimeContext();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  if (!ctx.isSimulated || !ctx.simulatedAt) return null;

  const exit = (): void => {
    const next = new URLSearchParams(params.toString());
    next.delete("at");
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path);
  };

  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-100 px-4 py-2 text-amber-900">
      <span className="text-sm">
        🕐 Simulating: {fmt.format(ctx.simulatedAt)} (browser tz). Add{" "}
        <code>?at=ISO</code> to any URL to demo other times.
      </span>
      <Button size="sm" variant="outline" onClick={exit}>
        Exit simulation
      </Button>
    </div>
  );
}
