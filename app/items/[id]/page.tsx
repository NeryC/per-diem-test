"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DataState } from "@/components/data-state";
import { ItemDetail } from "@/components/menu/item-detail";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchCatalog,
  fetchInventory,
  fetchLocations,
  type InventorySnapshot,
} from "@/lib/menu";
import {
  resolveAvailability,
  type AvailabilityState,
} from "@/lib/square/availability";
import { useNow } from "@/lib/time/provider";
import type { WireCatalog, WireItem, WireLocation } from "@/lib/types";
import { useSelectedLocation } from "@/lib/use-selected-location";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface DetailData {
  item: WireItem | null;
  catalog: WireCatalog;
  locations: WireLocation[];
}

function LoadingFallback(): ReactNode {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="aspect-video w-full rounded-xl" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

function NotFound(): ReactNode {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <p className="text-muted-foreground text-sm">
        We could not find that item.
      </p>
      <Link className="text-sm underline" href="/">
        Back to menu
      </Link>
    </div>
  );
}

export default function ItemPage({ params }: PageProps): ReactNode {
  const { id } = use(params);
  const { selectedLocationId, hasMounted } = useSelectedLocation();
  const now = useNow();

  type FetchState =
    | { status: "loading"; data: DetailData | null; error: null }
    | { status: "ready"; data: DetailData; error: null }
    | { status: "error"; data: DetailData | null; error: Error };
  const [state, setState] = useState<FetchState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const [inventory, setInventory] = useState<InventorySnapshot>({});

  // Visibility-aware inventory polling, mirroring the menu page. A failed
  // refetch keeps the last good snapshot so the variation radios don't
  // flicker between disabled and enabled on transient network errors.
  // Refs: spec §6.1
  useEffect(() => {
    if (!selectedLocationId) return;
    let cancel = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (): void => {
      if (cancel) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      timer = setTimeout(() => {
        void tick30();
      }, 30_000);
    };

    const tick30 = async (): Promise<void> => {
      try {
        const inv = await fetchInventory(selectedLocationId);
        if (!cancel) setInventory(inv);
      } catch {
        // Swallow — preserve last good inventory.
      }
      schedule();
    };

    void tick30();

    const onVis = (): void => {
      if (document.visibilityState === "visible") {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        void tick30();
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return (): void => {
      cancel = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [selectedLocationId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCatalog(), fetchLocations()])
      .then(([catalog, locations]) => {
        if (cancelled) return;
        const item = catalog.items.find((it) => it.id === id) ?? null;
        setState({
          status: "ready",
          data: { item, catalog, locations },
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState((prev) => ({
          status: "error",
          data: prev.data,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      });
    return (): void => {
      cancelled = true;
    };
  }, [id, tick]);

  const resolved = useMemo<{
    availability: AvailabilityState;
    timezone: string;
    currency: string;
  } | null>(() => {
    const data = state.data;
    if (!data || !data.item || !selectedLocationId) return null;
    const location =
      data.locations.find((l) => l.id === selectedLocationId) ?? null;
    if (!location) return null;
    const category =
      data.item.categoryId !== null
        ? (data.catalog.categories.find(
            (c) => c.id === data.item?.categoryId,
          ) ?? null)
        : null;
    const availability = resolveAvailability({
      item: data.item,
      category,
      locationId: selectedLocationId,
      locationTimezone: location.timezone,
      now,
    });
    return {
      availability,
      timezone: location.timezone,
      currency: location.currency,
    };
  }, [state.data, selectedLocationId, now]);

  if (!hasMounted) return null;

  return (
    <DataState<DetailData>
      loading={state.status === "loading"}
      error={state.error}
      data={state.data}
      isEmpty={(d) => d.item === null}
      loadingFallback={<LoadingFallback />}
      emptyFallback={<NotFound />}
      onRetry={() => setTick((t) => t + 1)}
    >
      {(d) =>
        d.item ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
            <Link className="text-sm underline" href="/">
              Back to menu
            </Link>
            <ItemDetail
              item={d.item}
              catalog={d.catalog}
              availability={resolved?.availability ?? { kind: "available" }}
              locationId={selectedLocationId ?? ""}
              locationTimezone={resolved?.timezone ?? "UTC"}
              currency={resolved?.currency ?? "USD"}
              inventory={inventory}
            />
          </div>
        ) : (
          <NotFound />
        )
      }
    </DataState>
  );
}
