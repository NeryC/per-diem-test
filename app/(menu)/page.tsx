"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DataState } from "@/components/data-state";
import { CategoryFilter } from "@/components/menu/category-filter";
import { ItemList } from "@/components/menu/item-list";
import { LocationSwitcher } from "@/components/menu/location-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchCatalog,
  fetchLocations,
  groupItemsByCategory,
  isItemAtLocation,
  type CategoryGroup,
} from "@/lib/menu";
import type { WireCatalog, WireLocation } from "@/lib/types";
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

export default function MenuHomePage(): ReactNode {
  const { selectedLocationId, setSelectedLocationId, hasMounted } =
    useSelectedLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  type FetchState =
    | { status: "loading"; data: MenuData | null; error: null }
    | { status: "ready"; data: MenuData; error: null }
    | { status: "error"; data: MenuData | null; error: Error };
  const [fetchState, setFetchState] = useState<FetchState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchLocations(), fetchCatalog()])
      .then(([locations, catalog]) => {
        if (cancelled) return;
        setFetchState({
          status: "ready",
          data: { locations, catalog },
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchState((prev) => ({
          status: "error",
          data: prev.data,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      });
    return (): void => {
      cancelled = true;
    };
  }, [tick]);

  const data = fetchState.data;
  const loading = fetchState.status === "loading";
  const error = fetchState.error;

  // Default to the first active location once locations load and we have
  // not yet hydrated a persisted choice from localStorage.
  useEffect(() => {
    if (!hasMounted) return;
    if (selectedLocationId !== null) return;
    if (!data) return;
    const first = data.locations.find((l) => l.status !== "INACTIVE");
    if (first) setSelectedLocationId(first.id);
  }, [hasMounted, selectedLocationId, data, setSelectedLocationId]);

  const visibleItems = useMemo(() => {
    if (!data || !selectedLocationId) return [];
    return data.catalog.items.filter((it) =>
      isItemAtLocation(it, selectedLocationId),
    );
  }, [data, selectedLocationId]);

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
    <DataState<MenuData>
      loading={loading}
      error={error}
      data={data}
      isEmpty={(d) => d.locations.length === 0}
      loadingFallback={<LoadingFallback />}
      emptyFallback={
        <p className="text-muted-foreground text-sm">
          No locations available right now.
        </p>
      }
      onRetry={() => setTick((t) => t + 1)}
    >
      {(d) => (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <LocationSwitcher
              locations={d.locations}
              value={selectedLocationId}
              onChange={setSelectedLocationId}
            />
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
            <p className="text-muted-foreground text-sm">
              No items available at this location.
            </p>
          ) : (
            <ItemList groups={filteredGroups} />
          )}
        </div>
      )}
    </DataState>
  );
}
