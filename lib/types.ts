/**
 * Client-facing wire types.
 *
 * These mirror the schemas in `@/lib/square/schemas` but model money as a
 * decimal string instead of a bigint, because the JSON boundary cannot
 * transport bigints. UI components import only from this module so the
 * server module graph (and therefore the Square SDK and the access token)
 * never reaches the client bundle.
 *
 * Refs: spec §1.3, §2.5
 */

export interface WireMoney {
  /** Decimal string of integer minor units (e.g. "1234" for $12.34 USD). */
  amount: string;
  /** ISO-4217 currency code. */
  currency: string;
}

export interface WireLocation {
  id: string;
  name: string;
  timezone: string;
  status: string;
  currency: string;
}

export interface WireItemVariation {
  id: string;
  name: string;
  priceMoney: WireMoney | null;
  ordinal: number;
  presentAtAllLocations: boolean;
  presentAtLocationIds: string[];
  absentAtLocationIds: string[];
}

export interface WireItemModifierListInfo {
  modifierListId: string;
  minSelectedOverride: number | null;
  maxSelectedOverride: number | null;
  enabled: boolean;
}

export interface WireItem {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  /**
   * Optional image URL; not currently populated by the catalog proxy but
   * declared here so item surfaces can render images without a follow-up
   * type change when the backend starts emitting them.
   */
  imageUrl?: string | null;
  variations: WireItemVariation[];
  modifierListInfo: WireItemModifierListInfo[];
  presentAtAllLocations: boolean;
  presentAtLocationIds: string[];
  absentAtLocationIds: string[];
}

export interface WireTimeRange {
  startLocal: string;
  endLocal: string;
}

export type WireDayOfWeek =
  | "SUN"
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT";

export interface WireAvailabilityWindow {
  dayOfWeek: WireDayOfWeek;
  range: WireTimeRange;
}

export interface WireCategory {
  id: string;
  name: string;
  availabilityWindows: WireAvailabilityWindow[];
  locationOverrides: Record<string, WireAvailabilityWindow[]>;
  presentAtAllLocations: boolean;
  presentAtLocationIds: string[];
  absentAtLocationIds: string[];
}

export interface WireModifier {
  id: string;
  name: string;
  priceMoney: WireMoney | null;
  ordinal: number;
}

export interface WireModifierList {
  id: string;
  name: string;
  selectionType: "SINGLE" | "MULTIPLE";
  minSelected: number;
  maxSelected: number;
  modifiers: WireModifier[];
}

export interface WireCatalog {
  items: WireItem[];
  categories: WireCategory[];
  modifierLists: WireModifierList[];
  /** ISO-8601 datetime of the upstream snapshot. */
  fetchedAt: string;
}
