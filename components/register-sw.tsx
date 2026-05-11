"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once on first client paint. The SW handles
 * the cold-offline case where the browser cannot even reach the HTML shell;
 * the in-app localStorage cache (lib/offline-cache.ts) still serves the
 * catalog data after the shell is up.
 *
 * The registration only fires in production builds. In dev, Next.js's HMR
 * conflicts with a precaching SW and the loop becomes painful to reason
 * about.
 */
export function RegisterServiceWorker(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Registration failures are non-fatal — the app still works online.
      // Don't surface a toast or block the user; the dev console message
      // navigator.serviceWorker.register itself emits is enough signal in
      // development.
    });
  }, []);
  return null;
}
