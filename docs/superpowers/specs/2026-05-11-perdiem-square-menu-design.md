# Per Diem Square Menu Browser — Design Spec

**Author:** N. Alberto C.
**Date:** 2026-05-11
**Status:** Approved (pending writing-plans)
**Source challenge:** Per Diem Full-Stack Engineering Take-Home

---

## 0. Context and goals

Build a multi-location menu browser on top of Square's Catalog & Locations APIs as part of the Per Diem Full-Stack Engineer take-home. The deliverable must demonstrate senior product judgment, team-grade code quality, secure handling of secrets, and clear communication.

**In scope (this spec):**

- All 6 core requirements (locations, catalog, location filtering, category grouping, item detail with money formatting, real loading/empty/error states).
- All 5 bonuses: time-of-day & day-of-week availability, full-text search, modifiers in detail, cart with subtotal and persistence, out-of-stock via Inventory API.

**Out of scope:**

- Offline-friendly (service worker / catalog cache for offline use). Documented in README as next iteration.
- Real authentication, payment integration.
- Multi-merchant. We point at one Square sandbox merchant only.

**Non-functional commitments:**

- TypeScript strict end-to-end. No `any`, no `// @ts-ignore`, no types that lie.
- Square access token never reaches the client. All Square calls proxied through our own backend.
- Conventional Commits, structured PR descriptions, husky + commitlint enforcement.
- README and Loom are deliverables but **outside the 4-6h time budget** for code work, per author's decision.
- Lighthouse a11y target ≥ 90.

**Risk acknowledged:** the council recommended 1-2 bonuses max. The author has accepted the risk of attempting all 5. The plan compensates with shared catalog cache, pure resolvers, snapshotted cart prices, and worktree-based staged delivery so each bonus is an independent checkpoint.

---

## 1. Stack and project layout

### 1.1 Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 15+ App Router | RSC by default, route handlers as backend, Vercel-native |
| Language | TypeScript with `strict: true`, `noUncheckedIndexedAccess: true` | Required by challenge, catches index-out-of-bounds bugs |
| Runtime | Node.js 24 LTS, Fluid Compute | Modern default, full Node compatibility |
| Square integration | `square` (official Node SDK) | Generated types, avoids hand-rolled `unknown` |
| UI | shadcn/ui + Tailwind CSS | Copy-paste primitives, zero bundle overhead, recognized by reviewers |
| Cart state | Zustand + persist middleware | SSR-safe, tiny, versioned migrations |
| Validation | Zod | Schema validation at the API boundary |
| Tests | Vitest | Fast, ESM-first, Next 15 friendly |
| Package manager | pnpm | Strict node_modules, fast installs, ecosystem standard |
| Lint / format | ESLint + Prettier + Tailwind plugin | Standard team toolchain |
| Hooks | Husky + lint-staged + commitlint | Enforces commit hygiene |
| Deployment | Vercel + `vercel.ts` | Auto preview per PR |

### 1.2 Folder layout

```
app/
  api/square/
    locations/route.ts
    catalog/route.ts
    inventory/route.ts
  (menu)/
    page.tsx                 # Menu listing scoped to selected location
    items/[id]/page.tsx      # Item detail
  layout.tsx
lib/
  square/
    client.ts                # Server-only SDK init
    catalog.ts               # Fetch + paginate + normalize + cache
    locations.ts
    inventory.ts
    availability.ts          # Pure resolver (testable)
    money.ts                 # Money formatting and arithmetic
    errors.ts                # safeSquareCall wrapper, error mapping
    schemas.ts               # Zod schemas for all normalized shapes
  cart/
    store.ts                 # Zustand store + persist
    selectors.ts             # Pure totals
    types.ts
  time/
    provider.tsx             # TimeProvider (real or simulated)
components/
  ui/                        # shadcn primitives
  data-state.tsx             # DataState wrapper (loading/empty/error)
  menu/
    location-switcher.tsx
    category-filter.tsx
    item-list.tsx
    item-card.tsx
    item-detail.tsx
    availability-badge.tsx
    search-bar.tsx
    time-simulator-banner.tsx
  cart/
    cart-button.tsx
    cart-drawer.tsx
    cart-line-item.tsx
    modifier-selector.tsx
tests/
  availability.test.ts
  cart-selectors.test.ts
  money.test.ts
docs/
  superpowers/
    specs/2026-05-11-perdiem-square-menu-design.md   # this file
.env.example
vercel.ts
```

### 1.3 Security boundary

- `SQUARE_ACCESS_TOKEN` and `SQUARE_ENVIRONMENT` live in `.env.local` (gitignored). `.env.example` ships with empty values and documentation.
- `lib/square/client.ts` is `import "server-only"` — bundling it in a client component fails the build.
- Cart store and any other client code never imports anything from `lib/square/`.
- Route handlers do not accept arbitrary URLs or pass-through tokens. Every endpoint exposes a fixed, normalized shape.

---

## 2. Backend: route handlers and caching

### 2.1 Endpoints

| Route | Method | Returns | Cache |
|---|---|---|---|
| `/api/locations` | GET | `Location[]` (id, name, timezone, status, businessHours) | `unstable_cache` 1h, tag `locations` |
| `/api/catalog` | GET | `{ items, categories, modifierLists }` indexed by id, fully paginated | `unstable_cache` 5min, tag `catalog` |
| `/api/inventory?locationId=X` | GET | `{ [variationId]: { state, quantity } }` | `unstable_cache` 30s, tag `inventory:X` |

Catalog is fetched **once** per cache window. Search, time-of-day filtering, modifiers and item detail all derive from the same normalized snapshot.

### 2.2 Square client wrapper

```ts
// lib/square/client.ts
import "server-only";
import { Client, Environment } from "square";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const square = new Client({
  accessToken: requireEnv("SQUARE_ACCESS_TOKEN"),
  environment: process.env.SQUARE_ENVIRONMENT === "production"
    ? Environment.Production
    : Environment.Sandbox,
});
```

### 2.3 Error handling

- `safeSquareCall<T>(fn)` wraps Square calls. Catches `ApiError`, maps to a discriminated union:
  ```ts
  type SquareError =
    | { kind: "rate_limited"; retryAfterSeconds: number }
    | { kind: "unauthorized" }
    | { kind: "not_found" }
    | { kind: "server_error"; status: number }
    | { kind: "network" };
  ```
- Route handler maps each kind to an HTTP response (`429` propagates `Retry-After`, etc.).
- One simple retry on rate-limit (single attempt) using the returned `Retry-After`. Beyond that, surface to client.
- Logs are structured JSON: `{ level, msg, requestId, kind, ms, ...ctx }`.

### 2.4 Pagination

Square Catalog returns up to 100 items per page with a `cursor`. Backend loops until `cursor` is empty and aggregates. Client never sees pagination — receives the full normalized snapshot.

### 2.5 Validation

Every Square response is parsed by a Zod schema before normalization. If Square ships a shape change, we fail fast in the proxy with a clear error rather than a misleading runtime exception in the UI.

---

## 3. Time-of-day & day-of-week availability (showcase feature)

### 3.1 Precedence model

For each item × location × moment-in-time, availability is resolved by checking, in order:

1. **Item presence at location** (`present_at_all_locations`, `present_at_location_ids`, `absent_at_location_ids`). If absent → `unavailable_at_location`.
2. **Item-level boolean flags** (e.g. `available_for_pickup`). If false → `unavailable_at_location` (treated the same — not orderable here).
3. **Category `location_overrides`** — if a window override exists for this location, it wins.
4. **Category-level `availability_period`** — recurring weekly windows.
5. **Default:** available.

### 3.2 Resolver API (pure)

```ts
// lib/square/availability.ts
export type AvailabilityState =
  | { kind: "available" }
  | { kind: "opens_at"; nextOpen: Date; reason: "category_window" | "out_of_window_today" }
  | { kind: "closed_today" }
  | { kind: "unavailable_at_location" };

export function resolveAvailability(input: {
  item: NormalizedItem;
  category: NormalizedCategory | null;
  locationTimezone: string;   // IANA, e.g. "America/New_York"
  now: Date;                   // injected — always pass explicitly
}): AvailabilityState;
```

The resolver is a pure function. `now` is injected so the resolver is trivially testable and the UI can drive it from a simulated clock without changing logic.

### 3.3 Timezone handling

- Timezone comes from `Location.timezone` (Square returns IANA tz names like `America/New_York`).
- Convert `now` (UTC) into the location's wall-clock using `Intl.DateTimeFormat` with the `timeZone` option. No third-party tz libraries (`date-fns-tz`, `luxon`) — keeps the bundle clean and demonstrates Intl API fluency.
- DST is handled correctly by `Intl.DateTimeFormat` because it asks "what offset applies on this calendar date in this zone."
- Windows that cross midnight (e.g. `22:00 - 02:00`) are split into two sub-windows per calendar day during normalization.

### 3.4 Tests (`tests/availability.test.ts`)

Minimum cases:

1. Item with no category window → always available.
2. Item inside its category window → available.
3. Item outside window today but opens later same day → `opens_at`.
4. Item already closed today, opens tomorrow → `opens_at` (next day).
5. DST forward (March in NY): 02:30 doesn't exist. Resolver doesn't crash.
6. DST backward (November in NY): 01:30 occurs twice. Resolver picks the later occurrence consistently.
7. Window crossing midnight: `22:00 → 02:00`. Hour 23 and hour 01 both available.
8. Location override beats category default.
9. Item absent at the selected location → `unavailable_at_location`.
10. Multiple overlapping windows → take the one currently active or earliest next.

### 3.5 TimeProvider and simulation

- `TimeProvider` (React Context) exposes `useNow(): Date`.
- **Default:** real time. `setInterval(60_000)` re-renders consumers so badges tick over.
- **Simulated:** activated only by URL query `?at=ISO_DATETIME`. When active:
  - `useNow()` returns the simulated date.
  - A sticky banner renders at the top: `Simulating: Tue May 12, 3:00 PM` with `Exit simulation` button (clears the query).
  - A small footer button "Demo time travel" (also reachable via `Ctrl+Shift+T`) opens a date/time picker for live demos.
- Real users never see the simulation UI unless they explicitly opt in via URL or shortcut.

### 3.6 `<AvailabilityBadge>`

| State | Color + glyph | Label |
|---|---|---|
| `available` | green ✓ | (no badge — clean UI) |
| `opens_at` (today) | amber ⏰ | `Opens at 11:00 AM` (location local) |
| `closed_today` | gray ✕ | `Reopens Mon 8:00 AM` |
| `unavailable_at_location` | red ✕ | `Not at this location` (hidden by default; toggle to reveal) |

Badge respects `prefers-reduced-motion` (no animations) and is fully aria-labeled with the human-readable status.

---

## 4. Cart with integrated modifiers

### 4.1 Data model

```ts
// lib/cart/types.ts
export type Money = { amount: bigint; currency: string };

export type SelectedModifier = {
  modifierId: string;
  modifierListId: string;
  name: string;          // snapshot
  priceMoney: Money;     // snapshot of incremental price
};

export type CartLineItem = {
  lineId: string;        // generated uuid; same item+modifiers on second add → new lineId
  itemId: string;
  variationId: string;
  itemName: string;      // snapshot
  variationName: string; // snapshot
  basePriceMoney: Money; // snapshot
  modifiers: SelectedModifier[];
  qty: number;
  locationId: string;    // cart is scoped to one location
};

export type CartState = {
  locationId: string | null;
  lines: CartLineItem[];
};
```

**Decisions:**

- **Snapshots** of name and price at add-time. Catalog updates do not mutate already-added lines. Real e-commerce behavior.
- **lineId per add**, not per `itemId+modifiers` aggregation. Predictable, mirrors Square Orders model.
- **Cart is scoped to one location.** Switching locations triggers a confirm dialog: "Your cart has X items from [Other Location]. Empty cart and switch, or stay?"

### 4.2 Modifier selector (`<ModifierSelector>`)

Rendered in item detail per `modifier_list_info`:

| Square field | UI behavior |
|---|---|
| `selection_type: SINGLE` | Radio buttons. `min=1` disables deselection. |
| `selection_type: MULTIPLE` | Checkboxes. Validate `min`/`max`. |
| Modifier with `price_money` | Suffix `+$0.50`. |
| Modifier without price | No suffix. |
| Per-item override `enabled: false` | Modifier hidden. |
| Constraints unmet | "Add to cart" disabled with tooltip. |

If item has multiple variations, variation selector renders first, then modifiers. Base price displayed updates with the selected variation.

### 4.3 Selectors (pure, testable)

```ts
// lib/cart/selectors.ts
export function lineItemTotal(line: CartLineItem): Money;
export function cartSubtotal(state: CartState): Money;
```

All arithmetic in `bigint` cents. Format with `Intl.NumberFormat` only at the render boundary.

### 4.4 Persistence

```ts
// lib/cart/store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useCart = create<CartState & CartActions>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: "perdiem-cart-v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (state, fromVersion) => state,
    }
  )
);
```

Hydration handled via a `useHasMounted()` gate so SSR + persisted-client first render do not mismatch.

### 4.5 UI

- Header `<CartButton>` shows live count badge (`aria-live="polite"`).
- `<CartDrawer>` (shadcn `Sheet`): list of lines with thumbnail, name + variation, modifier chips, price, qty +/-, remove. Subtotal at bottom. Disabled "Checkout (coming soon)" — payment is out of scope.
- Empty state: "Your cart is empty. Browse the menu to get started."

---

## 5. Search

- Full-text client-side filter over the visible (= currently selected location) item list.
- Debounced 150ms.
- Matches `name` and `description` case-insensitive, accent-insensitive.
- Empty results show `No items match "{query}". Try a different word.`
- Search bar has visible "clear" button and is accessible via `/` keyboard shortcut.

---

## 6. Inventory (out-of-stock)

### 6.1 Fetch strategy

- One `POST /v2/inventory/counts/batch-retrieve` per location, requesting all variation_ids currently visible at that location.
- Cached server-side 30s, tag `inventory:<locationId>`.
- Client refetches on a `setInterval(30_000)` while the menu page is mounted (visibility-aware: pause when tab hidden).

### 6.2 UI integration

- `<ItemCard>` shows `Out of stock` badge (red) over thumbnail when **all** variations are out of stock.
- `<ItemCard>` shows `Low stock` badge (amber) when any variation has ≤3 units (configurable constant).
- `<ItemDetail>` per-variation: out-of-stock variations render as disabled radio with "Out of stock" suffix.
- "Add to cart" button is disabled when the currently selected variation is out of stock. Tooltip: "This option is currently out of stock."

### 6.3 Edge cases

- Square inventory state `IN_STOCK` with `quantity: "0"` is treated as out-of-stock.
- Items without tracked inventory (no count returned) are treated as available.
- Batch endpoint returns up to 1000; if there are more variations, paginate (loop until cursor empty).

---

## 7. Loading / empty / error states

A single `<DataState>` wrapper handles every fetch:

```tsx
<DataState
  loading={isLoading}
  error={error}
  empty={!data?.length}
  loadingFallback={<MenuSkeleton />}
  emptyFallback={<EmptyMenu locationName={x} />}
  errorFallback={(err, retry) => <ErrorPanel error={err} onRetry={retry} />}
>
  {(data) => <MenuList items={data} />}
</DataState>
```

- **Loading:** shadcn `Skeleton` shaped like the final content.
- **Empty:** explanation + CTA. Example: "No items currently available at this location. Show unavailable items?"
- **Error:** human message + retry. Differentiate `429`, `5xx`, `network`.
- **Stale-while-refresh:** show old data with subtle "Updating..." indicator.

---

## 8. Stages, worktrees, commits

### 8.1 Stages and branches

| # | Branch | Deliverable | Stage gate |
|---|---|---|---|
| 0 | `main` (initial) | Scaffolding, TS strict, Tailwind, shadcn init, env, vercel.ts, ESLint/Prettier, Husky | `pnpm build` + `pnpm lint` ok |
| 1 | `feat/01-square-proxy` | Client wrapper, Zod schemas, error mapping, `/locations` and `/catalog` with pagination + cache | Endpoints return normalized shape |
| 2 | `feat/02-menu-core` | LocationSwitcher, CategoryFilter, ItemList, ItemDetail, money formatting, DataState wrapper | All 6 cores work end-to-end |
| 3 | `feat/03-availability` | Resolver, tests, AvailabilityBadge, TimeProvider, URL `?at=` | Tests green; badges render 3 states |
| 4 | `feat/04-search` | Search bar, filter, debounce | Filter works in-place |
| 5 | `feat/05-cart-modifiers` | ModifierSelector, Zustand store, CartDrawer, persisted, location-scoped | Add/remove/qty/clear work |
| 6 | `feat/06-inventory` | `/api/inventory`, badges, disable add-to-cart, 30s revalidation | Out-of-stock reflected in UI |
| 7 | `feat/07-polish` | A11y pass, responsive review, README expansion, Loom recording | Lighthouse a11y ≥ 90 |

Each branch is opened as a PR to `main`, reviewed (self-review per the Code Review skill), and merged with a structured PR description (template below).

### 8.2 Worktrees

Worktrees are used to keep two stages workable in parallel and to allow optional sub-agent dispatch on independent stages:

```bash
git worktree add ../jobtest-stage-3 feat/03-availability
git worktree add ../jobtest-stage-5 feat/05-cart-modifiers
```

Each worktree shares the pnpm store so installs are instant.

### 8.3 Conventional Commits

```
<type>(<scope>): <subject under 72 chars>

<body explaining the WHY and the trade-offs, wrapped at 72 chars>

<footer: refs spec section, breaking changes, etc.>
```

- Types allowed: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`.
- Primary scopes: `square`, `catalog`, `locations`, `inventory`, `availability`, `cart`, `modifiers`, `search`, `ui`, `api`.
- Enforced by `commitlint` via `commit-msg` Husky hook.

### 8.4 PR template

```markdown
## What
<2-3 sentences: feature/fix delivered.>

## Why
<Context: which spec section, problem solved.>

## How
<Implementation notes, key decisions, trade-offs, libs added.>

## Tests
- [ ] <unit / integration>
- [ ] Manual: <scenario>

## Risks / Follow-ups
<Edge cases not covered, scope intentionally cut, future work.>

Closes spec §X.Y
```

### 8.5 Hooks

- `pre-commit`: `lint-staged` → ESLint --fix + Prettier + `tsc --noEmit` on staged.
- `commit-msg`: `commitlint --edit $1`.

### 8.6 CHANGELOG

`CHANGELOG.md` is generated by `git-cliff` from Conventional Commits before final tagging. Demonstrates that history is legible without forcing the reviewer to read it.

---

## 9. Accessibility, responsive, deployment

### 9.1 Accessibility (target Lighthouse ≥ 90)

- Semantic landmarks (`<nav>`, `<main>`, `<article>`, `<section>`).
- Full keyboard navigation. Cart drawer closes on `Esc`. Search via `/` shortcut.
- Aria: `<AvailabilityBadge aria-label="Opens at 11:00 AM, currently closed">`. Modifier groups with `role="radiogroup"` / `role="group"`. Cart count `aria-live="polite"`.
- Color is never the only signal: badges combine icon + text + color.
- Visible focus rings (Tailwind utilities; shadcn defaults are decent).
- `prefers-reduced-motion` respected on cart drawer and any transitions.

### 9.2 Responsive (mobile-first)

- Tailwind breakpoints: `sm` 640, `md` 768, `lg` 1024.
- Mobile: collapsible location switcher in header, horizontal-scroll category chips, 1-2 column item grid.
- Desktop: sidebar categories, 3-4 column grid, slide-in cart drawer.
- Touch targets ≥ 44 × 44px.

### 9.3 Deployment

- Vercel with `vercel.ts`:
  ```ts
  import type { VercelConfig } from "@vercel/config/v1";
  export const config: VercelConfig = {
    framework: "nextjs",
    regions: ["iad1"],
    functions: { "app/api/**/*": { maxDuration: 30 } },
  };
  ```
- Env vars set via `vercel env add` for both preview and production. Sandbox-only token.
- Preview deploys per PR (Vercel default). Each stage has a live preview URL the reviewer can open.

---

## 10. README and Loom

### 10.1 README structure

1. Hero screenshot or GIF showing availability badge in action.
2. Quick-start: `clone → pnpm i → cp .env.example .env.local → pnpm dev`.
3. Square sandbox setup walkthrough with suggested seed data (2 locations, 3-4 categories, 6-10 items, at least one item exclusive to one location, at least one category with restricted hours).
4. Architecture section linking to key files (`lib/square/`, `lib/cart/`, `lib/square/availability.ts`).
5. Time simulation: `?at=2026-05-12T15:00` documented.
6. Trade-offs: each major decision with a one-paragraph "what we chose, what we gave up."
7. Bonus status table (✅ done / ❌ skipped) with notes per bonus.
8. "What I'd do next with another week": short, specific bullet list.

### 10.2 Loom (90s, scripted)

| Seconds | Beat |
|---|---|
| 0-15 | Problem statement and overall layout |
| 15-30 | Architecture: token hidden, route handlers, cache |
| 30-55 | Availability with time simulator — open `?at=...`, walk through 3 states |
| 55-70 | Cart with modifiers + location switch confirmation |
| 70-80 | Inventory: out-of-stock badge + disabled add-to-cart |
| 80-90 | Deliberate trade-offs: what was skipped and why |

---

## 11. Tests

| File | Covers |
|---|---|
| `tests/availability.test.ts` | All 10 cases in §3.4 |
| `tests/cart-selectors.test.ts` | `lineItemTotal` and `cartSubtotal` with modifiers, multiple lines, edge cases |
| `tests/money.test.ts` | Currency formatting, bigint arithmetic, currency mismatch errors |

No coverage target. Tests cover the code where a bug is most expensive (pricing math, time math).

---

## 12. Trade-offs and risks (acknowledged)

1. **Scope is over the council recommendation.** The 5 bonuses fit if there are no major sandbox quirks; the staged structure protects partial delivery if one stage stalls.
2. **No service worker / offline.** Documented explicitly; would require a separate cache strategy and Workbox integration not feasible in the available time.
3. **Inventory is best-effort eventually consistent.** Square sandbox is occasionally flaky here; we revalidate every 30s and tolerate transient mismatches.
4. **Catalog cache is 5 minutes.** Real merchants update menus; we trade freshness for rate-limit safety. Documented.
5. **Single sandbox merchant.** No multi-tenant.
6. **No Square authentication / OAuth.** Token-only, sandbox-only. Production deployment would need OAuth flow (out of scope).

---

## 13. Open questions (resolved before implementation)

- [x] Stack: Next.js (web).
- [x] Bonus priority: Time-of-day (showcase) + Search + Modifiers + Cart + Inventory.
- [x] UI library: shadcn/ui + Tailwind.
- [x] Package manager: pnpm.
- [x] Loom + README outside time budget for code work.
- [x] Modifiers integrate fully with cart (no display-only mitigation).
- [x] Time simulator opt-in via URL only; default UX is real time.

No open questions remain. Ready for implementation planning.
