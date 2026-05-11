/* Per Diem Test service worker. Hand-rolled, no Workbox.
 *
 * Strategies:
 *   - Navigation (HTML) → network first, fall back to cached "/" shell.
 *   - Static assets (/_next/, fonts, icons) → cache first.
 *   - /api/locations and /api/catalog → stale-while-revalidate.
 *   - /api/inventory → network only (stock must be fresh).
 *
 * Bump CACHE_VERSION when the SW logic or cache shape changes; the activate
 * handler then drops every cache that does not start with the new prefix.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `per-diem-test-${CACHE_VERSION}-shell`;
const STATIC_CACHE = `per-diem-test-${CACHE_VERSION}-static`;
const DATA_CACHE = `per-diem-test-${CACHE_VERSION}-data`;
const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE, DATA_CACHE];

// The minimum URLs the offline shell needs. The browser resolves the rest of
// the Next.js asset graph through the static-cache strategy below.
const SHELL_URLS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/favicon.ico"
  );
}

function isCacheableApi(url) {
  return (
    url.pathname === "/api/locations" || url.pathname === "/api/catalog"
  );
}

function isInventoryApi(url) {
  return url.pathname === "/api/inventory";
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (_err) {
    // Cold offline open: serve the menu page from the cache. The client-side
    // localStorage SWR layer then paints the cached catalog.
    const fallback = await cache.match("/");
    if (fallback) return fallback;
    throw _err;
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidateData(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isInventoryApi(url)) {
    // Default network-only. Let the browser handle the failure; the page's
    // visibility-aware poll already swallows transient errors.
    return;
  }
  if (isCacheableApi(url)) {
    event.respondWith(staleWhileRevalidateData(request));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }
});
