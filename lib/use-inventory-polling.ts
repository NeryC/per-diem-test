"use client";
import { useEffect, useRef, useState } from "react";
import { fetchInventory, type InventorySnapshot } from "./menu";

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls /api/inventory for the given location every 30 seconds while the
 * document is visible. A failed fetch keeps the last good snapshot — inventory
 * is supplementary, not blocking, so a transient network blip should not wipe
 * the badges. Concurrent fetches are guarded with a monotonic fetch id; only
 * the latest response is allowed to commit.
 *
 * Returns the latest snapshot. Empty object until the first response lands.
 */
export function useInventoryPolling(
  locationId: string | null,
): InventorySnapshot {
  const [inventory, setInventory] = useState<InventorySnapshot>({});
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!locationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale inventory when the caller has no active location
      setInventory({});
      return;
    }
    let cancel = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (): void => {
      if (cancel) return;
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        void tick();
      }, POLL_INTERVAL_MS);
    };

    const tick = async (): Promise<void> => {
      if (cancel) return;
      const myId = ++fetchIdRef.current;
      try {
        const inv = await fetchInventory(locationId);
        // Only the latest in-flight call may commit; older ones are ignored.
        if (!cancel && myId === fetchIdRef.current) {
          setInventory(inv);
        }
      } catch {
        // Keep last good snapshot. Inventory is supplementary.
      }
      schedule();
    };

    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        timer = null;
        void tick();
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    void tick();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      cancel = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [locationId]);

  return inventory;
}
