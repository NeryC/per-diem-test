"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DataState } from "@/components/data-state";
import { ItemDetail } from "@/components/menu/item-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCatalog } from "@/lib/menu";
import type { WireCatalog, WireItem } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface DetailData {
  item: WireItem | null;
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

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((catalog: WireCatalog) => {
        if (cancelled) return;
        const item = catalog.items.find((it) => it.id === id) ?? null;
        setState({ status: "ready", data: { item }, error: null });
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
            <ItemDetail item={d.item} />
          </div>
        ) : (
          <NotFound />
        )
      }
    </DataState>
  );
}
