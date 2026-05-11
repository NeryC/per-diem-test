"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DataState } from "@/components/data-state";
import { CategoryFilter } from "@/components/menu/category-filter";
import { LocationSwitcher } from "@/components/menu/location-switcher";
import { MenuList } from "@/components/menu/menu-list";
import { SearchBar } from "@/components/menu/search-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart/store";
import {
  fetchCatalogWithStatus,
  fetchLocationsWithStatus,
  getCachedCatalog,
  getCachedCatalogMeta,
  getCachedLocations,
  groupItemsByCategory,
  isItemAtLocation,
  type CategoryGroup,
} from "@/lib/menu";
import { matchesQuery } from "@/lib/search";
import {
  resolveAvailability,
  type AvailabilityState,
} from "@/lib/square/availability";
import { useNow } from "@/lib/time/provider";
import type { WireCatalog, WireLocation } from "@/lib/types";
import { useInventoryPolling } from "@/lib/use-inventory-polling";
import { useSelectedLocation } from "@/lib/use-selected-location";

interface MenuData {
  locations: WireLocation[];
  catalog: WireCatalog;
}

function LoadingFallback(): ReactNode {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function formatSavedAgo(savedAt: number): string {
  const diffMs = Math.max(0, Date.now() - savedAt);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "less than a minute ago";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${String(minutes)} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${String(hours)} hours ago`;
}

function StaleCacheBanner({
  savedAt,
  onRetry,
}: {
  savedAt: number;
  onRetry: () => void;
}): ReactNode {
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <span>
        Showing cached menu (saved {formatSavedAgo(savedAt)}). Latest refresh
        failed.
      </span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default function MenuHomePage(): ReactNode {
  const { selectedLocationId, setSelectedLocationId, hasMounted } =
    useSelectedLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const now = useNow();
  const setCartLocation = useCart((s) => s.setLocation);
  const forceSetCartLocation = useCart((s) => s.forceSetLocationAndClear);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const previousLocationRef = useRef<string | null>(null);

  const handleLocationChange = (id: string): void => {
    previousLocationRef.current = selectedLocationId;
    setSelectedLocationId(id);
    const r = setCartLocation(id);
    if (r.needsConfirm) setPendingLocation(id);
  };

  const handleStay = (): void => {
    const prev = previousLocationRef.current;
    if (prev !== null) setSelectedLocationId(prev);
    setPendingLocation(null);
  };

  const handleEmptyAndSwitch = (): void => {
    if (pendingLocation !== null) forceSetCartLocation(pendingLocation);
    setPendingLocation(null);
  };
  type FetchState =
    | {
        status: "loading";
        data: MenuData | null;
        error: null;
        cacheSavedAt: number | null;
      }
    | {
        status: "ready";
        data: MenuData;
        error: null;
        cacheSavedAt: number | null;
      }
    | {
        status: "error";
        data: MenuData | null;
        error: Error;
        cacheSavedAt: number | null;
      };
  // Seed from the offline cache so a returning user (or one without
  // network) sees the menu paint immediately. The background fetch
  // below will replace this with fresh data when it lands.
  const [fetchState, setFetchState] = useState<FetchState>(() => {
    const cachedLocations = getCachedLocations();
    const cachedCatalog = getCachedCatalog();
    const meta = getCachedCatalogMeta();
    if (cachedLocations && cachedCatalog) {
      return {
        status: "ready",
        data: { locations: cachedLocations, catalog: cachedCatalog },
        error: null,
        cacheSavedAt: meta ? meta.savedAt : null,
      };
    }
    return {
      status: "loading",
      data: null,
      error: null,
      cacheSavedAt: meta ? meta.savedAt : null,
    };
  });
  const [retryCount, retry] = useReducer((c: number) => c + 1, 0);
  const inventory = useInventoryPolling(selectedLocationId);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchLocationsWithStatus(), fetchCatalogWithStatus()])
      .then(([locResult, catResult]) => {
        if (cancelled) return;
        const meta = getCachedCatalogMeta();
        const data = { locations: locResult.data, catalog: catResult.data };
        const cacheSavedAt = meta ? meta.savedAt : Date.now();
        // When either fetch served from cache because of a network failure,
        // flip into the "error" branch so the stale banner renders.
        const next: FetchState =
          locResult.fromCache || catResult.fromCache
            ? {
                status: "error",
                data,
                error: new Error("Network refresh failed; showing cached data"),
                cacheSavedAt,
              }
            : { status: "ready", data, error: null, cacheSavedAt };
        setFetchState(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchState((prev) => ({
          status: "error",
          data: prev.data,
          error: err instanceof Error ? err : new Error(String(err)),
          cacheSavedAt: prev.cacheSavedAt,
        }));
      });
    return (): void => {
      cancelled = true;
    };
  }, [retryCount]);

  const data = fetchState.data;
  const loading = fetchState.status === "loading";
  const error = fetchState.error;
  const showingStale =
    fetchState.status === "error" && fetchState.data !== null;
  const cacheSavedAt = fetchState.cacheSavedAt;

  // Default to the first active location once locations load and we have
  // not yet hydrated a persisted choice from localStorage.
  useEffect(() => {
    if (!hasMounted) return;
    if (selectedLocationId !== null) return;
    if (!data) return;
    const first = data.locations.find((l) => l.status !== "INACTIVE");
    if (first) setSelectedLocationId(first.id);
  }, [hasMounted, selectedLocationId, data, setSelectedLocationId]);

  const selectedLocation = useMemo<WireLocation | null>(() => {
    if (!data || !selectedLocationId) return null;
    return data.locations.find((l) => l.id === selectedLocationId) ?? null;
  }, [data, selectedLocationId]);

  const tz = selectedLocation?.timezone ?? "UTC";

  const visibleItems = useMemo(() => {
    if (!data || !selectedLocationId) return [];
    return data.catalog.items.filter(
      (it) =>
        isItemAtLocation(it, selectedLocationId) &&
        matchesQuery([it.name, it.description], query),
    );
  }, [data, selectedLocationId, query]);

  const availabilityById = useMemo<Map<string, AvailabilityState>>(() => {
    const m = new Map<string, AvailabilityState>();
    if (!data || !selectedLocationId) return m;
    const categoriesById = new Map(
      data.catalog.categories.map((c) => [c.id, c]),
    );
    for (const item of visibleItems) {
      const category =
        item.categoryId !== null
          ? (categoriesById.get(item.categoryId) ?? null)
          : null;
      m.set(
        item.id,
        resolveAvailability({
          item,
          category,
          locationId: selectedLocationId,
          locationTimezone: tz,
          now,
        }),
      );
    }
    return m;
  }, [data, selectedLocationId, visibleItems, tz, now]);

  const groups = useMemo<CategoryGroup[]>(() => {
    if (!data) return [];
    return groupItemsByCategory(visibleItems, data.catalog.categories);
  }, [data, visibleItems]);

  const filteredGroups = useMemo<CategoryGroup[]>(() => {
    if (selectedCategory === null) return groups;
    return groups.filter((g) => {
      const id = g.category?.id ?? "__uncategorized";
      return id === selectedCategory;
    });
  }, [groups, selectedCategory]);

  // Avoid SSR/CSR mismatch on the persisted location.
  if (!hasMounted) return null;

  return (
    <>
      {showingStale && cacheSavedAt !== null ? (
        <StaleCacheBanner savedAt={cacheSavedAt} onRetry={retry} />
      ) : null}
      <DataState<MenuData>
        loading={loading}
        error={showingStale ? null : error}
        data={data}
        isEmpty={(d) => d.locations.length === 0}
        loadingFallback={<LoadingFallback />}
        emptyFallback={
          <p className="text-muted-foreground text-sm">
            No locations available right now.
          </p>
        }
        onRetry={retry}
      >
        {(d) => (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <LocationSwitcher
                locations={d.locations}
                value={selectedLocationId}
                onChange={handleLocationChange}
              />
              <SearchBar value={query} onChange={setQuery} />
            </div>
            <CategoryFilter
              categories={groups.map((g) => ({
                category: g.category,
                count: g.items.length,
              }))}
              selected={selectedCategory}
              onChange={setSelectedCategory}
            />
            {visibleItems.length === 0 ? (
              query.length > 0 ? (
                <p className="text-muted-foreground text-sm">
                  No items match &quot;{query}&quot;. Try a different word.
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No items available at this location.
                </p>
              )
            ) : (
              <MenuList
                groups={filteredGroups}
                availabilityById={availabilityById}
                locationTimezone={tz}
                hideUnavailable={true}
                inventory={inventory}
              />
            )}
          </div>
        )}
      </DataState>
      <Dialog
        open={pendingLocation !== null}
        onOpenChange={(open) => {
          if (!open) handleStay();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change location?</DialogTitle>
            <DialogDescription>
              Your cart has items from your previous location. Switching empties
              the cart. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleStay}>
              Stay at previous location
            </Button>
            <Button variant="destructive" onClick={handleEmptyAndSwitch}>
              Empty cart and switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
