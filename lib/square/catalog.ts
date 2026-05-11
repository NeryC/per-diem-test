import "server-only";
import { unstable_cache } from "next/cache";
import type { Square } from "square";
import { getSquareClient } from "./client";
import { safeSquareCall, type Result } from "./errors";
import {
  CatalogSnapshotSchema,
  type AvailabilityWindow,
  type CatalogSnapshot,
  type Category,
  type DayOfWeek,
  type Item,
  type ItemModifierListInfo,
  type ItemVariation,
  type Modifier,
  type ModifierList,
  type Money,
} from "./schemas";

/**
 * Type guards over Square's `CatalogObject` discriminated union.
 *
 * Using the SDK's exported `Square.CatalogObject` namespace variants keeps
 * full intellisense in every branch and means that if the SDK is upgraded
 * and a variant changes shape, TypeScript catches it here instead of failing
 * at runtime in normalization.
 */
function isItemObject(
  obj: Square.CatalogObject,
): obj is Square.CatalogObject.Item {
  return obj.type === "ITEM";
}
function isCategoryObject(
  obj: Square.CatalogObject,
): obj is Square.CatalogObject.Category {
  return obj.type === "CATEGORY";
}
function isModifierListObject(
  obj: Square.CatalogObject,
): obj is Square.CatalogObject.ModifierList {
  return obj.type === "MODIFIER_LIST";
}
function isItemVariationObject(
  obj: Square.CatalogObject,
): obj is Square.CatalogObject.ItemVariation {
  return obj.type === "ITEM_VARIATION";
}
function isModifierObject(
  obj: Square.CatalogObject,
): obj is Square.CatalogObject.Modifier {
  return obj.type === "MODIFIER";
}

/** Square Money -> our Money. Returns null for unset prices (variable pricing). */
function moneyFromSquare(m: Square.Money | undefined | null): Money | null {
  if (!m || m.amount === undefined || m.amount === null || !m.currency) {
    return null;
  }
  // Square already provides amount as bigint in v44 and currency as ISO 4217.
  return { amount: m.amount, currency: m.currency };
}

/** "08:30:00" -> "08:30". Square emits seconds for RFC 3339 partial-time. */
function trimSeconds(t: string): string {
  // Strip everything from the second colon on (or just take HH:MM).
  const m = /^(\d{2}:\d{2})/.exec(t);
  return m ? m[1]! : t;
}

const VALID_DAYS: ReadonlySet<DayOfWeek> = new Set<DayOfWeek>([
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
]);
const NEXT_DAY: Record<DayOfWeek, DayOfWeek> = {
  SUN: "MON",
  MON: "TUE",
  TUE: "WED",
  WED: "THU",
  THU: "FRI",
  FRI: "SAT",
  SAT: "SUN",
};

/**
 * Convert Square's CatalogAvailabilityPeriod[] into our AvailabilityWindow[],
 * pre-splitting any midnight crossings into two windows so the availability
 * resolver downstream never has to think about that case.
 */
function parseAvailabilityPeriods(
  periods: Square.CatalogAvailabilityPeriod[] | undefined | null,
): AvailabilityWindow[] {
  if (!periods) return [];
  const out: AvailabilityWindow[] = [];
  for (const p of periods) {
    if (!p.startLocalTime || !p.endLocalTime || !p.dayOfWeek) continue;
    const day = p.dayOfWeek;
    if (!VALID_DAYS.has(day)) continue;
    const start = trimSeconds(p.startLocalTime);
    const end = trimSeconds(p.endLocalTime);
    if (end > start || end === start) {
      out.push({ dayOfWeek: day, range: { start, end } });
    } else {
      // Crosses midnight: e.g. 22:00 -> 02:00 on TUE becomes
      // TUE 22:00-23:59 + WED 00:00-02:00.
      out.push({ dayOfWeek: day, range: { start, end: "23:59" } });
      out.push({ dayOfWeek: NEXT_DAY[day], range: { start: "00:00", end } });
    }
  }
  return out;
}

function normalizeVariations(
  variations: Square.CatalogObject[] | undefined | null,
): ItemVariation[] {
  if (!variations) return [];
  const out: ItemVariation[] = [];
  for (const v of variations) {
    if (!isItemVariationObject(v) || !v.id) continue;
    const data = v.itemVariationData;
    if (!data) continue;
    out.push({
      id: v.id,
      name: data.name ?? "",
      priceMoney: moneyFromSquare(data.priceMoney),
      ordinal: typeof data.ordinal === "number" ? data.ordinal : 0,
      presentAtAllLocations: v.presentAtAllLocations ?? true,
      presentAtLocationIds: v.presentAtLocationIds ?? [],
      absentAtLocationIds: v.absentAtLocationIds ?? [],
    });
  }
  return out;
}

function normalizeModifiers(
  modifiers: Square.CatalogObject[] | undefined | null,
): Modifier[] {
  if (!modifiers) return [];
  const out: Modifier[] = [];
  for (const m of modifiers) {
    if (!isModifierObject(m) || !m.id) continue;
    const data = m.modifierData;
    if (!data) continue;
    out.push({
      id: m.id,
      name: data.name ?? "",
      priceMoney: moneyFromSquare(data.priceMoney),
      ordinal: typeof data.ordinal === "number" ? data.ordinal : 0,
    });
  }
  return out;
}

function normalizeItemModifierListInfo(
  infos: Square.CatalogItemModifierListInfo[] | undefined | null,
): ItemModifierListInfo[] {
  if (!infos) return [];
  return infos.map((i) => ({
    modifierListId: i.modifierListId,
    minSelectedOverride:
      typeof i.minSelectedModifiers === "number" && i.minSelectedModifiers >= 0
        ? i.minSelectedModifiers
        : null,
    maxSelectedOverride:
      typeof i.maxSelectedModifiers === "number" && i.maxSelectedModifiers >= 0
        ? i.maxSelectedModifiers
        : null,
    enabled: i.enabled ?? true,
  }));
}

function normalizeItem(obj: Square.CatalogObject.Item): Item | null {
  const data = obj.itemData;
  if (!data) return null;
  // Prefer the modern `categories[0]` then fall back to the deprecated
  // `categoryId` field — both still appear in v44 sandbox responses.
  const firstCategory = data.categories?.[0]?.id ?? null;
  return {
    id: obj.id,
    name: data.name ?? "",
    description: data.description ?? null,
    categoryId: firstCategory ?? data.categoryId ?? null,
    variations: normalizeVariations(data.variations),
    modifierListInfo: normalizeItemModifierListInfo(data.modifierListInfo),
    presentAtAllLocations: obj.presentAtAllLocations ?? true,
    presentAtLocationIds: obj.presentAtLocationIds ?? [],
    absentAtLocationIds: obj.absentAtLocationIds ?? [],
  };
}

function normalizeCategory(
  obj: Square.CatalogObject.Category,
  availabilityById: ReadonlyMap<string, AvailabilityWindow[]>,
): Category | null {
  // CatalogObjectCategory has an optional id (the wrapper variant only adds
  // the discriminator). Skip records without one.
  if (!obj.id) return null;
  const data = obj.categoryData;
  const availabilityIds = data?.availabilityPeriodIds ?? [];
  const windows: AvailabilityWindow[] = [];
  for (const periodId of availabilityIds) {
    const w = availabilityById.get(periodId);
    if (w) windows.push(...w);
  }
  return {
    id: obj.id,
    name: data?.name ?? "",
    availabilityWindows: windows,
    locationOverrides: [
      ...(obj.presentAtLocationIds ?? []),
      ...(obj.absentAtLocationIds ?? []),
    ],
    presentAtAllLocations: obj.presentAtAllLocations ?? true,
    presentAtLocationIds: obj.presentAtLocationIds ?? [],
    absentAtLocationIds: obj.absentAtLocationIds ?? [],
  };
}

function normalizeModifierList(
  obj: Square.CatalogObject.ModifierList,
): ModifierList | null {
  const data = obj.modifierListData;
  if (!data) return null;
  // The deprecated selectionType still drives the Single/Multiple distinction;
  // when absent we infer from min/max so the client never has to.
  const min =
    typeof data.minSelectedModifiers === "bigint"
      ? Number(data.minSelectedModifiers)
      : -1;
  const max =
    typeof data.maxSelectedModifiers === "bigint"
      ? Number(data.maxSelectedModifiers)
      : -1;
  const selectionType: "SINGLE" | "MULTIPLE" =
    data.selectionType === "MULTIPLE" || max > 1 || max === 0
      ? "MULTIPLE"
      : "SINGLE";
  return {
    id: obj.id,
    name: data.name ?? "",
    selectionType,
    minSelected: min >= 0 ? min : 0,
    maxSelected: max > 0 ? max : selectionType === "SINGLE" ? 1 : 0,
    modifiers: normalizeModifiers(data.modifiers),
  };
}

/**
 * Page through `client.catalog.list()` until exhausted. The v44 SDK's
 * `Page<T, R>` is an AsyncIterable<T>, so a for-await loop walks every
 * object across every page without exposing pagination state to callers.
 */
async function listAllCatalog(): Promise<Square.CatalogObject[]> {
  const client = getSquareClient();
  const objects: Square.CatalogObject[] = [];
  // Request every type we care about plus AVAILABILITY_PERIOD so categories
  // can resolve their availability window references in one round trip.
  const page = await client.catalog.list({
    types: "ITEM,CATEGORY,MODIFIER_LIST,AVAILABILITY_PERIOD",
  });
  for await (const obj of page) {
    objects.push(obj);
  }
  return objects;
}

function normalizeCatalog(objects: Square.CatalogObject[]): CatalogSnapshot {
  // First pass: build availability period lookup by id.
  const availabilityById = new Map<string, AvailabilityWindow[]>();
  for (const obj of objects) {
    if (obj.type === "AVAILABILITY_PERIOD" && obj.id) {
      const periodData = obj.availabilityPeriodData;
      if (periodData) {
        availabilityById.set(obj.id, parseAvailabilityPeriods([periodData]));
      }
    }
  }

  const items: Item[] = [];
  const categories: Category[] = [];
  const modifierLists: ModifierList[] = [];

  for (const obj of objects) {
    if (isItemObject(obj)) {
      const it = normalizeItem(obj);
      if (it) items.push(it);
    } else if (isCategoryObject(obj)) {
      const c = normalizeCategory(obj, availabilityById);
      if (c) categories.push(c);
    } else if (isModifierListObject(obj)) {
      const ml = normalizeModifierList(obj);
      if (ml) modifierLists.push(ml);
    }
  }

  return CatalogSnapshotSchema.parse({ items, categories, modifierLists });
}

async function fetchCatalog(): Promise<Result<CatalogSnapshot>> {
  return safeSquareCall(async () => {
    const objects = await listAllCatalog();
    return normalizeCatalog(objects);
  });
}

/** 5min TTL keyed by `catalog`. */
export const getCatalog = unstable_cache(fetchCatalog, ["catalog"], {
  revalidate: 300,
  tags: ["catalog"],
});
