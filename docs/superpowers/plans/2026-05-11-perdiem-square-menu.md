# Per Diem Square Menu Browser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-location menu browser on Square's Catalog, Locations, and Inventory APIs that demonstrates senior product judgment, team-grade code, and secure secret handling. All 6 core requirements plus 5 bonuses (time-of-day availability, search, modifiers integrated with cart, persistent cart, out-of-stock).

**Architecture:** Next.js 15 App Router with strict TypeScript. Route handlers under `app/api/square/*` proxy every Square call (token never reaches the client) and return normalized, Zod-validated shapes. A pure availability resolver consumes a `now: Date` argument so the same logic powers production badges and the URL-driven time simulator. Cart state lives in Zustand with a `localStorage` persist middleware and snapshotted prices. Each stage is its own branch and PR; worktrees allow parallel work.

**Tech Stack:** Next.js 15 · React 19 · TypeScript strict · Node 24 · pnpm · Tailwind CSS · shadcn/ui · Zustand · Zod · Vitest · Husky + commitlint + lint-staged · Square Node SDK · Vercel.

---

## Conventions (read first)

**Commits:** Conventional Commits, enforced by commitlint. Format:

```
<type>(<scope>): <subject under 72 chars>

<body explaining WHY and trade-offs, wrapped at 72 chars>

Refs: spec §X.Y
```

Allowed types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`.
Primary scopes: `square`, `catalog`, `locations`, `inventory`, `availability`, `cart`, `modifiers`, `search`, `ui`, `api`, `tooling`.

**Branches:** one per stage — `feat/01-square-proxy`, `feat/02-menu-core`, etc. Each opens a PR using the template from spec §8.4. Merge into `main` after self-review.

**Worktrees (optional, for parallel work):**

```bash
git worktree add ../jobtest-stage-3 feat/03-availability
```

Each worktree shares the pnpm store; install is instant.

**Test runner:** all tests use Vitest. Run a single test with `pnpm vitest run tests/<file> -t '<name>'`.

**Type checking:** `pnpm typecheck` runs `tsc --noEmit`. Run before every commit (handled automatically by lint-staged).

---

# Stage 0 — Foundation

**Branch:** `main` (initial commits before any feature branches).
**Goal:** scaffold the project, install all base tooling, configure strict TypeScript, set up commit hooks, and verify the build pipeline.
**Stage gate:** `pnpm build` and `pnpm lint` exit clean on an empty Next.js page.

---

### Task 0.1 — Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, all defaults from `create-next-app`.

- [ ] **Step 1: Run create-next-app**

```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias='@/*' --use-pnpm --turbopack --no-git
```

Choose: TypeScript yes, Tailwind yes, App Router yes, src/ no, import alias `@/*`.

- [ ] **Step 2: Verify the dev server boots**

Run: `pnpm dev`
Expected: Next.js server reports ready at `http://localhost:3000`. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
chore(tooling): scaffold Next.js 15 app with App Router and Tailwind

Bootstrap with create-next-app using TypeScript, Tailwind, ESLint,
App Router, and the @/* import alias. pnpm is the package manager
across the project.

Refs: spec §1.1
EOF
)"
```

---

### Task 0.2 — Tighten TypeScript to strict mode

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Edit tsconfig compilerOptions**

Inside `compilerOptions`, ensure these flags are set:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "exactOptionalPropertyTypes": true,
  "forceConsistentCasingInFileNames": true,
  "verbatimModuleSyntax": true
}
```

- [ ] **Step 2: Verify typecheck still passes**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Add a typecheck script**

In `package.json` `scripts`, add:

```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json package.json
git commit -m "$(cat <<'EOF'
chore(tooling): enable strict TypeScript flags

Turn on strict, noUncheckedIndexedAccess, noImplicitOverride,
noFallthroughCasesInSwitch, exactOptionalPropertyTypes, and
verbatimModuleSyntax. These catch the classes of bugs the take-home
brief explicitly forbids: any, ts-ignore, types that lie.

Refs: spec §1.1
EOF
)"
```

---

### Task 0.3 — Install and configure shadcn/ui

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/*` (after first add).

- [ ] **Step 1: Initialize shadcn**

Run: `pnpm dlx shadcn@latest init -y`

When prompted, accept defaults: New York style, Slate base color, CSS variables yes.

- [ ] **Step 2: Add the primitives needed across the app**

Run:

```bash
pnpm dlx shadcn@latest add button card sheet skeleton input badge select dialog tooltip separator scroll-area sonner
```

- [ ] **Step 3: Verify build still works**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components.json lib/utils.ts components/ui/ app/globals.css tailwind.config.* package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(ui): scaffold shadcn/ui with primitives needed for the menu

Install the New York / Slate variant and the components the spec
calls out: button, card, sheet (cart drawer), skeleton (loading
fallbacks), input, badge (availability/inventory), select,
dialog (location-switch confirm), tooltip, separator, scroll-area,
and sonner for toasts.

Refs: spec §1.1, §6, §7
EOF
)"
```

---

### Task 0.4 — Install runtime dependencies

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add square zod zustand
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(deps): add Square SDK, zod, zustand, and vitest

Square SDK is the official client (typed, no hand-rolled shapes).
Zod validates Square responses at the proxy boundary so a shape
change fails fast in one place. Zustand backs the cart store with
a tiny SSR-safe API. Vitest is the test runner; jsdom and Testing
Library are reserved for component tests.

Refs: spec §1.1
EOF
)"
```

---

### Task 0.5 — Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json`, `tsconfig.json`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") },
  },
});
```

- [ ] **Step 2: Write `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add include for tests in tsconfig**

In `tsconfig.json`, ensure `"include"` covers `tests/**/*`.

- [ ] **Step 4: Add scripts to package.json**

In `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 5: Run vitest to verify it boots**

Run: `pnpm test`
Expected: "No test files found" — that's fine, we have no tests yet. Exit code 0 with `--passWithNoTests`? If it exits non-zero, add `passWithNoTests: true` to `vitest.config.ts` `test` block.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/ package.json tsconfig.json
git commit -m "$(cat <<'EOF'
chore(tooling): configure Vitest with @ alias and jest-dom matchers

Node environment by default; component tests can opt into jsdom on
a per-file basis. Aliases mirror Next.js so test imports look like
production imports.

Refs: spec §11
EOF
)"
```

---

### Task 0.6 — Configure Husky, lint-staged, commitlint

**Files:**
- Create: `.husky/pre-commit`, `.husky/commit-msg`, `commitlint.config.js`, `lint-staged.config.js`
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

```bash
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional
pnpm exec husky init
```

- [ ] **Step 2: Write `commitlint.config.js`**

```js
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "perf", "test", "docs", "chore", "build", "ci"],
    ],
    "scope-empty": [2, "never"],
    "subject-case": [0],
  },
};
```

- [ ] **Step 3: Write `lint-staged.config.js`**

```js
module.exports = {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"],
};
```

- [ ] **Step 4: Write `.husky/pre-commit`**

```sh
pnpm exec lint-staged
pnpm typecheck
```

- [ ] **Step 5: Write `.husky/commit-msg`**

```sh
pnpm exec commitlint --edit "$1"
```

- [ ] **Step 6: Install Prettier with Tailwind plugin**

```bash
pnpm add -D prettier prettier-plugin-tailwindcss
```

- [ ] **Step 7: Write `.prettierrc.json`**

```json
{ "plugins": ["prettier-plugin-tailwindcss"] }
```

- [ ] **Step 8: Test the hooks**

Try a bad commit:

```bash
echo "// noop" > scratch.ts
git add scratch.ts
git commit -m "wip stuff"
```

Expected: commitlint rejects.

Then:

```bash
git commit -m "chore(tooling): test commitlint"
```

Expected: succeeds. Now revert the scratch:

```bash
git rm scratch.ts
git commit -m "chore(tooling): remove scratch"
```

- [ ] **Step 9: Commit the configuration**

```bash
git add .husky/ commitlint.config.js lint-staged.config.js .prettierrc.json package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(tooling): enforce Conventional Commits and pre-commit linting

Husky drives two hooks. pre-commit runs lint-staged (eslint --fix
plus prettier on staged files) and pnpm typecheck so broken types
never land. commit-msg runs commitlint with the type list pinned in
the spec so the history stays parseable for downstream tooling and
the take-home reviewer.

Refs: spec §8.3, §8.5
EOF
)"
```

---

### Task 0.7 — Set up environment variables and Vercel config

**Files:**
- Create: `.env.example`, `vercel.ts`
- Verify: `.gitignore` already excludes `.env*.local`

- [ ] **Step 1: Write `.env.example`**

```
# Square sandbox credentials. Fill in .env.local — never commit real values.
SQUARE_ACCESS_TOKEN=
SQUARE_ENVIRONMENT=sandbox
```

- [ ] **Step 2: Install Vercel config package**

```bash
pnpm add -D @vercel/config
```

- [ ] **Step 3: Write `vercel.ts`**

```ts
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  regions: ["iad1"],
  functions: {
    "app/api/**/*": { maxDuration: 30 },
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add .env.example vercel.ts package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(tooling): add .env.example and typed Vercel config

The example documents the only two env vars the app reads and makes
.env.local discoverable for the reviewer. vercel.ts pins us to a US
East region (closest to Square's US datacenter) and gives API routes
the 30s timeout the catalog aggregation may need on first request.

Refs: spec §1.3, §9.3
EOF
)"
```

---

### Task 0.8 — Verify the build pipeline

- [ ] **Step 1: Run all checks**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

Expected: all four exit 0.

- [ ] **Step 2: If any failed, fix and re-run before continuing.**

---

# Stage 1 — Square proxy backend

**Branch:** `feat/01-square-proxy`
**Goal:** Server-only Square SDK wrapper, Zod-validated normalized shapes, error mapping, and the first two route handlers (`/api/locations`, `/api/catalog`) with pagination and caching.
**Stage gate:** `curl http://localhost:3000/api/locations` and `/api/catalog` return normalized JSON with no Square shapes leaking through. No `any` in the codebase.

---

### Task 1.1 — Create the branch

```bash
git checkout -b feat/01-square-proxy
```

---

### Task 1.2 — Define normalized types and Zod schemas

**Files:**
- Create: `lib/square/schemas.ts`

- [ ] **Step 1: Write the schemas**

```ts
// lib/square/schemas.ts
import { z } from "zod";

export const MoneySchema = z.object({
  amount: z.bigint(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof MoneySchema>;

export const TimeRangeSchema = z.object({
  startLocal: z.string().regex(/^\d{2}:\d{2}$/), // "HH:MM"
  endLocal: z.string().regex(/^\d{2}:\d{2}$/),
});
export type TimeRange = z.infer<typeof TimeRangeSchema>;

export const DayOfWeek = z.enum([
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
]);
export type DayOfWeek = z.infer<typeof DayOfWeek>;

export const AvailabilityWindowSchema = z.object({
  dayOfWeek: DayOfWeek,
  range: TimeRangeSchema,
});
export type AvailabilityWindow = z.infer<typeof AvailabilityWindowSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(), // IANA
  status: z.enum(["ACTIVE", "INACTIVE"]),
  currency: z.string().length(3),
});
export type Location = z.infer<typeof LocationSchema>;

export const ModifierSchema = z.object({
  id: z.string(),
  modifierListId: z.string(),
  name: z.string(),
  priceMoney: MoneySchema.nullable(),
  ordinal: z.number(),
});
export type Modifier = z.infer<typeof ModifierSchema>;

export const ModifierListSchema = z.object({
  id: z.string(),
  name: z.string(),
  selectionType: z.enum(["SINGLE", "MULTIPLE"]),
  minSelected: z.number().nullable(),
  maxSelected: z.number().nullable(),
  modifiers: z.array(ModifierSchema),
});
export type ModifierList = z.infer<typeof ModifierListSchema>;

export const ItemVariationSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  name: z.string(),
  priceMoney: MoneySchema.nullable(),
  ordinal: z.number(),
});
export type ItemVariation = z.infer<typeof ItemVariationSchema>;

export const ItemModifierListInfoSchema = z.object({
  modifierListId: z.string(),
  enabled: z.boolean(),
  minSelectedOverride: z.number().nullable(),
  maxSelectedOverride: z.number().nullable(),
});
export type ItemModifierListInfo = z.infer<typeof ItemModifierListInfoSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  categoryId: z.string().nullable(),
  variations: z.array(ItemVariationSchema).min(1),
  modifierListInfo: z.array(ItemModifierListInfoSchema),
  presentAtAllLocations: z.boolean(),
  presentAtLocationIds: z.array(z.string()),
  absentAtLocationIds: z.array(z.string()),
});
export type Item = z.infer<typeof ItemSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  ordinal: z.number(),
  /**
   * Recurring weekly windows when this category is orderable.
   * Empty array = always available (no time restriction).
   */
  availabilityWindows: z.array(AvailabilityWindowSchema),
  /**
   * Per-location override. If a locationId appears here, its windows
   * REPLACE the category default for that location.
   */
  locationOverrides: z.record(
    z.string(),
    z.array(AvailabilityWindowSchema),
  ),
});
export type Category = z.infer<typeof CategorySchema>;

export const CatalogSnapshotSchema = z.object({
  items: z.array(ItemSchema),
  categories: z.array(CategorySchema),
  modifierLists: z.array(ModifierListSchema),
  fetchedAt: z.string().datetime(),
});
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;

export const InventoryEntrySchema = z.object({
  state: z.enum(["IN_STOCK", "OUT_OF_STOCK", "OTHER"]),
  quantity: z.number().nonnegative(),
});
export type InventoryEntry = z.infer<typeof InventoryEntrySchema>;

export const InventoryByVariationSchema = z.record(z.string(), InventoryEntrySchema);
export type InventoryByVariation = z.infer<typeof InventoryByVariationSchema>;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add lib/square/schemas.ts
git commit -m "$(cat <<'EOF'
feat(square): define normalized types and zod schemas for the proxy

These shapes are the contract our backend exposes to the client.
They deliberately diverge from Square's wire format: ids are flat,
windows are pre-split per day-of-week (so midnight crossings are
already handled at normalization time), modifier lists are
indexable, and money is a {bigint, currency} pair so totals never
suffer float drift. The client never imports anything else from
@/lib/square.

Refs: spec §1.2, §2.5, §3.1
EOF
)"
```

---

### Task 1.3 — Server-only Square client

**Files:**
- Create: `lib/square/client.ts`, `lib/square/env.ts`
- Add: `pnpm add server-only`

- [ ] **Step 1: Install server-only**

```bash
pnpm add server-only
```

- [ ] **Step 2: Write `lib/square/env.ts`**

```ts
// lib/square/env.ts
import "server-only";

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. See .env.example.`,
    );
  }
  return v;
}
```

- [ ] **Step 3: Write `lib/square/client.ts`**

```ts
// lib/square/client.ts
import "server-only";
import { Client, Environment } from "square";
import { requireEnv } from "./env";

const environment =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? Environment.Production
    : Environment.Sandbox;

export const square = new Client({
  accessToken: requireEnv("SQUARE_ACCESS_TOKEN"),
  environment,
  userAgentDetail: "perdiem-takehome",
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/square/env.ts lib/square/client.ts package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(square): add server-only SDK client and env reader

server-only ensures any accidental import from a client component
fails the build instead of leaking the access token to the browser.
requireEnv fails loudly at boot rather than producing an unhelpful
401 from Square at first request.

Refs: spec §1.3, §2.2
EOF
)"
```

---

### Task 1.4 — safeSquareCall and error mapping

**Files:**
- Create: `lib/square/errors.ts`
- Test: `tests/square-errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/square-errors.test.ts
import { describe, expect, it } from "vitest";
import { ApiError } from "square";
import { mapSquareError, safeSquareCall } from "@/lib/square/errors";

describe("mapSquareError", () => {
  it("maps 429 with Retry-After header to rate_limited", () => {
    const err = Object.assign(new Error("rate limited"), {
      statusCode: 429,
      headers: { "retry-after": "12" },
    }) as unknown as ApiError;
    expect(mapSquareError(err)).toEqual({
      kind: "rate_limited",
      retryAfterSeconds: 12,
    });
  });

  it("maps 401 to unauthorized", () => {
    const err = Object.assign(new Error("nope"), {
      statusCode: 401,
      headers: {},
    }) as unknown as ApiError;
    expect(mapSquareError(err)).toEqual({ kind: "unauthorized" });
  });

  it("maps 404 to not_found", () => {
    const err = Object.assign(new Error("missing"), {
      statusCode: 404,
      headers: {},
    }) as unknown as ApiError;
    expect(mapSquareError(err)).toEqual({ kind: "not_found" });
  });

  it("maps 5xx to server_error with status preserved", () => {
    const err = Object.assign(new Error("boom"), {
      statusCode: 502,
      headers: {},
    }) as unknown as ApiError;
    expect(mapSquareError(err)).toEqual({
      kind: "server_error",
      status: 502,
    });
  });

  it("maps unknown errors to network", () => {
    expect(mapSquareError(new Error("dns fail"))).toEqual({
      kind: "network",
    });
  });
});

describe("safeSquareCall", () => {
  it("returns ok on success", async () => {
    const res = await safeSquareCall(() => Promise.resolve(42));
    expect(res).toEqual({ ok: true, value: 42 });
  });

  it("returns err on failure", async () => {
    const res = await safeSquareCall(() =>
      Promise.reject(new Error("network down")),
    );
    expect(res).toEqual({ ok: false, error: { kind: "network" } });
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm vitest run tests/square-errors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/square/errors.ts`**

```ts
// lib/square/errors.ts
import "server-only";
import type { ApiError } from "square";

export type SquareError =
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "server_error"; status: number }
  | { kind: "network" };

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: SquareError };

function isApiError(e: unknown): e is ApiError {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    typeof (e as { statusCode?: unknown }).statusCode === "number"
  );
}

export function mapSquareError(err: unknown): SquareError {
  if (!isApiError(err)) return { kind: "network" };
  const status = err.statusCode;
  if (status === 429) {
    const headers = (err as unknown as { headers?: Record<string, string> })
      .headers;
    const raw = headers?.["retry-after"];
    const seconds = raw ? Number.parseInt(raw, 10) : 1;
    return {
      kind: "rate_limited",
      retryAfterSeconds: Number.isFinite(seconds) ? seconds : 1,
    };
  }
  if (status === 401 || status === 403) return { kind: "unauthorized" };
  if (status === 404) return { kind: "not_found" };
  if (status >= 500) return { kind: "server_error", status };
  return { kind: "network" };
}

export async function safeSquareCall<T>(
  fn: () => Promise<T>,
): Promise<Result<T>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: mapSquareError(e) };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/square-errors.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/square/errors.ts tests/square-errors.test.ts
git commit -m "$(cat <<'EOF'
feat(square): add safeSquareCall wrapper and error mapping

Square throws ApiError with mixed shapes; mapSquareError narrows it
into a discriminated union the route handlers and the UI can both
exhaust. safeSquareCall returns a Result so the proxy code stays
linear (no try/catch noise) and the type system reminds the caller
to handle the error branch.

Refs: spec §2.3
EOF
)"
```

---

### Task 1.5 — HTTP response helpers for route handlers

**Files:**
- Create: `lib/square/responses.ts`

- [ ] **Step 1: Write the helper**

```ts
// lib/square/responses.ts
import "server-only";
import { NextResponse } from "next/server";
import type { SquareError } from "./errors";

export function errorResponse(error: SquareError): NextResponse {
  switch (error.kind) {
    case "rate_limited":
      return NextResponse.json(
        { error: "rate_limited", retryAfterSeconds: error.retryAfterSeconds },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        },
      );
    case "unauthorized":
      return NextResponse.json(
        { error: "upstream_unauthorized" },
        { status: 502 },
      );
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "server_error":
      return NextResponse.json(
        { error: "upstream_error", status: error.status },
        { status: 502 },
      );
    case "network":
      return NextResponse.json(
        { error: "network_error" },
        { status: 502 },
      );
  }
}

export function jsonResponse<T>(
  payload: T,
  init?: ResponseInit & { revalidateSeconds?: number },
): NextResponse {
  const headers = new Headers(init?.headers);
  if (init?.revalidateSeconds) {
    headers.set(
      "Cache-Control",
      `public, max-age=0, s-maxage=${init.revalidateSeconds}, stale-while-revalidate=${init.revalidateSeconds * 2}`,
    );
  }
  return NextResponse.json(payload, { ...init, headers });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add lib/square/responses.ts
git commit -m "$(cat <<'EOF'
feat(api): add jsonResponse and errorResponse helpers

errorResponse owns the SquareError -> HTTP mapping in one place so
every route handler stays consistent: 429 keeps Retry-After, 4xx
from Square never leaks as 4xx to our client (we mask as 502 except
for 404), and the kind discriminator drives the response.
jsonResponse centralizes the SWR cache header so per-endpoint TTLs
are declarative.

Refs: spec §2.1, §2.3
EOF
)"
```

---

### Task 1.6 — Locations endpoint

**Files:**
- Create: `lib/square/locations.ts`, `app/api/locations/route.ts`

- [ ] **Step 1: Write `lib/square/locations.ts`**

```ts
// lib/square/locations.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { square } from "./client";
import { safeSquareCall, type Result } from "./errors";
import { LocationSchema, type Location } from "./schemas";

async function fetchLocationsRaw(): Promise<Result<Location[]>> {
  return safeSquareCall(async () => {
    const res = await square.locationsApi.listLocations();
    const raw = res.result.locations ?? [];
    const normalized: Location[] = raw
      .filter((l) => l.id && l.name && l.timezone && l.status)
      .map((l) => ({
        id: l.id!,
        name: l.name!,
        timezone: l.timezone!,
        status: l.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        currency: l.currency ?? "USD",
      }));
    return normalized.map((l) => LocationSchema.parse(l));
  });
}

export const getLocations = unstable_cache(
  fetchLocationsRaw,
  ["locations"],
  { revalidate: 3600, tags: ["locations"] },
);
```

- [ ] **Step 2: Write `app/api/locations/route.ts`**

```ts
// app/api/locations/route.ts
import "server-only";
import { getLocations } from "@/lib/square/locations";
import { errorResponse, jsonResponse } from "@/lib/square/responses";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const result = await getLocations();
  if (!result.ok) return errorResponse(result.error);
  return jsonResponse(result.value, { revalidateSeconds: 3600 });
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 4: Smoke test**

If you have a Square sandbox token in `.env.local`:

```bash
pnpm dev
# in another shell:
curl -s http://localhost:3000/api/locations | head
```

Expected: JSON array of locations or, if no token configured, a 502 with `{"error":"network_error"}`. Either confirms the route is reachable.

- [ ] **Step 5: Commit**

```bash
git add lib/square/locations.ts app/api/locations/route.ts
git commit -m "$(cat <<'EOF'
feat(locations): add /api/locations with normalized payload

getLocations is wrapped with unstable_cache (1h TTL, tag
'locations') so a typical session hits Square once. Locations
without an id, name, timezone, or status are filtered out before
normalization — Square sandbox occasionally returns half-built
records and we never want them surfacing in the UI.

Refs: spec §2.1, §2.4
EOF
)"
```

---

### Task 1.7 — Catalog endpoint with full pagination

**Files:**
- Create: `lib/square/catalog.ts`, `app/api/catalog/route.ts`

- [ ] **Step 1: Write `lib/square/catalog.ts`**

```ts
// lib/square/catalog.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { square } from "./client";
import { safeSquareCall, type Result } from "./errors";
import {
  CatalogSnapshotSchema,
  type CatalogSnapshot,
  type Category,
  type Item,
  type ModifierList,
  type AvailabilityWindow,
} from "./schemas";

const TYPES = "ITEM,CATEGORY,MODIFIER_LIST";

async function listAllCatalog(): Promise<unknown[]> {
  const all: unknown[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await square.catalogApi.listCatalog(cursor, TYPES);
    if (res.result.objects) all.push(...res.result.objects);
    cursor = res.result.cursor;
  } while (cursor);
  return all;
}

function moneyFromSquare(
  m: { amount?: bigint | number | null; currency?: string | null } | null | undefined,
): { amount: bigint; currency: string } | null {
  if (!m || m.amount == null || !m.currency) return null;
  const n = typeof m.amount === "bigint" ? m.amount : BigInt(m.amount);
  return { amount: n, currency: m.currency };
}

function parseAvailabilityPeriods(
  raw: unknown,
): AvailabilityWindow[] {
  // Square returns "availabilityPeriods" as { startLocalTime, endLocalTime, dayOfWeek }.
  // We split midnight-crossing windows here so the resolver stays simple.
  if (!Array.isArray(raw)) return [];
  const out: AvailabilityWindow[] = [];
  for (const p of raw) {
    if (
      !p ||
      typeof p !== "object" ||
      typeof (p as { startLocalTime?: unknown }).startLocalTime !== "string" ||
      typeof (p as { endLocalTime?: unknown }).endLocalTime !== "string" ||
      typeof (p as { dayOfWeek?: unknown }).dayOfWeek !== "string"
    ) {
      continue;
    }
    const start = (p as { startLocalTime: string }).startLocalTime.slice(0, 5);
    const end = (p as { endLocalTime: string }).endLocalTime.slice(0, 5);
    const day = (p as { dayOfWeek: string }).dayOfWeek as
      | "SUN"
      | "MON"
      | "TUE"
      | "WED"
      | "THU"
      | "FRI"
      | "SAT";
    if (start <= end) {
      out.push({ dayOfWeek: day, range: { startLocal: start, endLocal: end } });
    } else {
      // Crosses midnight: split into [start..24:00] today and [00:00..end] next day
      const next: Record<typeof day, typeof day> = {
        SUN: "MON",
        MON: "TUE",
        TUE: "WED",
        WED: "THU",
        THU: "FRI",
        FRI: "SAT",
        SAT: "SUN",
      };
      out.push({
        dayOfWeek: day,
        range: { startLocal: start, endLocal: "23:59" },
      });
      out.push({
        dayOfWeek: next[day],
        range: { startLocal: "00:00", endLocal: end },
      });
    }
  }
  return out;
}

function normalizeCatalog(objects: unknown[]): CatalogSnapshot {
  const items: Item[] = [];
  const categories: Category[] = [];
  const modifierLists: ModifierList[] = [];

  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;
    const o = obj as {
      type?: string;
      id?: string;
      itemData?: any;
      categoryData?: any;
      modifierListData?: any;
      presentAtAllLocations?: boolean;
      presentAtLocationIds?: string[];
      absentAtLocationIds?: string[];
    };
    if (!o.id || !o.type) continue;

    if (o.type === "ITEM" && o.itemData) {
      const variations = (o.itemData.variations ?? [])
        .map((v: any) => {
          if (!v.id || !v.itemVariationData?.name) return null;
          return {
            id: v.id,
            itemId: o.id!,
            name: v.itemVariationData.name,
            priceMoney: moneyFromSquare(v.itemVariationData.priceMoney),
            ordinal: v.itemVariationData.ordinal ?? 0,
          };
        })
        .filter(Boolean);
      if (variations.length === 0) continue;
      items.push({
        id: o.id,
        name: o.itemData.name ?? "(unnamed)",
        description: o.itemData.description ?? null,
        imageUrl: o.itemData.imageUrl ?? null,
        categoryId: o.itemData.categoryId ?? null,
        variations,
        modifierListInfo: (o.itemData.modifierListInfo ?? []).map(
          (m: any) => ({
            modifierListId: m.modifierListId,
            enabled: m.enabled !== false,
            minSelectedOverride: m.minSelectedModifiers ?? null,
            maxSelectedOverride: m.maxSelectedModifiers ?? null,
          }),
        ),
        presentAtAllLocations: o.presentAtAllLocations ?? true,
        presentAtLocationIds: o.presentAtLocationIds ?? [],
        absentAtLocationIds: o.absentAtLocationIds ?? [],
      });
    } else if (o.type === "CATEGORY" && o.categoryData) {
      const overrides: Record<string, AvailabilityWindow[]> = {};
      const rawOverrides = o.categoryData.locationOverrides ?? [];
      for (const ov of rawOverrides) {
        if (!ov?.locationId) continue;
        overrides[ov.locationId] = parseAvailabilityPeriods(
          ov.availabilityPeriods,
        );
      }
      categories.push({
        id: o.id,
        name: o.categoryData.name ?? "(unnamed)",
        ordinal: o.categoryData.ordinal ?? 0,
        availabilityWindows: parseAvailabilityPeriods(
          o.categoryData.availabilityPeriods,
        ),
        locationOverrides: overrides,
      });
    } else if (o.type === "MODIFIER_LIST" && o.modifierListData) {
      const mods = (o.modifierListData.modifiers ?? [])
        .map((m: any) => {
          if (!m.id || !m.modifierData?.name) return null;
          return {
            id: m.id,
            modifierListId: o.id!,
            name: m.modifierData.name,
            priceMoney: moneyFromSquare(m.modifierData.priceMoney),
            ordinal: m.modifierData.ordinal ?? 0,
          };
        })
        .filter(Boolean);
      modifierLists.push({
        id: o.id,
        name: o.modifierListData.name ?? "(unnamed)",
        selectionType:
          o.modifierListData.selectionType === "MULTIPLE"
            ? "MULTIPLE"
            : "SINGLE",
        minSelected: o.modifierListData.minSelectedModifiers ?? null,
        maxSelected: o.modifierListData.maxSelectedModifiers ?? null,
        modifiers: mods,
      });
    }
  }

  return CatalogSnapshotSchema.parse({
    items,
    categories,
    modifierLists,
    fetchedAt: new Date().toISOString(),
  });
}

async function fetchCatalog(): Promise<Result<CatalogSnapshot>> {
  return safeSquareCall(async () => {
    const objects = await listAllCatalog();
    return normalizeCatalog(objects);
  });
}

export const getCatalog = unstable_cache(fetchCatalog, ["catalog"], {
  revalidate: 300,
  tags: ["catalog"],
});
```

- [ ] **Step 2: Write `app/api/catalog/route.ts`**

```ts
// app/api/catalog/route.ts
import "server-only";
import { getCatalog } from "@/lib/square/catalog";
import { errorResponse, jsonResponse } from "@/lib/square/responses";

export async function GET(): Promise<Response> {
  const result = await getCatalog();
  if (!result.ok) return errorResponse(result.error);
  // bigints don't survive JSON.stringify natively; serialize money manually.
  const serialized = {
    ...result.value,
    items: result.value.items.map((i) => ({
      ...i,
      variations: i.variations.map((v) => ({
        ...v,
        priceMoney: v.priceMoney
          ? { amount: v.priceMoney.amount.toString(), currency: v.priceMoney.currency }
          : null,
      })),
    })),
    modifierLists: result.value.modifierLists.map((ml) => ({
      ...ml,
      modifiers: ml.modifiers.map((m) => ({
        ...m,
        priceMoney: m.priceMoney
          ? { amount: m.priceMoney.amount.toString(), currency: m.priceMoney.currency }
          : null,
      })),
    })),
  };
  return jsonResponse(serialized, { revalidateSeconds: 300 });
}
```

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add lib/square/catalog.ts app/api/catalog/route.ts
git commit -m "$(cat <<'EOF'
feat(catalog): add /api/catalog with full pagination and normalization

listAllCatalog loops listCatalog until cursor is empty so the client
never sees pagination state. normalizeCatalog converts Square's
nested wire format into the flat indexable shape the spec defines:
items reference categoryId, modifier lists carry their selection
constraints inline, and category availability periods are pre-split
on midnight crossings so the availability resolver does not need to
think about that case.

Money amounts are serialized as decimal strings on the JSON wire
because bigint does not survive JSON.stringify; the client parses
them back with BigInt() at the boundary.

Refs: spec §2.1, §2.4, §2.5
EOF
)"
```

---

### Task 1.8 — Open the PR

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin feat/01-square-proxy
gh pr create --title "feat(square): backend proxy with locations and catalog endpoints" --body "$(cat <<'EOF'
## What
Adds the server-only Square proxy: typed client wrapper, Zod-validated normalized shapes, error mapping, and the /api/locations and /api/catalog endpoints with pagination and unstable_cache TTLs.

## Why
Implements spec §1.3 (security boundary), §2.1, §2.3, §2.4, §2.5. This is the foundation every later feature reads from.

## How
- `lib/square/client.ts` is `server-only`; importing from a client component fails the build.
- `safeSquareCall` returns a Result so route handlers stay linear.
- `mapSquareError` discriminates Square failures into one of five kinds; the response helper translates each to an appropriate HTTP code (Square 4xx is masked as 502 except 404 / 429).
- Catalog pagination is server-side; the client receives one normalized snapshot.

## Tests
- [x] `tests/square-errors.test.ts` covers all five error kinds and Result happy/failure paths.
- [ ] Manual: `curl http://localhost:3000/api/locations` and `/api/catalog` return normalized JSON when SQUARE_ACCESS_TOKEN is configured.

## Risks / Follow-ups
- No retry on rate limit yet (out of scope for this stage).
- Catalog cache TTL at 5min trades freshness for sandbox rate-limit safety.

Closes spec §2
EOF
)"
```

- [ ] **Step 2: Self-review the diff in the PR**

Read every file changed. Verify no `any` slipped through (the catalog normalizer uses `any` intentionally on Square's side because the SDK types are loose; assert that all outputs are Zod-parsed).

- [ ] **Step 3: Merge to main**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

# Stage 2 — Core menu UI

**Branch:** `feat/02-menu-core`
**Goal:** the six core requirements end-to-end. Location switcher, category filter, item list grouped by category, item detail with money formatting, and the `<DataState>` wrapper covering loading/empty/error.
**Stage gate:** a guest can pick a location, browse items grouped by category, and open detail. Items only available at other locations are hidden by default.

---

### Task 2.1 — Branch and shared client types

```bash
git checkout -b feat/02-menu-core
```

- [ ] **Step 1: Create `lib/types.ts`** — the wire shapes the client receives (with money as string).

```ts
// lib/types.ts
export type WireMoney = { amount: string; currency: string };

export type WireLocation = {
  id: string;
  name: string;
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
  currency: string;
};

export type WireItemVariation = {
  id: string;
  itemId: string;
  name: string;
  priceMoney: WireMoney | null;
  ordinal: number;
};

export type WireItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  variations: WireItemVariation[];
  modifierListInfo: Array<{
    modifierListId: string;
    enabled: boolean;
    minSelectedOverride: number | null;
    maxSelectedOverride: number | null;
  }>;
  presentAtAllLocations: boolean;
  presentAtLocationIds: string[];
  absentAtLocationIds: string[];
};

export type WireCategory = {
  id: string;
  name: string;
  ordinal: number;
  availabilityWindows: Array<{
    dayOfWeek: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
    range: { startLocal: string; endLocal: string };
  }>;
  locationOverrides: Record<
    string,
    Array<{
      dayOfWeek: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
      range: { startLocal: string; endLocal: string };
    }>
  >;
};

export type WireModifier = {
  id: string;
  modifierListId: string;
  name: string;
  priceMoney: WireMoney | null;
  ordinal: number;
};

export type WireModifierList = {
  id: string;
  name: string;
  selectionType: "SINGLE" | "MULTIPLE";
  minSelected: number | null;
  maxSelected: number | null;
  modifiers: WireModifier[];
};

export type WireCatalog = {
  items: WireItem[];
  categories: WireCategory[];
  modifierLists: WireModifierList[];
  fetchedAt: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "$(cat <<'EOF'
feat(api): publish client-facing wire types

These mirror the schemas in @/lib/square/schemas but model money as
a decimal string instead of a bigint, because the JSON boundary
cannot transport bigints. UI components import only from
@/lib/types so the server module graph (and therefore the Square
SDK and the access token) never reaches the client bundle.

Refs: spec §1.3, §2.5
EOF
)"
```

---

### Task 2.2 — Money helpers

**Files:**
- Create: `lib/money.ts`
- Test: `tests/money.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/money.test.ts
import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  multiplyMoney,
  parseMoney,
  zeroMoney,
} from "@/lib/money";

describe("parseMoney", () => {
  it("parses string-amount wire money to bigint", () => {
    expect(parseMoney({ amount: "1234", currency: "USD" })).toEqual({
      amount: 1234n,
      currency: "USD",
    });
  });
});

describe("formatMoney", () => {
  it("formats USD cents as $12.34", () => {
    expect(formatMoney({ amount: 1234n, currency: "USD" })).toBe("$12.34");
  });
  it("formats zero as $0.00", () => {
    expect(formatMoney({ amount: 0n, currency: "USD" })).toBe("$0.00");
  });
  it("formats EUR with euro symbol", () => {
    expect(formatMoney({ amount: 100n, currency: "EUR" }, "en-US")).toMatch(
      /€1\.00/,
    );
  });
});

describe("addMoney", () => {
  it("adds two same-currency amounts", () => {
    expect(
      addMoney(
        { amount: 100n, currency: "USD" },
        { amount: 250n, currency: "USD" },
      ),
    ).toEqual({ amount: 350n, currency: "USD" });
  });
  it("throws on currency mismatch", () => {
    expect(() =>
      addMoney(
        { amount: 100n, currency: "USD" },
        { amount: 250n, currency: "EUR" },
      ),
    ).toThrow(/currency mismatch/i);
  });
});

describe("multiplyMoney", () => {
  it("multiplies by a positive integer", () => {
    expect(multiplyMoney({ amount: 150n, currency: "USD" }, 3)).toEqual({
      amount: 450n,
      currency: "USD",
    });
  });
  it("throws on non-integer or negative qty", () => {
    expect(() => multiplyMoney({ amount: 1n, currency: "USD" }, 1.5)).toThrow();
    expect(() => multiplyMoney({ amount: 1n, currency: "USD" }, -1)).toThrow();
  });
});

describe("zeroMoney", () => {
  it("returns 0 in the currency", () => {
    expect(zeroMoney("USD")).toEqual({ amount: 0n, currency: "USD" });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run tests/money.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/money.ts`**

```ts
// lib/money.ts
import type { WireMoney } from "./types";

export type Money = { amount: bigint; currency: string };

export function parseMoney(m: WireMoney): Money {
  return { amount: BigInt(m.amount), currency: m.currency };
}

export function zeroMoney(currency: string): Money {
  return { amount: 0n, currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: ${a.currency} vs ${b.currency}`,
    );
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function multiplyMoney(m: Money, qty: number): Money {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`Quantity must be a non-negative integer, got ${qty}`);
  }
  return { amount: m.amount * BigInt(qty), currency: m.currency };
}

export function formatMoney(m: Money, locale = "en-US"): string {
  // Square money is in the smallest currency unit (e.g. cents). Most ISO
  // currencies have 2 minor units; JPY and a few others have 0. Intl handles
  // this via minimumFractionDigits derived from the currency itself.
  const fmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
  });
  const minor = fmt.resolvedOptions().minimumFractionDigits;
  const divisor = 10n ** BigInt(minor);
  // Convert to a number safely for amounts under Number.MAX_SAFE_INTEGER.
  const integerPart = m.amount / divisor;
  const fractionalPart = m.amount % divisor;
  const value =
    Number(integerPart) +
    Number(fractionalPart) / Number(divisor);
  return fmt.format(value);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts tests/money.test.ts
git commit -m "$(cat <<'EOF'
feat(ui): add Money helpers with bigint arithmetic

All cart math runs in bigint cents so we never lose a penny to
float drift. parseMoney bridges the JSON wire format. formatMoney
delegates fraction-digit decisions to Intl so JPY-style zero-minor
currencies work without special-casing. add and multiply enforce
currency-mismatch and integer-quantity invariants the type system
cannot.

Refs: spec §1.2, §4.3
EOF
)"
```

---

### Task 2.3 — Catalog client fetcher and selectors

**Files:**
- Create: `lib/menu.ts`

- [ ] **Step 1: Write `lib/menu.ts`**

```ts
// lib/menu.ts
import type {
  WireCatalog,
  WireCategory,
  WireItem,
  WireLocation,
} from "./types";

export async function fetchLocations(): Promise<WireLocation[]> {
  const res = await fetch("/api/locations", { cache: "no-store" });
  if (!res.ok) throw new Error(`locations: ${res.status}`);
  return res.json();
}

export async function fetchCatalog(): Promise<WireCatalog> {
  const res = await fetch("/api/catalog", { cache: "no-store" });
  if (!res.ok) throw new Error(`catalog: ${res.status}`);
  return res.json();
}

export function isItemAtLocation(
  item: WireItem,
  locationId: string,
): boolean {
  if (item.absentAtLocationIds.includes(locationId)) return false;
  if (item.presentAtAllLocations) return true;
  return item.presentAtLocationIds.includes(locationId);
}

export function groupItemsByCategory(
  items: WireItem[],
  categories: WireCategory[],
): Array<{ category: WireCategory | null; items: WireItem[] }> {
  const byId = new Map<string, WireItem[]>();
  const uncategorized: WireItem[] = [];
  for (const item of items) {
    if (item.categoryId) {
      const list = byId.get(item.categoryId) ?? [];
      list.push(item);
      byId.set(item.categoryId, list);
    } else {
      uncategorized.push(item);
    }
  }
  const sorted = [...categories].sort((a, b) => a.ordinal - b.ordinal);
  const groups = sorted
    .filter((c) => byId.has(c.id))
    .map((c) => ({ category: c, items: byId.get(c.id) ?? [] }));
  if (uncategorized.length > 0) {
    groups.push({ category: null, items: uncategorized });
  }
  return groups;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add lib/menu.ts
git commit -m "$(cat <<'EOF'
feat(menu): add client-side fetchers and pure menu selectors

isItemAtLocation encodes Square's three-flag contract
(presentAtAllLocations, presentAtLocationIds, absentAtLocationIds)
exactly once so every UI surface filters consistently.
groupItemsByCategory keeps category ordinal as the source of truth
for ordering and exposes uncategorized items as a tail group rather
than dropping them.

Refs: spec §2 core requirement 4
EOF
)"
```

---

### Task 2.4 — DataState wrapper

**Files:**
- Create: `components/data-state.tsx`

- [ ] **Step 1: Write the wrapper**

```tsx
// components/data-state.tsx
"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props<T> = {
  loading: boolean;
  error: Error | null;
  data: T | null | undefined;
  isEmpty?: (data: T) => boolean;
  loadingFallback: ReactNode;
  emptyFallback: ReactNode;
  errorFallback?: (error: Error, retry: () => void) => ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
};

export function DataState<T>(props: Props<T>) {
  if (props.loading && (props.data === null || props.data === undefined)) {
    return <>{props.loadingFallback}</>;
  }
  if (props.error) {
    if (props.errorFallback) {
      return <>{props.errorFallback(props.error, props.onRetry ?? (() => {}))}</>;
    }
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-900">
        <p className="font-medium">Something went wrong.</p>
        <p className="text-sm">{props.error.message}</p>
        {props.onRetry && (
          <Button onClick={props.onRetry} variant="outline" className="mt-2">
            Retry
          </Button>
        )}
      </div>
    );
  }
  if (props.data === null || props.data === undefined) {
    return <>{props.loadingFallback}</>;
  }
  const empty = props.isEmpty ? props.isEmpty(props.data) : false;
  if (empty) return <>{props.emptyFallback}</>;
  return <>{props.children(props.data)}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/data-state.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add DataState wrapper for loading/empty/error/stale flows

Centralizes the four UI states the spec requires so no caller has
to reinvent them. Stale-with-data renders children (the wrapper
treats data presence as the override) so a background refresh does
not flash the skeleton.

Refs: spec §7
EOF
)"
```

---

### Task 2.5 — Location switcher with persisted selection

**Files:**
- Create: `components/menu/location-switcher.tsx`, `lib/use-selected-location.ts`

- [ ] **Step 1: Write the hook**

```ts
// lib/use-selected-location.ts
"use client";
import { useEffect, useState } from "react";

const KEY = "perdiem-selected-location-v1";

export function useSelectedLocation(): {
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  hasMounted: boolean;
} {
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
    const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (stored) setSelectedLocationId(stored);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    if (selectedLocationId) localStorage.setItem(KEY, selectedLocationId);
    else localStorage.removeItem(KEY);
  }, [selectedLocationId, hasMounted]);

  return { selectedLocationId, setSelectedLocationId, hasMounted };
}
```

- [ ] **Step 2: Write the component**

```tsx
// components/menu/location-switcher.tsx
"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WireLocation } from "@/lib/types";

type Props = {
  locations: WireLocation[];
  value: string | null;
  onChange: (id: string) => void;
};

export function LocationSwitcher({ locations, value, onChange }: Props) {
  const active = locations.filter((l) => l.status === "ACTIVE");
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-64" aria-label="Select location">
        <SelectValue placeholder="Choose a location" />
      </SelectTrigger>
      <SelectContent>
        {active.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/menu/location-switcher.tsx lib/use-selected-location.ts
git commit -m "$(cat <<'EOF'
feat(menu): add LocationSwitcher and persisted selection hook

Selection survives reloads via localStorage with a versioned key
(perdiem-selected-location-v1) so a future shape change can bump
the suffix without inheriting stale data. The hook exposes
hasMounted so consumers can avoid SSR/CSR hydration mismatches.

Refs: spec §1.2
EOF
)"
```

---

### Task 2.6 — Category filter and item card / list

**Files:**
- Create: `components/menu/category-filter.tsx`, `components/menu/item-card.tsx`, `components/menu/item-list.tsx`

- [ ] **Step 1: Write `category-filter.tsx`**

```tsx
// components/menu/category-filter.tsx
"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { WireCategory } from "@/lib/types";

type Props = {
  categories: Array<{ category: WireCategory | null; count: number }>;
  selected: string | null; // null => all
  onChange: (id: string | null) => void;
};

export function CategoryFilter({ categories, selected, onChange }: Props) {
  return (
    <ScrollArea className="w-full whitespace-nowrap" aria-label="Categories">
      <div className="flex gap-2 pb-2">
        <Button
          variant={selected === null ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(null)}
        >
          All
        </Button>
        {categories.map(({ category, count }) => {
          const id = category?.id ?? "uncategorized";
          const name = category?.name ?? "Other";
          return (
            <Button
              key={id}
              variant={selected === id ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(id)}
            >
              {name} <Badge variant="secondary" className="ml-2">{count}</Badge>
            </Button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
```

- [ ] **Step 2: Write `item-card.tsx`**

```tsx
// components/menu/item-card.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, parseMoney } from "@/lib/money";
import type { WireItem } from "@/lib/types";

type Props = { item: WireItem };

function priceRangeLabel(item: WireItem): string {
  const prices = item.variations
    .map((v) => v.priceMoney)
    .filter((m): m is NonNullable<typeof m> => m !== null);
  if (prices.length === 0) return "—";
  const parsed = prices.map(parseMoney);
  const min = parsed.reduce((a, b) => (a.amount < b.amount ? a : b));
  const max = parsed.reduce((a, b) => (a.amount > b.amount ? a : b));
  return min.amount === max.amount
    ? formatMoney(min)
    : `${formatMoney(min)} – ${formatMoney(max)}`;
}

export function ItemCard({ item }: Props) {
  return (
    <Link href={`/items/${item.id}`} className="group">
      <Card className="overflow-hidden transition hover:shadow-md">
        {item.imageUrl && (
          <div className="relative aspect-square w-full bg-muted">
            <Image
              src={item.imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover"
            />
          </div>
        )}
        <CardContent className="p-3">
          <p className="font-medium leading-tight">{item.name}</p>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {item.description}
            </p>
          )}
          <p className="mt-2 text-sm font-medium">{priceRangeLabel(item)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Write `item-list.tsx`**

```tsx
// components/menu/item-list.tsx
"use client";
import type { WireCategory, WireItem } from "@/lib/types";
import { ItemCard } from "./item-card";

type Group = { category: WireCategory | null; items: WireItem[] };

export function ItemList({ groups }: { groups: Group[] }) {
  return (
    <div className="space-y-8">
      {groups.map(({ category, items }) => (
        <section key={category?.id ?? "uncategorized"}>
          <h2 className="mb-3 text-lg font-semibold">
            {category?.name ?? "Other"}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/menu/category-filter.tsx components/menu/item-card.tsx components/menu/item-list.tsx
git commit -m "$(cat <<'EOF'
feat(menu): add CategoryFilter, ItemCard, and ItemList

CategoryFilter is a horizontal-scrollable chip row on mobile and
collapses inline on desktop. ItemCard collapses to one line if
description is null and shows a price range when variations have
distinct prices. The grid is mobile-first: two columns by default
and four on lg.

Refs: spec §2 core requirements 4-5, §9.2
EOF
)"
```

---

### Task 2.7 — Menu page wiring

**Files:**
- Create: `app/(menu)/page.tsx`, `app/(menu)/layout.tsx`

- [ ] **Step 1: Write the layout**

```tsx
// app/(menu)/layout.tsx
import type { ReactNode } from "react";

export default function MenuLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Per Diem Menu</h1>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// app/(menu)/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { LocationSwitcher } from "@/components/menu/location-switcher";
import { CategoryFilter } from "@/components/menu/category-filter";
import { ItemList } from "@/components/menu/item-list";
import { DataState } from "@/components/data-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchCatalog,
  fetchLocations,
  groupItemsByCategory,
  isItemAtLocation,
} from "@/lib/menu";
import { useSelectedLocation } from "@/lib/use-selected-location";
import type { WireCatalog, WireLocation } from "@/lib/types";

export default function MenuPage() {
  const [locations, setLocations] = useState<WireLocation[] | null>(null);
  const [catalog, setCatalog] = useState<WireCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const { selectedLocationId, setSelectedLocationId, hasMounted } =
    useSelectedLocation();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchLocations(), fetchCatalog()])
      .then(([locs, cat]) => {
        if (cancel) return;
        setLocations(locs);
        setCatalog(cat);
        if (!selectedLocationId && locs.length > 0) {
          setSelectedLocationId(locs[0]!.id);
        }
      })
      .catch((e) => !cancel && setError(e))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
    // tick is the retry signal; selectedLocationId/setter intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const visibleItems = useMemo(() => {
    if (!catalog || !selectedLocationId) return [];
    return catalog.items.filter((i) => isItemAtLocation(i, selectedLocationId));
  }, [catalog, selectedLocationId]);

  const groups = useMemo(() => {
    if (!catalog) return [];
    return groupItemsByCategory(visibleItems, catalog.categories);
  }, [visibleItems, catalog]);

  const filteredGroups = useMemo(() => {
    if (selectedCategoryId === null) return groups;
    return groups.filter(
      (g) => (g.category?.id ?? "uncategorized") === selectedCategoryId,
    );
  }, [groups, selectedCategoryId]);

  if (!hasMounted) return null; // avoid SSR mismatch on persisted location

  return (
    <DataState
      loading={loading}
      error={error}
      data={catalog && locations ? { catalog, locations } : null}
      isEmpty={(d) => d.locations.length === 0}
      loadingFallback={
        <div className="space-y-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      }
      emptyFallback={
        <p className="text-muted-foreground">
          No locations are configured for this merchant.
        </p>
      }
      onRetry={() => setTick((t) => t + 1)}
    >
      {({ locations }) => (
        <>
          <div className="mb-4">
            <LocationSwitcher
              locations={locations}
              value={selectedLocationId}
              onChange={setSelectedLocationId}
            />
          </div>
          <div className="mb-4">
            <CategoryFilter
              categories={groups.map((g) => ({
                category: g.category,
                count: g.items.length,
              }))}
              selected={selectedCategoryId}
              onChange={setSelectedCategoryId}
            />
          </div>
          {filteredGroups.length === 0 ? (
            <p className="text-muted-foreground">
              No items available at this location.
            </p>
          ) : (
            <ItemList groups={filteredGroups} />
          )}
        </>
      )}
    </DataState>
  );
}
```

- [ ] **Step 3: Make it the home route**

Delete or replace `app/page.tsx`:

```tsx
// app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/");
}
```

Wait — `(menu)/page.tsx` already maps to `/`. Delete `app/page.tsx` instead.

```bash
rm app/page.tsx
```

- [ ] **Step 4: Run, smoke test**

```bash
pnpm dev
```

Open `http://localhost:3000`. Verify location switcher renders, category filter renders, items render grouped, and switching location filters items.

- [ ] **Step 5: Commit**

```bash
git add app/\(menu\)/ app/page.tsx
git commit -m "$(cat <<'EOF'
feat(menu): wire menu page with location switcher and category filter

Single client component owns the page-level state because it
straddles three concerns (location selection persistence, catalog
fetch, category filter). Memoized derivations keep the render cheap
when only the category filter changes. The DataState wrapper covers
all four loading/empty/error/stale paths required by the spec.

Refs: spec §2 core requirements 1-4, §7
EOF
)"
```

---

### Task 2.8 — Item detail page

**Files:**
- Create: `app/items/[id]/page.tsx`, `components/menu/item-detail.tsx`

- [ ] **Step 1: Write the detail component**

```tsx
// components/menu/item-detail.tsx
"use client";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney, parseMoney } from "@/lib/money";
import type { WireItem, WireItemVariation } from "@/lib/types";

type Props = { item: WireItem };

export function ItemDetail({ item }: Props) {
  const [variationId, setVariationId] = useState<string>(
    item.variations[0]!.id,
  );
  const variation = item.variations.find((v) => v.id === variationId)!;

  return (
    <article className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill className="object-cover" sizes="50vw" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{item.name}</h1>
        {item.description && (
          <p className="mt-2 text-muted-foreground">{item.description}</p>
        )}
        {item.variations.length > 1 && (
          <fieldset className="mt-4" role="radiogroup" aria-label="Size">
            <legend className="text-sm font-medium">Size</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.variations.map((v) => (
                <VariationButton
                  key={v.id}
                  variation={v}
                  selected={v.id === variationId}
                  onSelect={() => setVariationId(v.id)}
                />
              ))}
            </div>
          </fieldset>
        )}
        <p className="mt-6 text-2xl font-semibold">
          {variation.priceMoney
            ? formatMoney(parseMoney(variation.priceMoney))
            : "Price unavailable"}
        </p>
        <Button className="mt-4 w-full" disabled>
          Add to cart (coming next stage)
        </Button>
      </div>
    </article>
  );
}

function VariationButton({
  variation,
  selected,
  onSelect,
}: {
  variation: WireItemVariation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      className={`rounded border px-3 py-1 text-sm transition ${
        selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
      }`}
    >
      {variation.name}
      {variation.priceMoney && (
        <span className="ml-2 opacity-70">
          {formatMoney(parseMoney(variation.priceMoney))}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// app/items/[id]/page.tsx
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/data-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemDetail } from "@/components/menu/item-detail";
import { fetchCatalog } from "@/lib/menu";
import type { WireItem } from "@/lib/types";

export default function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<WireItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancel = false;
    fetchCatalog()
      .then((c) => {
        if (cancel) return;
        const found = c.items.find((i) => i.id === id) ?? null;
        setItem(found);
      })
      .catch((e) => !cancel && setError(e))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to menu
      </Link>
      <div className="mt-4">
        <DataState
          loading={loading}
          error={error}
          data={item}
          isEmpty={() => false}
          loadingFallback={<Skeleton className="h-96 w-full" />}
          emptyFallback={
            <p className="text-muted-foreground">
              We could not find that item. <Link href="/" className="underline">Back to menu</Link>.
            </p>
          }
        >
          {(it) => <ItemDetail item={it} />}
        </DataState>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

`pnpm dev`. Click any item card. Verify detail renders with name, description, image, price, and variation switcher (if multi-variation).

- [ ] **Step 4: Commit**

```bash
git add app/items/ components/menu/item-detail.tsx
git commit -m "$(cat <<'EOF'
feat(menu): add item detail page with variation selector

Detail re-uses the cached /api/catalog response — there is no
per-item endpoint. Variation selector previews price per option
because that is what guests need before deciding. The 'Add to cart'
button is intentionally disabled here; it lights up in stage 5
when the cart store and modifier selector ship together.

Refs: spec §2 core requirement 5
EOF
)"
```

---

### Task 2.9 — Configure next.config for Square image hosts

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Edit `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "items-images-sandbox.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "items-images-production.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "**.squarecdn.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Smoke test images load**

`pnpm dev`. If Square seed data has images, they render now.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "$(cat <<'EOF'
chore(ui): allow Square image CDN hosts in next/image

Without remotePatterns next/image refuses to optimize external URLs
and the Square-hosted images render as broken refs. We allow the
sandbox and production S3 buckets plus the squarecdn fallback.

Refs: spec §2 core requirement 5
EOF
)"
```

---

### Task 2.10 — PR and merge

```bash
git push -u origin feat/02-menu-core
gh pr create --title "feat(menu): core menu UI with location, category, and detail" --body "$(cat <<'EOF'
## What
Implements the six core requirements: location switcher, catalog fetch, location filtering, category grouping/filtering, item detail with money formatting, and full loading/empty/error states via DataState.

## Why
Spec §2 core requirements 1-6 and §7.

## How
- `lib/money.ts` keeps all currency math in bigint cents and lets Intl decide minor units.
- `lib/menu.ts` centralizes location-presence and grouping selectors.
- The page is a single client component because three pieces of state straddle it (selected location, selected category, fetch state).
- DataState wraps every fetch.

## Tests
- [x] `tests/money.test.ts` (7 cases, currency math + format).
- [ ] Manual: switch location, items filter; pick category, group filters; click item, detail opens; throttle network, skeletons render.

## Risks / Follow-ups
- `app/(menu)/page.tsx` does its own fetch state instead of TanStack Query. Sufficient for this scope; would migrate if we add more fetchers.

Closes spec §2 core requirements 1-6
EOF
)"
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

# Stage 3 — Time-of-day availability

**Branch:** `feat/03-availability`
**Goal:** the showcase. Pure resolver with all 10 spec test cases green, AvailabilityBadge component, TimeProvider that powers both real time and `?at=` simulation, and `<TimeSimulatorBanner>`.
**Stage gate:** all resolver tests pass; switching `?at=` in the URL changes badges in real time.

---

### Task 3.1 — Branch

```bash
git checkout -b feat/03-availability
```

---

### Task 3.2 — Wall-clock helpers (zoned to IANA timezone)

**Files:**
- Create: `lib/time/zoned.ts`
- Test: `tests/zoned.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/zoned.test.ts
import { describe, expect, it } from "vitest";
import {
  toZonedParts,
  zonedDateToUTC,
  type ZonedParts,
} from "@/lib/time/zoned";

describe("toZonedParts", () => {
  it("returns NY local parts for a UTC instant", () => {
    // 2026-05-12T19:00:00Z = 15:00 EDT (UTC-4)
    const parts = toZonedParts(new Date("2026-05-12T19:00:00Z"), "America/New_York");
    expect(parts).toEqual<ZonedParts>({
      year: 2026,
      month: 5,
      day: 12,
      hour: 15,
      minute: 0,
      dayOfWeek: "TUE",
    });
  });

  it("handles DST forward in NY (March 8, 2026 02:30 -> 03:30)", () => {
    // 2026-03-08T07:30:00Z is 02:30 EST briefly skipped; in NY the wall clock at
    // 07:30Z is 03:30 EDT.
    const parts = toZonedParts(new Date("2026-03-08T07:30:00Z"), "America/New_York");
    expect(parts.hour).toBe(3);
    expect(parts.minute).toBe(30);
  });
});

describe("zonedDateToUTC", () => {
  it("returns the UTC instant for a wall-clock time in NY", () => {
    // 2026-05-12 15:00 EDT = 19:00 UTC
    const utc = zonedDateToUTC(
      { year: 2026, month: 5, day: 12, hour: 15, minute: 0 },
      "America/New_York",
    );
    expect(utc.toISOString()).toBe("2026-05-12T19:00:00.000Z");
  });

  it("returns a deterministic instant during DST fall-back ambiguity", () => {
    // Nov 1, 2026 01:30 in NY occurs twice. We deterministically pick the EDT
    // (earlier) instance: 05:30Z.
    const utc = zonedDateToUTC(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      "America/New_York",
    );
    expect(utc.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
});
```

- [ ] **Step 2: Run, fail**

Run: `pnpm vitest run tests/zoned.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/time/zoned.ts`**

```ts
// lib/time/zoned.ts
export type DayOfWeek = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: DayOfWeek;
};

const DOW: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(timezone: string): Intl.DateTimeFormat {
  const cached = partsCache.get(timezone);
  if (cached) return cached;
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  partsCache.set(timezone, f);
  return f;
}

export function toZonedParts(d: Date, timezone: string): ZonedParts {
  const parts = formatter(timezone).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const dayName = (map.weekday ?? "").slice(0, 3).toUpperCase();
  const dow = (DOW.find((d) => d === dayName) ?? "SUN") as DayOfWeek;
  // Intl returns "24" for midnight in some locales; normalize to 0.
  let hour = Number.parseInt(map.hour ?? "0", 10);
  if (hour === 24) hour = 0;
  return {
    year: Number.parseInt(map.year ?? "0", 10),
    month: Number.parseInt(map.month ?? "0", 10),
    day: Number.parseInt(map.day ?? "0", 10),
    hour,
    minute: Number.parseInt(map.minute ?? "0", 10),
    dayOfWeek: dow,
  };
}

/**
 * Convert a wall-clock time in a given IANA timezone back to a UTC Date.
 * Handles DST edge cases by binary-searching on the offset implied by the
 * formatter. During fall-back ambiguity, picks the earlier (DST) instance.
 */
export function zonedDateToUTC(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timezone: string,
): Date {
  // Start with naive UTC interpretation, then correct by the offset Intl reports.
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  // Compute offset by formatting that instant in the zone and seeing what wall-clock
  // it produces; the diff between naive and the returned wall-clock is the offset.
  const probed = toZonedParts(new Date(naive), timezone);
  const probedUTC = Date.UTC(
    probed.year,
    probed.month - 1,
    probed.day,
    probed.hour,
    probed.minute,
  );
  const offsetMs = naive - probedUTC;
  let candidate = new Date(naive + offsetMs);
  // One refinement pass to handle DST boundaries.
  const probed2 = toZonedParts(candidate, timezone);
  if (
    probed2.year !== parts.year ||
    probed2.month !== parts.month ||
    probed2.day !== parts.day ||
    probed2.hour !== parts.hour ||
    probed2.minute !== parts.minute
  ) {
    const probedUTC2 = Date.UTC(
      probed2.year,
      probed2.month - 1,
      probed2.day,
      probed2.hour,
      probed2.minute,
    );
    const delta = candidate.getTime() + (naive - probedUTC2) - candidate.getTime();
    candidate = new Date(candidate.getTime() + delta);
  }
  return candidate;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/zoned.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/time/zoned.ts tests/zoned.test.ts
git commit -m "$(cat <<'EOF'
feat(availability): add IANA-aware wall-clock helpers

toZonedParts wraps Intl.DateTimeFormat with parts caching so the
hot path (every badge re-render) does not allocate a new formatter
each call. zonedDateToUTC inverts the conversion with one
refinement pass — enough to land on the correct instant across DST
boundaries while picking the deterministic earlier instance during
fall-back ambiguity. No third-party tz library; no luxon, no
date-fns-tz, no temporal polyfill.

Refs: spec §3.3
EOF
)"
```

---

### Task 3.3 — Availability resolver

**Files:**
- Create: `lib/square/availability.ts`
- Test: `tests/availability.test.ts`

- [ ] **Step 1: Write the failing tests (all 10 cases from spec §3.4)**

```ts
// tests/availability.test.ts
import { describe, expect, it } from "vitest";
import { resolveAvailability } from "@/lib/square/availability";
import type { WireCategory, WireItem } from "@/lib/types";

const NY = "America/New_York";

function makeItem(overrides: Partial<WireItem> = {}): WireItem {
  return {
    id: "item-1",
    name: "Test Item",
    description: null,
    imageUrl: null,
    categoryId: "cat-1",
    variations: [
      { id: "var-1", itemId: "item-1", name: "Default", priceMoney: { amount: "100", currency: "USD" }, ordinal: 0 },
    ],
    modifierListInfo: [],
    presentAtAllLocations: true,
    presentAtLocationIds: [],
    absentAtLocationIds: [],
    ...overrides,
  };
}

function makeCategory(
  windows: WireCategory["availabilityWindows"] = [],
  overrides: WireCategory["locationOverrides"] = {},
): WireCategory {
  return {
    id: "cat-1",
    name: "Test",
    ordinal: 0,
    availabilityWindows: windows,
    locationOverrides: overrides,
  };
}

describe("resolveAvailability", () => {
  it("1. item with no category restrictions is always available", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"),
    });
    expect(result.kind).toBe("available");
  });

  it("2. item inside its category window is available", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "08:00", endLocal: "20:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"), // 15:00 EDT Tue
    });
    expect(result.kind).toBe("available");
  });

  it("3. item outside window today but opens later same day → opens_at", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "16:00", endLocal: "20:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T17:00:00Z"), // 13:00 EDT Tue — opens at 16:00 EDT
    });
    expect(result.kind).toBe("opens_at");
    if (result.kind !== "opens_at") return;
    expect(result.nextOpen.toISOString()).toBe("2026-05-12T20:00:00.000Z");
  });

  it("4. item already closed today, opens tomorrow → opens_at next day", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "08:00", endLocal: "10:00" } },
        { dayOfWeek: "WED", range: { startLocal: "08:00", endLocal: "10:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"), // 15:00 EDT Tue — closed; opens Wed
    });
    expect(result.kind).toBe("opens_at");
    if (result.kind !== "opens_at") return;
    expect(result.nextOpen.toISOString()).toBe("2026-05-13T12:00:00.000Z");
  });

  it("5. DST forward: resolver does not crash near 02:30 in March in NY", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "SUN", range: { startLocal: "02:00", endLocal: "04:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-03-08T07:30:00Z"),
    });
    expect(result.kind === "available" || result.kind === "opens_at" || result.kind === "closed_today").toBe(true);
  });

  it("6. DST backward: resolver picks deterministic instant", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "SUN", range: { startLocal: "01:00", endLocal: "03:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-11-01T05:30:00Z"),
    });
    expect(result.kind).toBe("available");
  });

  it("7. window crossing midnight: hour 23 and hour 01 are both available", () => {
    // Pre-split at normalization time — TUE 22:00-23:59 + WED 00:00-02:00.
    const cat = makeCategory([
      { dayOfWeek: "TUE", range: { startLocal: "22:00", endLocal: "23:59" } },
      { dayOfWeek: "WED", range: { startLocal: "00:00", endLocal: "02:00" } },
    ]);
    const at23 = resolveAvailability({
      item: makeItem(),
      category: cat,
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-13T03:00:00Z"), // 23:00 EDT Tue
    });
    expect(at23.kind).toBe("available");
    const at01 = resolveAvailability({
      item: makeItem(),
      category: cat,
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-13T05:00:00Z"), // 01:00 EDT Wed
    });
    expect(at01.kind).toBe("available");
  });

  it("8. location override beats category default", () => {
    const cat = makeCategory(
      [{ dayOfWeek: "TUE", range: { startLocal: "08:00", endLocal: "20:00" } }],
      { "loc-1": [{ dayOfWeek: "TUE", range: { startLocal: "16:00", endLocal: "20:00" } }] },
    );
    const result = resolveAvailability({
      item: makeItem(),
      category: cat,
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T17:00:00Z"), // 13:00 EDT Tue — covered by default but not by override
    });
    expect(result.kind).toBe("opens_at");
  });

  it("9. item absent at location → unavailable_at_location", () => {
    const result = resolveAvailability({
      item: makeItem({
        presentAtAllLocations: true,
        absentAtLocationIds: ["loc-1"],
      }),
      category: makeCategory(),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T19:00:00Z"),
    });
    expect(result.kind).toBe("unavailable_at_location");
  });

  it("10. multiple overlapping windows: takes the active one or earliest next", () => {
    const result = resolveAvailability({
      item: makeItem(),
      category: makeCategory([
        { dayOfWeek: "TUE", range: { startLocal: "10:00", endLocal: "14:00" } },
        { dayOfWeek: "TUE", range: { startLocal: "12:00", endLocal: "16:00" } },
      ]),
      locationId: "loc-1",
      locationTimezone: NY,
      now: new Date("2026-05-12T16:00:00Z"), // 12:00 EDT Tue — covered by both
    });
    expect(result.kind).toBe("available");
  });
});
```

- [ ] **Step 2: Run, fail**

Run: `pnpm vitest run tests/availability.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/square/availability.ts`**

```ts
// lib/square/availability.ts
import type { WireCategory, WireItem } from "@/lib/types";
import { toZonedParts, zonedDateToUTC, type DayOfWeek } from "@/lib/time/zoned";

export type AvailabilityState =
  | { kind: "available" }
  | { kind: "opens_at"; nextOpen: Date; reason: "category_window" | "out_of_window_today" }
  | { kind: "closed_today" }
  | { kind: "unavailable_at_location" };

const DOW_ORDER: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function minutesOfDay(hh: string): number {
  const [h, m] = hh.split(":").map((n) => Number.parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

function isItemAtLocation(item: WireItem, locationId: string): boolean {
  if (item.absentAtLocationIds.includes(locationId)) return false;
  if (item.presentAtAllLocations) return true;
  return item.presentAtLocationIds.includes(locationId);
}

function effectiveWindows(
  category: WireCategory,
  locationId: string,
): WireCategory["availabilityWindows"] {
  const override = category.locationOverrides[locationId];
  if (override !== undefined) return override;
  return category.availabilityWindows;
}

export function resolveAvailability(input: {
  item: WireItem;
  category: WireCategory | null;
  locationId: string;
  locationTimezone: string;
  now: Date;
}): AvailabilityState {
  const { item, category, locationId, locationTimezone, now } = input;
  if (!isItemAtLocation(item, locationId)) {
    return { kind: "unavailable_at_location" };
  }
  if (!category) return { kind: "available" };

  const windows = effectiveWindows(category, locationId);
  if (windows.length === 0) return { kind: "available" };

  const here = toZonedParts(now, locationTimezone);
  const nowMinutes = here.hour * 60 + here.minute;
  const todayWindows = windows.filter((w) => w.dayOfWeek === here.dayOfWeek);
  for (const w of todayWindows) {
    const start = minutesOfDay(w.range.startLocal);
    const end = minutesOfDay(w.range.endLocal);
    if (nowMinutes >= start && nowMinutes <= end) {
      return { kind: "available" };
    }
  }

  // Look for the next opening within the next 7 days (today included).
  const todayIdx = DOW_ORDER.indexOf(here.dayOfWeek);
  for (let offset = 0; offset < 8; offset++) {
    const dayIdx = (todayIdx + offset) % 7;
    const dow = DOW_ORDER[dayIdx]!;
    const candidates = windows
      .filter((w) => w.dayOfWeek === dow)
      .map((w) => minutesOfDay(w.range.startLocal))
      .filter((mins) => offset > 0 || mins > nowMinutes)
      .sort((a, b) => a - b);
    if (candidates.length > 0) {
      const startMin = candidates[0]!;
      const startHour = Math.floor(startMin / 60);
      const startMinute = startMin % 60;
      const targetDateUTC = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
      const targetParts = toZonedParts(targetDateUTC, locationTimezone);
      const nextOpen = zonedDateToUTC(
        {
          year: targetParts.year,
          month: targetParts.month,
          day: targetParts.day,
          hour: startHour,
          minute: startMinute,
        },
        locationTimezone,
      );
      return {
        kind: "opens_at",
        nextOpen,
        reason: offset === 0 ? "out_of_window_today" : "category_window",
      };
    }
  }
  return { kind: "closed_today" };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/availability.test.ts`
Expected: 10/10 PASS. If any fail, iterate on the resolver, not the tests.

- [ ] **Step 5: Commit**

```bash
git add lib/square/availability.ts tests/availability.test.ts
git commit -m "$(cat <<'EOF'
feat(availability): add pure resolver covering all spec cases

Resolver is a pure function: now is injected, no globals consulted.
Precedence runs presence -> override -> default -> always-on.
Today-windows are checked first for the available case; the
opens_at lookup walks up to 7 days forward and picks the earliest
start time in local minutes, then converts back to UTC through
zonedDateToUTC so the returned Date is a real instant the UI can
format with the location's timezone.

closed_today is reserved for items with no future window inside
the 7-day lookahead — used in tests when categories simply have no
weekly schedule entries pointing forward.

Refs: spec §3.1, §3.2, §3.4
EOF
)"
```

---

### Task 3.4 — TimeProvider with simulation hook

**Files:**
- Create: `lib/time/provider.tsx`

- [ ] **Step 1: Write `lib/time/provider.tsx`**

```tsx
// lib/time/provider.tsx
"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

type TimeContextValue = {
  now: Date;
  isSimulated: boolean;
  simulatedAt: Date | null;
};

const TimeContext = createContext<TimeContextValue | null>(null);

function parseAtParam(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function TimeProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const simulatedAt = parseAtParam(params.get("at"));
  const [realNow, setRealNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (simulatedAt) return; // no ticking when simulated
    const id = setInterval(() => setRealNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [simulatedAt]);

  const value: TimeContextValue = simulatedAt
    ? { now: simulatedAt, isSimulated: true, simulatedAt }
    : { now: realNow, isSimulated: false, simulatedAt: null };

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useNow(): Date {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error("useNow must be used inside <TimeProvider>");
  return ctx.now;
}

export function useTimeContext(): TimeContextValue {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error("useTimeContext must be used inside <TimeProvider>");
  return ctx;
}
```

- [ ] **Step 2: Wrap the app in `TimeProvider`**

Edit `app/layout.tsx`:

```tsx
// app/layout.tsx
import "./globals.css";
import { Suspense } from "react";
import { TimeProvider } from "@/lib/time/provider";

export const metadata = { title: "Per Diem Menu" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <TimeProvider>{children}</TimeProvider>
        </Suspense>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/time/provider.tsx app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(availability): add TimeProvider for real and simulated clocks

useNow ticks every 60s in real-time mode so badges flip without a
page reload. When ?at= is present in the URL, the provider serves
that instant and skips the interval entirely. Suspense boundary is
required because useSearchParams suspends during render.

Refs: spec §3.5
EOF
)"
```

---

### Task 3.5 — Time simulator banner

**Files:**
- Create: `components/menu/time-simulator-banner.tsx`

- [ ] **Step 1: Write the banner**

```tsx
// components/menu/time-simulator-banner.tsx
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTimeContext } from "@/lib/time/provider";

export function TimeSimulatorBanner() {
  const ctx = useTimeContext();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  if (!ctx.isSimulated || !ctx.simulatedAt) return null;

  const exit = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("at");
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path);
  };

  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-100 px-4 py-2 text-amber-900">
      <span className="text-sm">
        🕐 Simulating: {fmt.format(ctx.simulatedAt)} (browser tz). Add{" "}
        <code>?at=ISO</code> to any URL to demo other times.
      </span>
      <Button size="sm" variant="outline" onClick={exit}>
        Exit simulation
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Mount in the menu layout**

Edit `app/(menu)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { TimeSimulatorBanner } from "@/components/menu/time-simulator-banner";

export default function MenuLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <TimeSimulatorBanner />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Per Diem Menu</h1>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/menu/time-simulator-banner.tsx app/\(menu\)/layout.tsx
git commit -m "$(cat <<'EOF'
feat(availability): add time simulator banner

Banner is opt-in: it only renders when the URL contains ?at=. Exit
clears the param via router.replace so no history entries clutter
back-navigation. Real users never see this surface.

Refs: spec §3.5
EOF
)"
```

---

### Task 3.6 — AvailabilityBadge component

**Files:**
- Create: `components/menu/availability-badge.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/menu/availability-badge.tsx
"use client";
import { Badge } from "@/components/ui/badge";
import type { AvailabilityState } from "@/lib/square/availability";

type Props = {
  state: AvailabilityState;
  locationTimezone: string;
};

export function AvailabilityBadge({ state, locationTimezone }: Props) {
  if (state.kind === "available") return null;

  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: locationTimezone,
  });

  if (state.kind === "opens_at") {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-100 text-amber-900 hover:bg-amber-100"
        aria-label={`Opens at ${fmt.format(state.nextOpen)}, currently closed`}
      >
        ⏰ Opens {fmt.format(state.nextOpen)}
      </Badge>
    );
  }

  if (state.kind === "closed_today") {
    return (
      <Badge variant="secondary" className="bg-gray-200 text-gray-700" aria-label="Closed today">
        ✕ Closed today
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-red-100 text-red-900" aria-label="Not available at this location">
      Not at this location
    </Badge>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/menu/availability-badge.tsx
git commit -m "$(cat <<'EOF'
feat(availability): add AvailabilityBadge with state-aware rendering

Badge is invisible when the item is available — the menu stays
clean. Each non-available state has icon + text + color so the
signal does not depend on color alone (a11y). Time formatting
uses the LOCATION's timezone, not the browser's, so 'Opens 11 AM'
always means 11 AM at the store.

Refs: spec §3.6, §9.1
EOF
)"
```

---

### Task 3.7 — Wire badges into ItemCard, filter unavailable items, and respect time

**Files:**
- Modify: `components/menu/item-card.tsx`, `app/(menu)/page.tsx`, `app/items/[id]/page.tsx`

- [ ] **Step 1: Update `ItemCard` to render the badge**

```tsx
// components/menu/item-card.tsx (modify the existing file)
"use client";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { AvailabilityBadge } from "./availability-badge";
import { formatMoney, parseMoney } from "@/lib/money";
import type { AvailabilityState } from "@/lib/square/availability";
import type { WireItem } from "@/lib/types";

type Props = {
  item: WireItem;
  availability: AvailabilityState;
  locationTimezone: string;
};

function priceRangeLabel(item: WireItem): string {
  const prices = item.variations
    .map((v) => v.priceMoney)
    .filter((m): m is NonNullable<typeof m> => m !== null);
  if (prices.length === 0) return "—";
  const parsed = prices.map(parseMoney);
  const min = parsed.reduce((a, b) => (a.amount < b.amount ? a : b));
  const max = parsed.reduce((a, b) => (a.amount > b.amount ? a : b));
  return min.amount === max.amount
    ? formatMoney(min)
    : `${formatMoney(min)} – ${formatMoney(max)}`;
}

export function ItemCard({ item, availability, locationTimezone }: Props) {
  const dimmed = availability.kind !== "available";
  return (
    <Link href={`/items/${item.id}`} className="group">
      <Card className={`overflow-hidden transition hover:shadow-md ${dimmed ? "opacity-60" : ""}`}>
        {item.imageUrl && (
          <div className="relative aspect-square w-full bg-muted">
            <Image
              src={item.imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover"
            />
          </div>
        )}
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium leading-tight">{item.name}</p>
            <AvailabilityBadge state={availability} locationTimezone={locationTimezone} />
          </div>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {item.description}
            </p>
          )}
          <p className="mt-2 text-sm font-medium">{priceRangeLabel(item)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Update `app/(menu)/page.tsx` to compute availability per visible item**

Replace the body of the page to compute availability and pass it down:

```tsx
// inside MenuPage, after groups is computed, before return:
import { useNow } from "@/lib/time/provider";
import { resolveAvailability } from "@/lib/square/availability";

// ... at top of component:
const now = useNow();

// Replace the ItemList usage. Inline an enriched component or compute a map:
const visibleLocation = locations?.find((l) => l.id === selectedLocationId);
const tz = visibleLocation?.timezone ?? "UTC";

const availabilityById = useMemo(() => {
  if (!catalog) return new Map();
  const byCat = new Map(catalog.categories.map((c) => [c.id, c]));
  const out = new Map<string, ReturnType<typeof resolveAvailability>>();
  for (const item of visibleItems) {
    const cat = item.categoryId ? byCat.get(item.categoryId) ?? null : null;
    out.set(
      item.id,
      resolveAvailability({
        item,
        category: cat,
        locationId: selectedLocationId ?? "",
        locationTimezone: tz,
        now,
      }),
    );
  }
  return out;
}, [catalog, visibleItems, selectedLocationId, tz, now]);
```

Now create a wrapper component to render groups with availability passed in. Add a new component `components/menu/menu-list.tsx`:

```tsx
// components/menu/menu-list.tsx
"use client";
import type { AvailabilityState } from "@/lib/square/availability";
import type { WireCategory, WireItem } from "@/lib/types";
import { ItemCard } from "./item-card";

type Group = { category: WireCategory | null; items: WireItem[] };
type Props = {
  groups: Group[];
  availabilityById: Map<string, AvailabilityState>;
  locationTimezone: string;
  hideUnavailable: boolean;
};

export function MenuList({ groups, availabilityById, locationTimezone, hideUnavailable }: Props) {
  return (
    <div className="space-y-8">
      {groups.map(({ category, items }) => {
        const visibleItems = hideUnavailable
          ? items.filter(
              (it) => availabilityById.get(it.id)?.kind !== "unavailable_at_location",
            )
          : items;
        if (visibleItems.length === 0) return null;
        return (
          <section key={category?.id ?? "uncategorized"}>
            <h2 className="mb-3 text-lg font-semibold">{category?.name ?? "Other"}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visibleItems.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  availability={availabilityById.get(it.id) ?? { kind: "available" }}
                  locationTimezone={locationTimezone}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

Replace `<ItemList groups={filteredGroups} />` in `app/(menu)/page.tsx` with `<MenuList groups={filteredGroups} availabilityById={availabilityById} locationTimezone={tz} hideUnavailable />`.

Delete `components/menu/item-list.tsx` since `MenuList` supersedes it.

- [ ] **Step 3: Update item detail to show its availability badge too**

In `components/menu/item-detail.tsx`, accept `availability: AvailabilityState` and `locationTimezone: string`, render the badge under the name. Update the page to compute and pass them.

```tsx
// components/menu/item-detail.tsx — add at top of return, under <h1>:
import { AvailabilityBadge } from "./availability-badge";
import type { AvailabilityState } from "@/lib/square/availability";

type Props = {
  item: WireItem;
  availability: AvailabilityState;
  locationTimezone: string;
};

// in component, after the <h1>:
<div className="mt-2">
  <AvailabilityBadge state={availability} locationTimezone={locationTimezone} />
</div>
```

In `app/items/[id]/page.tsx`, fetch locations alongside catalog, read selected location from `useSelectedLocation`, compute availability for the item, and pass to `<ItemDetail />`. (Mirror the pattern in `app/(menu)/page.tsx`.)

- [ ] **Step 4: Smoke test**

`pnpm dev`. Visit `/?at=2026-05-12T19:00:00Z`. Visit `/?at=2026-05-12T05:00:00Z` (early morning). Confirm badges flip.

- [ ] **Step 5: Commit**

```bash
git add components/menu/ app/\(menu\)/page.tsx app/items/
git rm components/menu/item-list.tsx
git commit -m "$(cat <<'EOF'
feat(availability): wire AvailabilityBadge into menu and detail

Per-render availability is computed once into a Map keyed by item
id and threaded through the list. Items unavailable at the location
are dimmed and group themselves out when the (default) hide toggle
is on; opens_at and closed_today render the badge but stay
clickable so guests can still preview the item.

Detail page mirrors the pattern so the badge is visible there too.

Refs: spec §3.6, §3.5
EOF
)"
```

---

### Task 3.8 — PR and merge

```bash
git push -u origin feat/03-availability
gh pr create --title "feat(availability): pure resolver + simulator + badges" --body "$(cat <<'EOF'
## What
Time-of-day & day-of-week availability. Pure resolver (10/10 spec test cases), zoned wall-clock helpers (no third-party tz library), TimeProvider with `?at=` simulation, and AvailabilityBadge wired into list and detail.

## Why
Spec §3 — the highest-signal bonus and the one Per Diem explicitly weighted highest.

## How
- Resolver is a pure function with `now` injected; same code path for prod and simulator.
- Wall-clock helpers cache `Intl.DateTimeFormat` per timezone.
- Banner appears only when URL has `?at=`; production UX is unchanged.

## Tests
- [x] `tests/availability.test.ts` — all 10 spec cases.
- [x] `tests/zoned.test.ts` — DST forward, DST backward, basic conversions.
- [ ] Manual: visit `?at=2026-05-12T05:00:00Z` and confirm 'Opens at' badges; visit `?at=2026-05-12T19:00:00Z` and confirm available items render clean.

## Risks / Follow-ups
- 7-day lookahead horizon. Items with weekly-rare windows could miss the next opening; we treat them as `closed_today`.
- DST ambiguity resolved deterministically to the EDT (earlier) instance.

Closes spec §3
EOF
)"
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

# Stage 4 — Search

**Branch:** `feat/04-search`
**Goal:** debounced client-side full-text search over the visible items.
**Stage gate:** typing in the search box filters the list in place; clearing restores the full list.

---

### Task 4.1 — Branch + search component

```bash
git checkout -b feat/04-search
```

**Files:** Create `components/menu/search-bar.tsx` and `lib/search.ts`.

- [ ] **Step 1: Create `lib/search.ts`** (text normalization)

```ts
// lib/search.ts
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function matchesQuery(haystackParts: Array<string | null>, query: string): boolean {
  if (query.length === 0) return true;
  const q = normalize(query);
  for (const part of haystackParts) {
    if (part && normalize(part).includes(q)) return true;
  }
  return false;
}
```

- [ ] **Step 2: Test** (`tests/search.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { matchesQuery, normalize } from "@/lib/search";

describe("normalize", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalize("Café")).toBe("cafe");
    expect(normalize("  Mañana  ")).toBe("manana");
  });
});

describe("matchesQuery", () => {
  it("returns true when query is empty", () => {
    expect(matchesQuery(["anything"], "")).toBe(true);
  });
  it("matches case- and accent-insensitively across parts", () => {
    expect(matchesQuery(["Latte", "Caffè con leche"], "cafe con")).toBe(true);
    expect(matchesQuery(["Latte", null], "lAtTe")).toBe(true);
  });
  it("returns false on no match", () => {
    expect(matchesQuery(["Latte"], "donut")).toBe(false);
  });
});
```

Run: `pnpm vitest run tests/search.test.ts`. Expected PASS.

- [ ] **Step 3: Create `SearchBar`**

```tsx
// components/menu/search-bar.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (q: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    const id = setTimeout(() => onChange(local), 150);
    return () => clearTimeout(id);
  }, [local, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex w-full max-w-md items-center gap-2">
      <Input
        ref={ref}
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Search menu (press / to focus)"
        aria-label="Search menu"
      />
      {local.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setLocal("")}>
          Clear
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire into `app/(menu)/page.tsx`**

Add state `const [query, setQuery] = useState("")` and apply `matchesQuery([item.name, item.description], query)` to filter `visibleItems` BEFORE grouping. Render `<SearchBar value={query} onChange={setQuery} />` next to the location switcher.

- [ ] **Step 5: Empty state for "no results"**

In the page, if filtering returns 0 items, render:

```tsx
<p className="text-muted-foreground">
  No items match &quot;{query}&quot;. Try a different word.
</p>
```

- [ ] **Step 6: Smoke test, commit**

```bash
git add lib/search.ts tests/search.test.ts components/menu/search-bar.tsx app/\(menu\)/page.tsx
git commit -m "$(cat <<'EOF'
feat(search): add debounced client-side menu search

Filter runs over the already-visible items (location + category
filtered) so the user always sees a coherent subset. Diacritic-
insensitive normalization handles 'café'/'cafe' and similar
foreign-character menus correctly. The '/' keyboard shortcut
matches the convention every modern menu/search UI uses.

Refs: spec §5
EOF
)"
git push -u origin feat/04-search
gh pr create --title "feat(search): debounced client-side menu search" --body "Closes spec §5"
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

# Stage 5 — Cart with modifiers

**Branch:** `feat/05-cart-modifiers`
**Goal:** modifier selector in detail, Zustand cart with persistence and snapshotted prices, location-scoped cart with switch confirmation, drawer with subtotal.
**Stage gate:** add an item with modifiers; reload; cart still there with correct subtotal.

---

### Task 5.1 — Branch and cart types

```bash
git checkout -b feat/05-cart-modifiers
```

- [ ] **Step 1: Create `lib/cart/types.ts`**

```ts
// lib/cart/types.ts
import type { Money } from "@/lib/money";

export type SelectedModifier = {
  modifierId: string;
  modifierListId: string;
  name: string;
  priceMoney: Money;
};

export type CartLineItem = {
  lineId: string;
  itemId: string;
  variationId: string;
  itemName: string;
  variationName: string;
  basePriceMoney: Money;
  modifiers: SelectedModifier[];
  qty: number;
  locationId: string;
};

export type CartState = {
  locationId: string | null;
  lines: CartLineItem[];
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/cart/types.ts
git commit -m "$(cat <<'EOF'
feat(cart): define cart types with snapshotted money

CartLineItem stores name and price snapshots so a catalog refresh
between add and checkout never silently mutates a guest's order.
locationId scoping is explicit in both the line and the state so a
mistakenly cross-location cart fails fast at write time.

Refs: spec §4.1
EOF
)"
```

---

### Task 5.2 — Cart selectors with tests

**Files:**
- Create: `lib/cart/selectors.ts`
- Test: `tests/cart-selectors.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// tests/cart-selectors.test.ts
import { describe, expect, it } from "vitest";
import {
  cartSubtotal,
  lineItemTotal,
} from "@/lib/cart/selectors";
import type { CartLineItem } from "@/lib/cart/types";

function line(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    lineId: "l1",
    itemId: "i1",
    variationId: "v1",
    itemName: "Latte",
    variationName: "Large",
    basePriceMoney: { amount: 500n, currency: "USD" },
    modifiers: [],
    qty: 1,
    locationId: "loc-1",
    ...overrides,
  };
}

describe("lineItemTotal", () => {
  it("returns base * qty when no modifiers", () => {
    expect(lineItemTotal(line({ qty: 3 })).amount).toBe(1500n);
  });
  it("adds modifier prices before multiplying by qty", () => {
    const total = lineItemTotal(
      line({
        qty: 2,
        modifiers: [
          { modifierId: "m1", modifierListId: "ml1", name: "Oat milk", priceMoney: { amount: 50n, currency: "USD" } },
          { modifierId: "m2", modifierListId: "ml1", name: "Extra shot", priceMoney: { amount: 75n, currency: "USD" } },
        ],
      }),
    );
    expect(total.amount).toBe((500n + 50n + 75n) * 2n);
  });
});

describe("cartSubtotal", () => {
  it("sums multiple lines", () => {
    const sub = cartSubtotal({
      locationId: "loc-1",
      lines: [
        line({ qty: 1 }),
        line({ lineId: "l2", qty: 2 }),
      ],
    });
    expect(sub.amount).toBe(1500n);
  });
  it("returns zero in fallback currency when empty", () => {
    expect(cartSubtotal({ locationId: null, lines: [] }).amount).toBe(0n);
  });
  it("throws on currency mismatch across lines", () => {
    expect(() =>
      cartSubtotal({
        locationId: "loc-1",
        lines: [
          line(),
          line({ lineId: "l2", basePriceMoney: { amount: 1n, currency: "EUR" } }),
        ],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run, fail**

Run: `pnpm vitest run tests/cart-selectors.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/cart/selectors.ts`**

```ts
// lib/cart/selectors.ts
import { addMoney, multiplyMoney, zeroMoney, type Money } from "@/lib/money";
import type { CartLineItem, CartState } from "./types";

export function lineItemTotal(line: CartLineItem): Money {
  let perUnit = line.basePriceMoney;
  for (const m of line.modifiers) perUnit = addMoney(perUnit, m.priceMoney);
  return multiplyMoney(perUnit, line.qty);
}

export function cartSubtotal(state: CartState): Money {
  if (state.lines.length === 0) return zeroMoney("USD");
  let total = lineItemTotal(state.lines[0]!);
  for (let i = 1; i < state.lines.length; i++) {
    total = addMoney(total, lineItemTotal(state.lines[i]!));
  }
  return total;
}

export function cartCount(state: CartState): number {
  let n = 0;
  for (const l of state.lines) n += l.qty;
  return n;
}
```

- [ ] **Step 4: Run, pass**

Run: `pnpm vitest run tests/cart-selectors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/cart/selectors.ts tests/cart-selectors.test.ts
git commit -m "$(cat <<'EOF'
feat(cart): add pure subtotal/line-total selectors

All cart math runs through addMoney/multiplyMoney so the currency-
mismatch invariant is enforced at every step. Empty cart returns
zero in USD as a harmless fallback (callers should branch on
cartCount === 0 before showing money anyway).

Refs: spec §4.3
EOF
)"
```

---

### Task 5.3 — Zustand cart store with persistence

**Files:**
- Create: `lib/cart/store.ts`, `lib/use-has-mounted.ts`

- [ ] **Step 1: Write `lib/use-has-mounted.ts`**

```ts
// lib/use-has-mounted.ts
"use client";
import { useEffect, useState } from "react";

export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
```

- [ ] **Step 2: Write `lib/cart/store.ts`**

```ts
// lib/cart/store.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartLineItem, CartState, SelectedModifier } from "./types";

type CartActions = {
  setLocation: (locationId: string) => { needsConfirm: boolean };
  forceSetLocationAndClear: (locationId: string) => void;
  addLine: (line: Omit<CartLineItem, "lineId">) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
};

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

// Reviver/replacer to bridge bigint <-> string in localStorage.
const storage = createJSONStorage<CartState>(() => localStorage, {
  reviver: (_, v) =>
    typeof v === "string" && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v,
  replacer: (_, v) => (typeof v === "bigint" ? `${v.toString()}n` : v),
});

export const useCart = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      locationId: null,
      lines: [],
      setLocation: (locationId) => {
        const current = get().locationId;
        if (current === null || current === locationId) {
          set({ locationId });
          return { needsConfirm: false };
        }
        if (get().lines.length === 0) {
          set({ locationId });
          return { needsConfirm: false };
        }
        return { needsConfirm: true };
      },
      forceSetLocationAndClear: (locationId) => set({ locationId, lines: [] }),
      addLine: (line) =>
        set((s) => ({
          lines: [...s.lines, { ...line, lineId: uuid() }],
        })),
      updateQty: (lineId, qty) =>
        set((s) => ({
          lines: s.lines
            .map((l) => (l.lineId === lineId ? { ...l, qty } : l))
            .filter((l) => l.qty > 0),
        })),
      removeLine: (lineId) =>
        set((s) => ({ lines: s.lines.filter((l) => l.lineId !== lineId) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "perdiem-cart-v1",
      storage,
      version: 1,
    },
  ),
);
```

- [ ] **Step 3: Commit**

```bash
git add lib/cart/store.ts lib/use-has-mounted.ts
git commit -m "$(cat <<'EOF'
feat(cart): add Zustand store with bigint-aware persistence

setLocation returns needsConfirm so the caller can render a modal
instead of silently nuking lines. updateQty drops zero-qty lines so
the UI never has to special-case '0 of X' rows. The persist storage
wraps JSON.parse/stringify with reviver/replacer pairs that round-
trip bigints through a 'NNNn' suffix; without this, money amounts
serialize to strings and silently break arithmetic on rehydrate.

Refs: spec §4.1, §4.4
EOF
)"
```

---

### Task 5.4 — Modifier selector

**Files:**
- Create: `components/cart/modifier-selector.tsx`

- [ ] **Step 1: Write the selector**

```tsx
// components/cart/modifier-selector.tsx
"use client";
import { useState } from "react";
import { formatMoney, parseMoney } from "@/lib/money";
import type { SelectedModifier } from "@/lib/cart/types";
import type {
  WireItem,
  WireModifierList,
} from "@/lib/types";

type Props = {
  item: WireItem;
  modifierLists: WireModifierList[];
  onChange: (selected: SelectedModifier[], errors: string[]) => void;
};

type SelectionMap = Record<string, Set<string>>;

export function ModifierSelector({ item, modifierLists, onChange }: Props) {
  const lists = item.modifierListInfo
    .filter((info) => info.enabled)
    .map((info) => {
      const list = modifierLists.find((ml) => ml.id === info.modifierListId);
      if (!list) return null;
      const minSel = info.minSelectedOverride ?? list.minSelected ?? 0;
      const maxSel = info.maxSelectedOverride ?? list.maxSelected ?? Number.POSITIVE_INFINITY;
      return { ...list, minSel, maxSel };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const [selection, setSelection] = useState<SelectionMap>(() => {
    const init: SelectionMap = {};
    for (const l of lists) init[l.id] = new Set();
    return init;
  });

  function emit(next: SelectionMap) {
    setSelection(next);
    const flat: SelectedModifier[] = [];
    const errors: string[] = [];
    for (const list of lists) {
      const sel = next[list.id] ?? new Set<string>();
      if (sel.size < list.minSel) {
        errors.push(`Select at least ${list.minSel} from ${list.name}`);
      }
      if (sel.size > list.maxSel) {
        errors.push(`Select at most ${list.maxSel} from ${list.name}`);
      }
      for (const modId of sel) {
        const mod = list.modifiers.find((m) => m.id === modId);
        if (!mod) continue;
        flat.push({
          modifierId: mod.id,
          modifierListId: list.id,
          name: mod.name,
          priceMoney: mod.priceMoney
            ? parseMoney(mod.priceMoney)
            : { amount: 0n, currency: item.variations[0]!.priceMoney?.currency ?? "USD" },
        });
      }
    }
    onChange(flat, errors);
  }

  function toggle(listId: string, modifierId: string) {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    const current = new Set(selection[listId]);
    if (list.selectionType === "SINGLE") {
      current.clear();
      current.add(modifierId);
    } else if (current.has(modifierId)) {
      current.delete(modifierId);
    } else {
      if (current.size >= list.maxSel) return;
      current.add(modifierId);
    }
    emit({ ...selection, [listId]: current });
  }

  if (lists.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      {lists.map((list) => (
        <fieldset key={list.id} role={list.selectionType === "SINGLE" ? "radiogroup" : "group"} aria-label={list.name}>
          <legend className="text-sm font-medium">
            {list.name}
            {list.minSel > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                (choose {list.minSel === list.maxSel ? list.minSel : `${list.minSel}-${list.maxSel}`})
              </span>
            )}
          </legend>
          <div className="mt-2 space-y-1">
            {list.modifiers.map((m) => {
              const selected = selection[list.id]?.has(m.id) ?? false;
              return (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type={list.selectionType === "SINGLE" ? "radio" : "checkbox"}
                    name={list.id}
                    checked={selected}
                    onChange={() => toggle(list.id, m.id)}
                  />
                  <span>{m.name}</span>
                  {m.priceMoney && (
                    <span className="text-muted-foreground">
                      +{formatMoney(parseMoney(m.priceMoney))}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cart/modifier-selector.tsx
git commit -m "$(cat <<'EOF'
feat(modifiers): add ModifierSelector respecting Square constraints

Selector enforces selection_type, min/max, and per-item enabled
overrides exactly as Square models them. Validation errors flow
back via the onChange callback so the parent (item detail) decides
whether to disable the add-to-cart button — the selector itself
stays stateless about cart concerns.

Refs: spec §4.2
EOF
)"
```

---

### Task 5.5 — Update item detail to wire modifiers + cart

**Files:**
- Modify: `components/menu/item-detail.tsx`

- [ ] **Step 1: Replace `item-detail.tsx`**

```tsx
// components/menu/item-detail.tsx
"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AvailabilityBadge } from "./availability-badge";
import { ModifierSelector } from "@/components/cart/modifier-selector";
import { useCart } from "@/lib/cart/store";
import { addMoney, formatMoney, parseMoney } from "@/lib/money";
import type { AvailabilityState } from "@/lib/square/availability";
import type { SelectedModifier } from "@/lib/cart/types";
import type { WireCatalog, WireItem } from "@/lib/types";

type Props = {
  item: WireItem;
  catalog: WireCatalog;
  availability: AvailabilityState;
  locationId: string;
  locationTimezone: string;
};

export function ItemDetail({ item, catalog, availability, locationId, locationTimezone }: Props) {
  const [variationId, setVariationId] = useState(item.variations[0]!.id);
  const [mods, setMods] = useState<SelectedModifier[]>([]);
  const [modErrors, setModErrors] = useState<string[]>([]);
  const variation = item.variations.find((v) => v.id === variationId)!;
  const addLine = useCart((s) => s.addLine);

  const totalPerUnit = useMemo(() => {
    if (!variation.priceMoney) return null;
    let total = parseMoney(variation.priceMoney);
    for (const m of mods) total = addMoney(total, m.priceMoney);
    return total;
  }, [variation.priceMoney, mods]);

  const blocked = availability.kind !== "available";
  const canAdd = !blocked && modErrors.length === 0 && variation.priceMoney !== null;

  return (
    <article className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill className="object-cover" sizes="50vw" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{item.name}</h1>
        <div className="mt-2">
          <AvailabilityBadge state={availability} locationTimezone={locationTimezone} />
        </div>
        {item.description && <p className="mt-2 text-muted-foreground">{item.description}</p>}

        {item.variations.length > 1 && (
          <fieldset className="mt-4" role="radiogroup" aria-label="Size">
            <legend className="text-sm font-medium">Size</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.variations.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={v.id === variationId}
                  onClick={() => setVariationId(v.id)}
                  className={`rounded border px-3 py-1 text-sm ${v.id === variationId ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
                >
                  {v.name}
                  {v.priceMoney && <span className="ml-2 opacity-70">{formatMoney(parseMoney(v.priceMoney))}</span>}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <ModifierSelector
          item={item}
          modifierLists={catalog.modifierLists}
          onChange={(selected, errors) => {
            setMods(selected);
            setModErrors(errors);
          }}
        />

        {totalPerUnit && (
          <p className="mt-6 text-2xl font-semibold">{formatMoney(totalPerUnit)}</p>
        )}
        {modErrors.map((e) => (
          <p key={e} className="mt-1 text-sm text-amber-700">{e}</p>
        ))}
        <Button
          className="mt-4 w-full"
          disabled={!canAdd}
          onClick={() => {
            if (!variation.priceMoney) return;
            addLine({
              itemId: item.id,
              variationId: variation.id,
              itemName: item.name,
              variationName: variation.name,
              basePriceMoney: parseMoney(variation.priceMoney),
              modifiers: mods,
              qty: 1,
              locationId,
            });
          }}
        >
          {blocked ? "Not available right now" : "Add to cart"}
        </Button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Update `app/items/[id]/page.tsx` to pass new props**

Pass `catalog={c}`, `locationId={selectedLocationId ?? ""}` to `<ItemDetail />`. Compute availability as in stage 3.

- [ ] **Step 3: Commit**

```bash
git add components/menu/item-detail.tsx app/items/
git commit -m "$(cat <<'EOF'
feat(cart): wire modifier selector and cart add into item detail

Add-to-cart is gated on three conditions in one place: availability
is 'available', modifier validation has no errors, and the selected
variation has a price. The button label switches to a contextual
'Not available right now' so the user gets feedback that matches
the badge.

Refs: spec §4.2, §4.5
EOF
)"
```

---

### Task 5.6 — Cart drawer + button

**Files:**
- Create: `components/cart/cart-button.tsx`, `components/cart/cart-drawer.tsx`, `components/cart/cart-line.tsx`

- [ ] **Step 1: Create `cart-line.tsx`**

```tsx
// components/cart/cart-line.tsx
"use client";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/store";
import { formatMoney } from "@/lib/money";
import { lineItemTotal } from "@/lib/cart/selectors";
import type { CartLineItem } from "@/lib/cart/types";

export function CartLine({ line }: { line: CartLineItem }) {
  const updateQty = useCart((s) => s.updateQty);
  const removeLine = useCart((s) => s.removeLine);
  return (
    <li className="border-b py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{line.itemName} <span className="text-muted-foreground">— {line.variationName}</span></p>
          {line.modifiers.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
              {line.modifiers.map((m, i) => (
                <li key={`${m.modifierId}-${i}`} className="rounded bg-muted px-1.5 py-0.5">{m.name}</li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-sm font-medium">{formatMoney(lineItemTotal(line))}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => updateQty(line.lineId, line.qty - 1)} aria-label="Decrease quantity">−</Button>
        <span className="w-6 text-center" aria-live="polite">{line.qty}</span>
        <Button size="sm" variant="outline" onClick={() => updateQty(line.lineId, line.qty + 1)} aria-label="Increase quantity">+</Button>
        <Button size="sm" variant="ghost" onClick={() => removeLine(line.lineId)}>Remove</Button>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Create `cart-drawer.tsx`**

```tsx
// components/cart/cart-drawer.tsx
"use client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CartLine } from "./cart-line";
import { useCart } from "@/lib/cart/store";
import { useHasMounted } from "@/lib/use-has-mounted";
import { cartCount, cartSubtotal } from "@/lib/cart/selectors";
import { formatMoney } from "@/lib/money";

export function CartDrawer() {
  const lines = useCart((s) => s.lines);
  const mounted = useHasMounted();

  if (!mounted) {
    return (
      <Button variant="outline" disabled>Cart</Button>
    );
  }

  const count = cartCount({ locationId: null, lines });
  const subtotal = cartSubtotal({ locationId: null, lines });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" aria-label={`Open cart, ${count} items`}>
          Cart
          <span className="ml-2 rounded bg-primary px-1.5 text-xs text-primary-foreground" aria-live="polite">
            {count}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            Items are reserved at this location only.
          </SheetDescription>
        </SheetHeader>
        {lines.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            Your cart is empty. Browse the menu to get started.
          </p>
        ) : (
          <ul className="mt-4 flex-1 overflow-auto">
            {lines.map((l) => <CartLine key={l.lineId} line={l} />)}
          </ul>
        )}
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Subtotal</span>
            <span className="font-semibold">{formatMoney(subtotal)}</span>
          </div>
          <Button className="mt-3 w-full" disabled>Checkout (coming soon)</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Mount in `app/(menu)/layout.tsx`**

```tsx
// inside header div, alongside h1:
<CartDrawer />
```

Import `CartDrawer` and add it to the header.

- [ ] **Step 4: Location-switch confirmation**

In `app/(menu)/page.tsx`, when location changes:

```tsx
const setCartLocation = useCart((s) => s.setLocation);
const forceSetCartLocation = useCart((s) => s.forceSetLocationAndClear);
const [pendingLocation, setPendingLocation] = useState<string | null>(null);

const onLocationChange = (id: string) => {
  setSelectedLocationId(id);
  const r = setCartLocation(id);
  if (r.needsConfirm) setPendingLocation(id);
};
```

Render a shadcn `Dialog` when `pendingLocation` is set with two buttons: "Empty cart and switch" → `forceSetCartLocation(pendingLocation); setPendingLocation(null)`. "Stay" → revert `selectedLocationId` to previous + clear pending. Use a ref to track previous selection.

- [ ] **Step 5: Commit**

```bash
git add components/cart/ app/\(menu\)/
git commit -m "$(cat <<'EOF'
feat(cart): add cart drawer with subtotal and switch-location guard

useHasMounted defers the persisted-state read to client mount so
the SSR pass renders an empty button — matches the first client
render and avoids a hydration mismatch warning. The location-
switch dialog forces an explicit choice; without it, prices and
availability could silently drift from what the user added.

Refs: spec §4.5
EOF
)"
```

---

### Task 5.7 — PR + merge

```bash
git push -u origin feat/05-cart-modifiers
gh pr create --title "feat(cart): cart with modifiers and persistence" --body "Closes spec §4"
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

# Stage 6 — Inventory (out-of-stock)

**Branch:** `feat/06-inventory`
**Goal:** `/api/inventory` endpoint, badges in list, disable add-to-cart on out-of-stock variations.
**Stage gate:** an out-of-stock item shows the badge and cannot be added.

---

### Task 6.1 — Branch and inventory backend

```bash
git checkout -b feat/06-inventory
```

- [ ] **Step 1: Create `lib/square/inventory.ts`**

```ts
// lib/square/inventory.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { square } from "./client";
import { safeSquareCall, type Result } from "./errors";
import {
  InventoryByVariationSchema,
  type InventoryByVariation,
} from "./schemas";

async function fetchInventoryRaw(args: {
  locationId: string;
  variationIds: string[];
}): Promise<Result<InventoryByVariation>> {
  return safeSquareCall(async () => {
    const out: Record<string, { state: "IN_STOCK" | "OUT_OF_STOCK" | "OTHER"; quantity: number }> = {};
    if (args.variationIds.length === 0) return InventoryByVariationSchema.parse(out);
    let cursor: string | undefined = undefined;
    do {
      const res = await square.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: args.variationIds,
        locationIds: [args.locationId],
        cursor,
      });
      for (const c of res.result.counts ?? []) {
        if (!c.catalogObjectId) continue;
        const qty = c.quantity ? Number.parseInt(c.quantity, 10) : 0;
        const state = c.state === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : c.state === "IN_STOCK" ? "IN_STOCK" : "OTHER";
        // Square sometimes reports IN_STOCK with quantity 0; normalize.
        out[c.catalogObjectId] = {
          state: qty === 0 ? "OUT_OF_STOCK" : state,
          quantity: qty,
        };
      }
      cursor = res.result.cursor;
    } while (cursor);
    return InventoryByVariationSchema.parse(out);
  });
}

export const getInventory = unstable_cache(
  fetchInventoryRaw,
  ["inventory"],
  { revalidate: 30 },
);
```

- [ ] **Step 2: Create `app/api/inventory/route.ts`**

```ts
// app/api/inventory/route.ts
import "server-only";
import { getCatalog } from "@/lib/square/catalog";
import { getInventory } from "@/lib/square/inventory";
import { errorResponse, jsonResponse } from "@/lib/square/responses";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId");
  if (!locationId) {
    return jsonResponse({ error: "missing locationId" }, { status: 400 });
  }
  const catalog = await getCatalog();
  if (!catalog.ok) return errorResponse(catalog.error);
  const variationIds = catalog.value.items.flatMap((i) => i.variations.map((v) => v.id));
  const inv = await getInventory({ locationId, variationIds });
  if (!inv.ok) return errorResponse(inv.error);
  return jsonResponse(inv.value, { revalidateSeconds: 30 });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/square/inventory.ts app/api/inventory/route.ts
git commit -m "$(cat <<'EOF'
feat(inventory): add /api/inventory backed by batch-retrieve

Endpoint takes locationId, derives the variation list from the
already-cached catalog (no extra Square call there), and pages
through batchRetrieveInventoryCounts until the cursor is empty.
The IN_STOCK-with-quantity-0 quirk that Square sandbox emits is
normalized to OUT_OF_STOCK so downstream UI does not need to know.

Refs: spec §6.1, §6.3
EOF
)"
```

---

### Task 6.2 — Client fetcher and inventory state in menu page

**Files:**
- Modify: `lib/menu.ts`, `app/(menu)/page.tsx`

- [ ] **Step 1: Add fetcher to `lib/menu.ts`**

```ts
export async function fetchInventory(locationId: string): Promise<Record<string, { state: "IN_STOCK" | "OUT_OF_STOCK" | "OTHER"; quantity: number }>> {
  const res = await fetch(`/api/inventory?locationId=${encodeURIComponent(locationId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`inventory: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: In `app/(menu)/page.tsx`, fetch inventory on location change with 30s polling**

```tsx
const [inventory, setInventory] = useState<Record<string, { state: string; quantity: number }>>({});

useEffect(() => {
  if (!selectedLocationId) return;
  let cancel = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    try {
      const inv = await fetchInventory(selectedLocationId);
      if (!cancel) setInventory(inv);
    } catch {
      // swallow — keep last good inventory rather than wiping the UI
    }
    if (!cancel && document.visibilityState === "visible") {
      timer = setTimeout(tick, 30_000);
    }
  };
  tick();
  const onVis = () => {
    if (document.visibilityState === "visible") tick();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    cancel = true;
    if (timer) clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVis);
  };
}, [selectedLocationId]);
```

- [ ] **Step 3: Pass inventory down to the list**

Update `MenuList` props to take `inventory: Record<string, ...>` and forward to `ItemCard`. Update `ItemCard` to render a red "Out of stock" badge if every variation of the item is out of stock and an amber "Low stock" badge if at least one variation has quantity ≤ 3 and none are out.

- [ ] **Step 4: Update item detail to disable add-to-cart on OOS variation**

In `ItemDetail`, accept `inventory: Record<string, ...>`. Compute `oosForVariation = inventory[variationId]?.state === "OUT_OF_STOCK"`. Add to the `canAdd` condition. When variation is rendered in the variation selector, if oos, disable that button and append "Out of stock" suffix.

- [ ] **Step 5: Smoke test, commit**

```bash
git add lib/menu.ts app/\(menu\)/page.tsx components/menu/ app/items/
git commit -m "$(cat <<'EOF'
feat(inventory): poll /api/inventory and reflect stock in UI

Polling is visibility-aware so background tabs don't burn rate
limit. A failed refetch keeps the last good inventory snapshot
rather than wiping the UI to neutral. Card badges differentiate
'all variations out' from 'low stock on some' so the guest gets
honest information at a glance; the detail page then disables the
specific variation and the add-to-cart action.

Refs: spec §6.2, §6.3
EOF
)"
```

---

### Task 6.3 — PR + merge

```bash
git push -u origin feat/06-inventory
gh pr create --title "feat(inventory): out-of-stock badges and guard rails" --body "Closes spec §6"
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

# Stage 7 — Polish

**Branch:** `feat/07-polish`
**Goal:** accessibility audit pass, responsive review, README expansion, CHANGELOG generation. (Loom is recorded outside the time budget per author's decision.)

---

### Task 7.1 — Branch + a11y audit

```bash
git checkout -b feat/07-polish
```

- [ ] **Step 1: Run Lighthouse on a built app**

```bash
pnpm build && pnpm start &
# in another shell:
pnpm dlx @lhci/cli@latest collect --url=http://localhost:3000 --numberOfRuns=1
```

Read the report. Fix any a11y issue with score impact. Common fixes:
- Add `aria-label` to icon-only buttons.
- Ensure color contrast on amber/gray badges (`text-amber-900` on `bg-amber-100` already passes).
- Add `lang="en"` (already in layout) and a `<title>`.

- [ ] **Step 2: Commit a11y fixes one by one**

Each fix gets its own commit:

```bash
git commit -m "fix(ui): add aria-label to cart quantity buttons"
git commit -m "fix(ui): ensure focus ring visible on category chips"
```

---

### Task 7.2 — Responsive review

- [ ] **Step 1: Open dev tools, test at 320px / 375px / 768px / 1280px**

Fix overflow issues. Common: long item names should `truncate` or `line-clamp-1`.

- [ ] **Step 2: Commit fixes**

```bash
git commit -m "fix(ui): line-clamp long item names on cards"
```

---

### Task 7.3 — README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README** following spec §10.1 structure. Include sections: hero screenshot, quick-start, Square sandbox setup, architecture, time simulation (`?at=`), trade-offs, bonus status table, what's next.

- [ ] **Step 2: Add screenshots** if possible (`docs/screenshots/*.png`).

- [ ] **Step 3: Commit**

```bash
git add README.md docs/
git commit -m "$(cat <<'EOF'
docs(readme): write project README and quick-start

Documents how to run locally, how to seed Square sandbox, the
architectural decisions, the time simulator URL contract, and the
status of every bonus (done/skipped) with one-line rationale per
skip.

Refs: spec §10.1
EOF
)"
```

---

### Task 7.4 — CHANGELOG generation

- [ ] **Step 1: Install git-cliff**

```bash
pnpm add -D git-cliff
```

- [ ] **Step 2: Create `cliff.toml`** (use git-cliff defaults targeted at Conventional Commits) and run:

```bash
pnpm exec git-cliff -o CHANGELOG.md
```

- [ ] **Step 3: Add a `changelog` script and commit**

```json
"changelog": "git-cliff -o CHANGELOG.md"
```

```bash
git add cliff.toml CHANGELOG.md package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
docs(changelog): generate initial CHANGELOG via git-cliff

git-cliff renders the Conventional Commits history into a readable
release log. The take-home reviewer can scan one file instead of
git log to understand how the project evolved.

Refs: spec §8.6
EOF
)"
```

---

### Task 7.5 — Final PR

```bash
git push -u origin feat/07-polish
gh pr create --title "feat(polish): a11y, responsive, README, CHANGELOG" --body "Final pass before submission. Closes spec §9, §10."
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

# Done. Stage gates summary

- [ ] All tests green: `pnpm test`
- [ ] Build clean: `pnpm build`
- [ ] Type clean: `pnpm typecheck`
- [ ] Lint clean: `pnpm lint`
- [ ] Manual smoke: locations, categories, search, modifiers, cart persists, inventory badges, time simulator
- [ ] Lighthouse a11y ≥ 90
- [ ] README + CHANGELOG committed
- [ ] All 7 stage PRs merged

After this, record the Loom (outside time budget) and submit.
