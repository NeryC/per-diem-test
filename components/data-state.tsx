"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * DataState centralizes the four UI states the spec requires
 * (loading / empty / error / loaded) so no caller has to reinvent them.
 *
 * Precedence (top wins):
 *   1. loading=true AND no data        → loadingFallback (initial fetch)
 *   2. error                           → errorFallback (always wins, even with stale data)
 *   3. loading=true AND data present   → children (stale-while-refresh, no skeleton flash)
 *   4. no data                         → loadingFallback (defensive)
 *   5. isEmpty(data)                   → emptyFallback
 *   6. otherwise                       → children
 *
 * Note that error wins over stale data: a failed background refresh surfaces
 * the error UI, not the stale data. Callers that want to keep stale data
 * visible alongside an error banner should pass a custom errorFallback that
 * renders both.
 */
export interface DataStateProps<T> {
  loading: boolean;
  error: Error | null;
  data: T | null | undefined;
  isEmpty?: (data: T) => boolean;
  loadingFallback: ReactNode;
  emptyFallback: ReactNode;
  errorFallback?: (error: Error, retry: () => void) => ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}

function DefaultErrorFallback({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}): ReactNode {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
    >
      <p className="text-sm font-medium">Something went wrong.</p>
      <p className="text-sm opacity-80">{error.message}</p>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function DataState<T>(props: DataStateProps<T>): ReactNode {
  const {
    loading,
    error,
    data,
    isEmpty,
    loadingFallback,
    emptyFallback,
    errorFallback,
    onRetry,
    children,
  } = props;

  const retry = onRetry ?? ((): void => undefined);

  if (loading && (data === null || data === undefined)) {
    return loadingFallback;
  }
  if (error) {
    if (errorFallback) return errorFallback(error, retry);
    return <DefaultErrorFallback error={error} onRetry={retry} />;
  }
  if (data === null || data === undefined) {
    return loadingFallback;
  }
  if (isEmpty && isEmpty(data)) {
    return emptyFallback;
  }
  return children(data);
}
