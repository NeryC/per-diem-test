import { getCatalog } from "@/lib/square/catalog";
import { errorResponse, jsonResponse } from "@/lib/square/responses";
import type { CatalogSnapshot, Money } from "@/lib/square/schemas";

export const dynamic = "force-dynamic";

/**
 * Money carries a bigint amount which does not survive JSON.stringify
 * natively. Serialize amount as a decimal string at the wire boundary;
 * the client parses back with BigInt() before doing any arithmetic.
 */
type WireMoney = { amount: string; currency: string } | null;

function serializeMoney(m: Money | null): WireMoney {
  if (!m) return null;
  return { amount: m.amount.toString(), currency: m.currency };
}

interface WireCatalog {
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    variations: Array<{
      id: string;
      name: string;
      priceMoney: WireMoney;
      ordinal: number;
      presentAtAllLocations: boolean;
      presentAtLocationIds: string[];
      absentAtLocationIds: string[];
    }>;
    modifierListInfo: CatalogSnapshot["items"][number]["modifierListInfo"];
    presentAtAllLocations: boolean;
    presentAtLocationIds: string[];
    absentAtLocationIds: string[];
  }>;
  categories: CatalogSnapshot["categories"];
  modifierLists: Array<{
    id: string;
    name: string;
    selectionType: "SINGLE" | "MULTIPLE";
    minSelected: number;
    maxSelected: number;
    modifiers: Array<{
      id: string;
      name: string;
      priceMoney: WireMoney;
      ordinal: number;
    }>;
  }>;
}

function serialize(snapshot: CatalogSnapshot): WireCatalog {
  return {
    items: snapshot.items.map((it) => ({
      ...it,
      variations: it.variations.map((v) => ({
        ...v,
        priceMoney: serializeMoney(v.priceMoney),
      })),
    })),
    categories: snapshot.categories,
    modifierLists: snapshot.modifierLists.map((ml) => ({
      ...ml,
      modifiers: ml.modifiers.map((m) => ({
        ...m,
        priceMoney: serializeMoney(m.priceMoney),
      })),
    })),
  };
}

export async function GET(): Promise<Response> {
  const result = await getCatalog();
  if (!result.ok) return errorResponse(result.error);
  return jsonResponse(serialize(result.value), { revalidateSeconds: 300 });
}
