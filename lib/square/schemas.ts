import "server-only";
import { z } from "zod";

/**
 * Money on the wire from Square is { amount: bigint, currency: ISO-4217 string }.
 * We keep amount as bigint to avoid floating-point drift on totals.
 * The /api JSON layer serializes amount as a decimal string at the boundary.
 */
export const MoneySchema = z.object({
  amount: z.bigint(),
  currency: z.string().min(3).max(3),
});
export type Money = z.infer<typeof MoneySchema>;

/** "HH:MM" 24h. Pre-split: midnight crossings produce two windows. */
export const TimeRangeSchema = z.object({
  startLocal: z.string().regex(/^\d{2}:\d{2}$/),
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
  id: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  status: z.string().min(1),
  currency: z.string().min(3).max(3),
});
export type Location = z.infer<typeof LocationSchema>;

export const ModifierSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  priceMoney: MoneySchema.nullable(),
  ordinal: z.number().int(),
});
export type Modifier = z.infer<typeof ModifierSchema>;

export const ModifierListSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  selectionType: z.enum(["SINGLE", "MULTIPLE"]),
  minSelected: z.number().int(),
  maxSelected: z.number().int(),
  modifiers: z.array(ModifierSchema),
});
export type ModifierList = z.infer<typeof ModifierListSchema>;

export const ItemVariationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  priceMoney: MoneySchema.nullable(),
  ordinal: z.number().int(),
  presentAtAllLocations: z.boolean(),
  presentAtLocationIds: z.array(z.string()),
  absentAtLocationIds: z.array(z.string()),
});
export type ItemVariation = z.infer<typeof ItemVariationSchema>;

export const ItemModifierListInfoSchema = z.object({
  modifierListId: z.string().min(1),
  minSelectedOverride: z.number().int().nullable(),
  maxSelectedOverride: z.number().int().nullable(),
  enabled: z.boolean(),
});
export type ItemModifierListInfo = z.infer<typeof ItemModifierListInfoSchema>;

export const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.url().nullable(),
  categoryId: z.string().nullable(),
  variations: z.array(ItemVariationSchema),
  modifierListInfo: z.array(ItemModifierListInfoSchema),
  presentAtAllLocations: z.boolean(),
  presentAtLocationIds: z.array(z.string()),
  absentAtLocationIds: z.array(z.string()),
});
export type Item = z.infer<typeof ItemSchema>;

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  availabilityWindows: z.array(AvailabilityWindowSchema),
  locationOverrides: z.record(z.string(), z.array(AvailabilityWindowSchema)),
  presentAtAllLocations: z.boolean(),
  presentAtLocationIds: z.array(z.string()),
  absentAtLocationIds: z.array(z.string()),
});
export type Category = z.infer<typeof CategorySchema>;

export const CatalogSnapshotSchema = z.object({
  items: z.array(ItemSchema),
  categories: z.array(CategorySchema),
  modifierLists: z.array(ModifierListSchema),
  fetchedAt: z.iso.datetime(),
});
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;

export const InventoryStateSchema = z.enum([
  "IN_STOCK",
  "OUT_OF_STOCK",
  "OTHER",
]);
export type InventoryState = z.infer<typeof InventoryStateSchema>;

/**
 * Per-variation inventory snapshot. The contract on the wire (and back into
 * the cache layer) is a flat record keyed by variation id with the resolved
 * state and a numeric quantity, so the UI never needs to think about
 * Square's wider InventoryState enum or its decimal-string quantities.
 */
export const InventoryEntrySchema = z.object({
  state: InventoryStateSchema,
  quantity: z.number(),
});
export type InventoryEntry = z.infer<typeof InventoryEntrySchema>;

export const InventoryByVariationSchema = z.record(
  z.string(),
  InventoryEntrySchema,
);
export type InventoryByVariation = z.infer<typeof InventoryByVariationSchema>;
