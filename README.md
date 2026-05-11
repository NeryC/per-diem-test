# Per Diem Test

A take-home for Per Diem: browse a Square sandbox merchant's catalog by
location, with real-time availability windows, modifier-aware ordering,
location-scoped cart, and live inventory.

> Built with Next.js 16 App Router, React 19, TypeScript (strict, no
> `any`), Tailwind v4, shadcn/ui v4, Zustand, Zod, and the Square SDK v44.

<!-- Drop a hero screenshot at docs/screenshots/hero.png and uncomment:
![Per Diem menu hero](docs/screenshots/hero.png) -->

---

## Quick start

```bash
pnpm install
cp .env.example .env.local
# edit .env.local — set SQUARE_ACCESS_TOKEN (sandbox)
pnpm dev
```

Open <http://localhost:3000>. If you want a deterministic clock for a demo,
append `?at=2026-05-12T15:00` (any ISO-like local timestamp works — the
resolver interprets it in the selected location's timezone).

The token never leaves the server. Every Square call is proxied through
`/api/*` Route Handlers in `app/api/**`, which call the SDK from
`lib/square/*` server-only modules and return Zod-validated wire shapes
to the client.

---

## Square sandbox setup

1. Create a free Square Developer account at
   <https://developer.squareup.com>.
2. Create a new application and copy the **Sandbox Access Token** from the
   _Credentials_ tab.
3. Put it in `.env.local`:
   ```bash
   SQUARE_ACCESS_TOKEN=EAAA…
   SQUARE_ENVIRONMENT=sandbox
   ```
4. Seed the sandbox merchant from the Square Dashboard (or via the
   Catalog API). Suggested seed data to exercise every feature:

| Resource               | Suggestion                                                                         | Why                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Locations**          | 2, in different timezones — e.g., New York and Los Angeles                         | Exercises the timezone resolver and the location-switch cart dialog |
| **Categories**         | Coffee, Pastries, Sandwiches, Breakfast                                            | Lets you scope filters and time-of-day rules                        |
| **Items**              | 6–10, at least one available at only **one** location                              | Exercises per-location filtering                                    |
| **Hours of operation** | One category with limited hours, e.g., _Breakfast: MON–FRI 06:00–11:00_            | Exercises the time-of-day resolver                                  |
| **Modifier list**      | _Milk: Whole, Oat, Almond_ with a `+$0.50` premium tier; attached to a coffee item | Exercises the modifier selector + cart snapshot price               |
| **Inventory**          | Mark one variation as out of stock                                                 | Exercises the OOS badge and disabled radio                          |

---

## Architecture

### Wire / server boundary

- The Square access token is read in `lib/square/client.ts`, which is
  marked `import "server-only"`. It cannot be bundled into a client
  component by accident.
- Route Handlers in `app/api/catalog`, `app/api/locations`, and
  `app/api/inventory` proxy every Square call. They normalize the SDK
  response into the project's own wire shapes (`lib/types.ts`), which are
  validated with Zod at the boundary.
- `bigint` money values are serialized as strings on the wire (Square's
  amounts are `bigint` cents) and re-hydrated as `bigint` in client
  modules to keep math exact.

### Availability resolver

- `lib/square/availability.ts` is a **pure function** — no globals,
  no clock reads. The caller passes `now`, the location timezone, the
  item, and the category. It returns one of `available | opens_at |
closed_today | unavailable`.
- Timezone-aware wall-clock math is done with `Intl.DateTimeFormat`
  only — no third-party tz library. `lib/square/zoned.ts` extracts the
  helpers and is covered by tests for DST forward, DST backward, and
  midnight-crossing windows.
- The `?at=` query param is parsed by `lib/time/provider.tsx` and fed
  to every resolver call so a simulated clock looks identical to a real
  one to the rest of the app.

> Category hours are sourced natively from Square: the normalizer
> resolves the `AVAILABILITY_PERIOD` CatalogObjects linked from
> `category_data.availability_period_ids`, the mechanism Square
> 2024-12-18 uses for scheduled category availability.

### Cart

- `lib/cart/store.ts` is a Zustand store persisted to `localStorage`.
- Money is `bigint` everywhere. The persist layer uses a custom
  serializer that round-trips `bigint` as a tagged string so JSON does
  not lose precision.
- The cart is **scoped to a single location**. Adding a line for a
  different location triggers a confirmation dialog: _Stay_ or
  _Empty cart and switch_.
- Modifier choices and variation prices are **snapshotted** into the
  cart line so a later catalog change cannot retroactively alter what
  the user agreed to pay.

### Inventory

- `lib/use-inventory-polling.ts` polls `/api/inventory?locationId=…`
  on a 30-second interval, pauses while the tab is hidden
  (`document.visibilityState`), and exposes a flat `Map<variationId,
CountState>` to consumers.
- `components/menu/availability-badge.tsx` and the item detail page
  read this map: OOS variations are disabled in the radio group, and
  the _Add to cart_ button reads _"Out of stock"_ when nothing in the
  item is sellable.

### Offline cache

- `lib/offline-cache.ts` is an SSR-safe, version-keyed wrapper around
  `localStorage`. Reads return `null` when storage is unavailable
  (server, private mode, quota); writes are silent no-ops in the same
  conditions. Quota or parse errors clear the bad key instead of
  throwing.
- `fetchCatalog` and `fetchLocations` in `lib/menu.ts` follow a
  stale-while-revalidate pattern: every successful response refreshes
  the cache, and a failed one falls back to the cached value if one
  exists. They only rethrow when there is nothing to serve.
- The menu page (`app/(menu)/page.tsx`) and the item detail page
  (`app/items/[id]/page.tsx`) seed their initial state from the
  cached values synchronously, so a returning user — or one without
  network — sees the menu paint instantly. A small amber banner shows
  on the menu when the background refresh fails so the user knows
  they are looking at stale data and can retry.
- Inventory is **deliberately not cached.** Caching stock would lie
  about what is buyable right now; the 30 s poll stays live.

---

## Time simulation

A demo without a working clock is awkward. Append `?at=` to any page:

```
http://localhost:3000/?at=2026-05-12T06:00   # early morning — breakfast open
http://localhost:3000/?at=2026-05-12T15:00   # afternoon — breakfast closed
```

The banner at the top of every menu page shows the simulated time and a
_Reset_ link. The query parameter is interpreted as **local wall-clock
time in the selected location's timezone**, so the same URL feels right
in both NY and LA.

---

## Trade-offs and decisions

- **All five bonuses attempted.** The LLM Council that reviewed the
  scope recommended 1–2 inside the stated time budget. The author
  accepted the risk and protected the gamble with a pure resolver,
  bigint money math, snapshotted cart lines, and one Conventional-
  Commit stage per feature so every stage is independently shippable
  if the next one fell over.
- **localStorage SWR, not a service worker.** Catalog + locations are
  cached in `localStorage` (`lib/offline-cache.ts`) with a versioned
  key and a stale-while-revalidate fetcher. The menu paints
  immediately from cache on a refresh / offline visit and a banner
  surfaces when the background revalidate fails. A service worker
  would be the right call if we needed asset caching too, but for the
  spec's scope localStorage is simpler and avoids the SW lifecycle.
- **Inventory is intentionally NOT cached offline.** Stock changes by
  the minute; serving a stale snapshot would lie about what is
  buyable. Inventory keeps its 30 s live poll.
- **5-minute catalog cache.** Trades freshness against sandbox
  rate-limit safety. Inventory is **not** cached — it polls live.
- **Inventory is eventually consistent.** The sandbox is occasionally
  flaky here; we treat unknown stock as available rather than blocking
  the order.
- **Single sandbox merchant.** No multi-tenant or OAuth flow.
- **No third-party tz library.** `Intl.DateTimeFormat` is enough for
  the spec and avoids a 60 kB dependency.
- **ESLint forbids `any` and `ts-ignore`.** Verified across all 12
  stages.

---

## Bonus status

| Bonus                    | Status | Notes                                                                                      |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| Time-of-day availability | Done   | Pure resolver, 11 spec tests, DST forward + backward + midnight-crossing, `?at=` simulator |
| Search                   | Done   | Diacritic-insensitive, multi-token AND, `/` keyboard shortcut, debounced                   |
| Modifiers                | Done   | `selection_type` + `min`/`max` + per-item overrides, snapshotted into cart at add time     |
| Cart                     | Done   | Zustand + `localStorage`, `bigint` money, location-scoped with switch dialog               |
| Out-of-stock (Inventory) | Done   | 30-s polling, visibility-aware, OOS variation disabling, auto-select first in-stock        |
| Offline-friendly         | Done   | localStorage stale-while-revalidate of catalog + locations, stale banner on refresh fail   |

---

## What I'd build next with another week

- Real Square OAuth flow for production deployments.
- Service worker for asset caching (catalog + locations already cache
  to localStorage today).
- Order submission with the Square Payments API.
- Component test coverage beyond the pure modules (currently:
  resolver, zoned helpers, money, cart-selectors, cart-store,
  square-errors, search).
- Lighthouse a11y audit on a real dev server with a real token.
- Sorted variation list keys for a stabler `unstable_cache` hash.
- Pause inventory polling when no menu items are rendered (saves
  rate limit on empty filter results).
- Image optimization with `next/image` and Square's CDN.

---

## Tests

```bash
pnpm test
```

Currently 55 tests across:

- `tests/availability.test.ts` — resolver state machine, 11 cases
- `tests/zoned.test.ts` — wall-clock math, DST, midnight crossings
- `tests/money.test.ts` — bigint money formatting and arithmetic
- `tests/cart-selectors.test.ts` — line total + subtotal selectors
- `tests/cart-store.test.ts` — store actions, location guard, persistence
- `tests/square-errors.test.ts` — Square SDK error normalization
- `tests/search.test.ts` — diacritic-insensitive tokenized matching
- `tests/offline-cache.test.ts` — SSR-safe localStorage round-trip, corruption recovery

---

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Route Handlers, `unstable_cache`)
- [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org) — strict, no `any`
- [Tailwind CSS v4](https://tailwindcss.com)
- [shadcn/ui v4](https://ui.shadcn.com)
- [Zustand](https://github.com/pmndrs/zustand) — cart state
- [Zod](https://zod.dev) — wire-shape validation
- [Vitest](https://vitest.dev) — pure-module tests
- [Square SDK v44](https://github.com/square/square-nodejs-sdk)

---

## Pipeline

```bash
pnpm typecheck   # tsc --noEmit, strict
pnpm lint        # eslint, forbids any / ts-ignore
pnpm build       # next build
pnpm test        # vitest run
```

All four exit 0 on `main`.
