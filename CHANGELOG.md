# Changelog

All notable changes to this project are documented here. Commits follow the
Conventional Commits specification.

## Unreleased

### Chores

- Scaffold Next.js 15 app with App Router and Tailwind (tooling)

- Enable strict TypeScript flags (tooling)

- Scaffold shadcn/ui with primitives needed for the menu (ui)

- Add Square SDK, zod, zustand, and vitest (deps)

- Configure Vitest with @ alias and jest-dom matchers (tooling)

- Enforce no-any and unsafe-any-family as errors (tooling)

- Enforce Conventional Commits and pre-commit linting (tooling)

- Add .env.example and typed Vercel config (tooling)

- Replace placeholder metadata and document env vars (tooling)

- Allow Square image CDN hosts in next/image (ui)

- Tighten landmarks, skip-link, and responsive header (a11y)

### Documentation

- Add Per Diem Square menu browser design spec (spec)

- Add staged implementation plan for Square menu browser (plan)

- Replace any in catalog normalizer with Square SDK types (plan)

- Clarify DataState precedence rules in jsdoc (ui)

- Write project README and Loom script (readme)

### Features

- Define normalized types and zod schemas for the proxy (square)

- Add server-only SDK client and env reader (square)

- Add safeSquareCall wrapper and error mapping (square)

- Add jsonResponse and errorResponse helpers (api)

- Add /api/locations with normalized payload (locations)

- Add /api/catalog with full pagination and normalization (catalog)

- Publish client-facing wire types (api)

- Add Money helpers with bigint arithmetic (ui)

- Add client-side fetchers and pure menu selectors (menu)

- Add DataState wrapper for loading/empty/error/stale flows (ui)

- Add LocationSwitcher and persisted selection hook (menu)

- Add CategoryFilter, ItemCard, and ItemList (menu)

- Wire menu page with location switcher and category filter (menu)

- Add item detail page with variation selector (menu)

- Add IANA-aware wall-clock helpers (availability)

- Add pure resolver covering all spec cases (availability)

- Add TimeProvider for real and simulated clocks (availability)

- Add time simulator banner (availability)

- Add AvailabilityBadge with state-aware rendering (availability)

- Wire AvailabilityBadge into menu and detail (availability)

- Add debounced client-side menu search (search)

- Define cart types with snapshotted money (cart)

- Add pure subtotal/line-total selectors (cart)

- Add Zustand store with bigint-aware persistence (cart)

- Add ModifierSelector respecting Square constraints (modifiers)

- Wire modifier selector and cart add into item detail (cart)

- Add cart drawer with subtotal and switch-location guard (cart)

- Add /api/inventory backed by batch counts (inventory)

- Poll /api/inventory and reflect stock in UI (inventory)

### Fixes

- Align schemas and normalizer with the design spec (square)

- Resolve item image URLs through IMAGE catalog objects (catalog)

- Make closed_today reachable and use opens_at.reason (availability)

- Enforce single-location invariant on addLine (cart)

### Refactoring

- Drop duplicate-letter collapse, keep tokenization (search)

- Extract polling hook and prefer in-stock variation (inventory)
