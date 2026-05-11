// Seeds a Square sandbox merchant with demo catalog data for the Per Diem Test
// project. Talks to Square's REST API directly with fetch — the Square Node
// SDK lives behind import "server-only" in this project and is awkward to call
// from a one-shot script.
//
// Re-runs are safe: the script first searches for catalog items whose names
// start with "seed:" and exits early if any are present. To re-seed, pass
// --reset to batch-delete existing "seed:" objects (items, categories,
// modifier lists) before re-creating them.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

/**
 * Minimal .env parser — just enough for KEY=VALUE lines with optional quotes.
 * @param {string} path
 * @returns {Record<string, string>}
 */
function loadEnv(path) {
  /** @type {Record<string, string>} */
  const out = {};
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnv(".env");
const TOKEN = env.SQUARE_ACCESS_TOKEN;
const ENVIRONMENT = env.SQUARE_ENVIRONMENT ?? "sandbox";

if (!TOKEN) {
  console.error("Missing SQUARE_ACCESS_TOKEN in .env");
  process.exit(1);
}
if (ENVIRONMENT !== "sandbox") {
  console.error(
    `Refusing to run against SQUARE_ENVIRONMENT=${ENVIRONMENT}. This script only targets sandbox.`,
  );
  process.exit(1);
}

const BASE = "https://connect.squareupsandbox.com";
const SQUARE_VERSION = "2024-12-18";

/**
 * @param {string} path
 * @param {"GET" | "POST"} method
 * @param {unknown} [body]
 * @returns {Promise<any>}
 */
async function squareFetch(path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  /** @type {any} */
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    console.error(`Square ${method} ${path} failed: ${res.status}`);
    console.error(JSON.stringify(parsed, null, 2));
    throw new Error(`Square API error ${res.status}`);
  }
  return parsed;
}

async function listLocations() {
  const data = await squareFetch("/v2/locations", "GET");
  return Array.isArray(data.locations) ? data.locations : [];
}

/**
 * Search for catalog items whose name starts with the given prefix.
 * @param {string} prefix
 */
async function searchExistingItems(prefix) {
  const data = await squareFetch("/v2/catalog/search", "POST", {
    object_types: ["ITEM"],
    query: {
      prefix_query: {
        attribute_name: "name",
        attribute_prefix: prefix,
      },
    },
    limit: 100,
  });
  return Array.isArray(data.objects) ? data.objects : [];
}

/**
 * Search for ALL "seed:" catalog objects (items, categories, modifier lists,
 * availability periods). AVAILABILITY_PERIOD objects don't have a `name`
 * attribute, so the prefix query won't match them — we list them separately
 * and let the caller merge.
 * @param {string} prefix
 */
async function searchAllSeedObjects(prefix) {
  const data = await squareFetch("/v2/catalog/search", "POST", {
    object_types: ["ITEM", "CATEGORY", "MODIFIER_LIST"],
    query: {
      prefix_query: {
        attribute_name: "name",
        attribute_prefix: prefix,
      },
    },
    limit: 1000,
  });
  const named = Array.isArray(data.objects) ? data.objects : [];
  // Pull every AVAILABILITY_PERIOD in the sandbox via list (search has no
  // unnamed-object filter that fits). The sandbox only contains the ones
  // this script creates, so this is safe; for production you'd reference
  // them by category id_mappings instead.
  const apData = await squareFetch(
    "/v2/catalog/list?types=AVAILABILITY_PERIOD",
    "GET",
  );
  const aps = Array.isArray(apData.objects) ? apData.objects : [];
  return [...named, ...aps];
}

/**
 * Delete a single catalog object by id, swallowing 404s and reporting status.
 * @param {string} id
 */
async function cleanupProbeObject(id) {
  try {
    const res = await fetch(`${BASE}/v2/catalog/object/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Square-Version": SQUARE_VERSION,
      },
    });
    if (res.status === 404) {
      console.log(`probe cleanup: not found (${id})`);
      return;
    }
    if (!res.ok) {
      const text = await res.text();
      console.log(`probe cleanup: failed (${id}, status ${res.status}): ${text}`);
      return;
    }
    console.log(`probe cleanup: deleted (${id})`);
  } catch (err) {
    console.log(`probe cleanup: error (${id}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Batch-delete catalog objects by id. Square cascades deletes to child
 * variations and modifiers, so we only need top-level ids.
 * @param {string[]} ids
 */
async function batchDeleteCatalog(ids) {
  if (ids.length === 0) return { deleted_object_ids: [] };
  return squareFetch("/v2/catalog/batch-delete", "POST", {
    object_ids: ids,
  });
}

/**
 * @param {unknown[]} objects
 */
async function batchUpsertCatalog(objects) {
  return squareFetch("/v2/catalog/batch-upsert", "POST", {
    idempotency_key: randomUUID(),
    batches: [{ objects }],
  });
}

/**
 * @param {string} catalogObjectId
 * @param {string} locationId
 */
async function setOutOfStock(catalogObjectId, locationId) {
  return squareFetch("/v2/inventory/changes/batch-create", "POST", {
    idempotency_key: randomUUID(),
    changes: [
      {
        type: "PHYSICAL_COUNT",
        physical_count: {
          catalog_object_id: catalogObjectId,
          state: "IN_STOCK",
          location_id: locationId,
          quantity: "0",
          occurred_at: new Date().toISOString(),
        },
      },
    ],
  });
}

/**
 * Build standalone AVAILABILITY_PERIOD CatalogObjects for breakfast hours
 * (MON-FRI 06:00-11:00). Square 2024-12-18 models category availability as
 * separate AVAILABILITY_PERIOD objects referenced by id from
 * `category_data.availability_period_ids`.
 */
function breakfastAvailabilityObjects() {
  return ["MON", "TUE", "WED", "THU", "FRI"].map((d) => ({
    type: "AVAILABILITY_PERIOD",
    id: `#ap-breakfast-${d}`,
    availability_period_data: {
      day_of_week: d,
      start_local_time: "06:00:00",
      end_local_time: "11:00:00",
    },
  }));
}

const BREAKFAST_AP_TEMP_IDS = [
  "#ap-breakfast-MON",
  "#ap-breakfast-TUE",
  "#ap-breakfast-WED",
  "#ap-breakfast-THU",
  "#ap-breakfast-FRI",
];

/**
 * Construct catalog object payloads. The primary location id is used to make
 * the "Local Special" item location-exclusive when 2+ locations are present.
 *
 * @param {string} primaryLocationId
 * @param {boolean} multiLocation
 */
function buildCatalogObjects(primaryLocationId, multiLocation) {
  /** @type {unknown[]} */
  const objects = [];

  // Categories
  objects.push({
    type: "CATEGORY",
    id: "#cat-coffee",
    category_data: { name: "seed: Coffee", ordinal: 1 },
  });
  objects.push({
    type: "CATEGORY",
    id: "#cat-pastries",
    category_data: { name: "seed: Pastries", ordinal: 2 },
  });
  objects.push({
    type: "CATEGORY",
    id: "#cat-sandwiches",
    category_data: { name: "seed: Sandwiches", ordinal: 3 },
  });
  // AVAILABILITY_PERIOD objects must be in the same batch as the category
  // that references them so Square can resolve the temp ids cross-references.
  for (const ap of breakfastAvailabilityObjects()) {
    objects.push(ap);
  }
  objects.push({
    type: "CATEGORY",
    id: "#cat-breakfast",
    category_data: {
      name: "seed: Breakfast",
      ordinal: 4,
      availability_period_ids: BREAKFAST_AP_TEMP_IDS,
    },
  });

  // Modifier list (Milk: SINGLE, 1/1)
  objects.push({
    type: "MODIFIER_LIST",
    id: "#mlist-milk",
    modifier_list_data: {
      name: "seed: Milk",
      selection_type: "SINGLE",
      min_selected_modifiers: 1,
      max_selected_modifiers: 1,
      modifiers: [
        {
          type: "MODIFIER",
          id: "#mod-whole",
          modifier_data: { name: "Whole", ordinal: 0 },
        },
        {
          type: "MODIFIER",
          id: "#mod-oat",
          modifier_data: {
            name: "Oat",
            ordinal: 1,
            price_money: { amount: 50, currency: "USD" },
          },
        },
        {
          type: "MODIFIER",
          id: "#mod-almond",
          modifier_data: {
            name: "Almond",
            ordinal: 2,
            price_money: { amount: 50, currency: "USD" },
          },
        },
      ],
    },
  });

  // Square rejects batch-upserts where multiple items in the same category
  // share the same ordinal (must be unique per category). Track a counter
  // per categoryId so each item gets a fresh ordinal.
  /** @type {Record<string, number>} */
  const ordinalByCategory = {};

  /**
   * @param {{
   *   id: string;
   *   name: string;
   *   description: string;
   *   categoryId: string;
   *   priceCents?: number;
   *   variations?: { id: string; name: string; priceCents: number }[];
   *   milk?: boolean;
   *   locationExclusive?: boolean;
   * }} cfg
   */
  function makeItem(cfg) {
    const variations = cfg.variations ?? [
      {
        id: `${cfg.id}-var`,
        name: "Regular",
        priceCents: cfg.priceCents ?? 0,
      },
    ];
    const categoryOrdinal = ordinalByCategory[cfg.categoryId] ?? 0;
    ordinalByCategory[cfg.categoryId] = categoryOrdinal + 1;
    /** @type {Record<string, unknown>} */
    const itemData = {
      name: cfg.name,
      description: cfg.description,
      // Square 2024-12-18 deprecated `category_id` in favor of the multi-
      // category `categories` array and a single `reporting_category` used
      // for UI grouping. Both reference the same temp id. Ordinals must be
      // unique among items sharing a category, hence the per-category counter.
      categories: [{ id: cfg.categoryId, ordinal: categoryOrdinal }],
      reporting_category: { id: cfg.categoryId, ordinal: categoryOrdinal },
      variations: variations.map((v, idx) => ({
        type: "ITEM_VARIATION",
        id: v.id,
        item_variation_data: {
          name: v.name,
          ordinal: idx,
          pricing_type: "FIXED_PRICING",
          price_money: { amount: v.priceCents, currency: "USD" },
        },
      })),
    };
    if (cfg.milk) {
      itemData.modifier_list_info = [
        {
          modifier_list_id: "#mlist-milk",
          enabled: true,
          min_selected_modifiers: 1,
          max_selected_modifiers: 1,
        },
      ];
    }
    /** @type {Record<string, unknown>} */
    const obj = {
      type: "ITEM",
      id: cfg.id,
      item_data: itemData,
    };
    if (cfg.locationExclusive) {
      obj.present_at_all_locations = false;
      obj.present_at_location_ids = [primaryLocationId];
    }
    return obj;
  }

  objects.push(
    makeItem({
      id: "#item-latte",
      name: "seed: Latte",
      description: "Espresso and steamed milk.",
      categoryId: "#cat-coffee",
      milk: true,
      variations: [
        { id: "#var-latte-small", name: "Small", priceCents: 350 },
        { id: "#var-latte-medium", name: "Medium", priceCents: 450 },
        { id: "#var-latte-large", name: "Large", priceCents: 550 },
      ],
    }),
  );
  objects.push(
    makeItem({
      id: "#item-espresso",
      name: "seed: Espresso",
      description: "A bold shot of espresso.",
      categoryId: "#cat-coffee",
      priceCents: 300,
    }),
  );
  objects.push(
    makeItem({
      id: "#item-cappuccino",
      name: "seed: Cappuccino",
      description: "Espresso with foamed milk.",
      categoryId: "#cat-coffee",
      priceCents: 450,
      milk: true,
    }),
  );
  objects.push(
    makeItem({
      id: "#item-croissant",
      name: "seed: Croissant",
      description: "Buttery, flaky French pastry.",
      categoryId: "#cat-pastries",
      priceCents: 350,
    }),
  );
  objects.push(
    makeItem({
      id: "#item-muffin",
      name: "seed: Blueberry Muffin",
      description: "Loaded with fresh blueberries.",
      categoryId: "#cat-pastries",
      priceCents: 300,
    }),
  );
  objects.push(
    makeItem({
      id: "#item-avocado",
      name: "seed: Avocado Toast",
      description: "Sourdough, smashed avocado, chili flakes.",
      categoryId: "#cat-sandwiches",
      priceCents: 900,
    }),
  );
  objects.push(
    makeItem({
      id: "#item-hamcheese",
      name: "seed: Ham and Cheese Sandwich",
      description: "Smoked ham and Swiss on a baguette.",
      categoryId: "#cat-sandwiches",
      priceCents: 850,
    }),
  );
  objects.push(
    makeItem({
      id: "#item-burrito",
      name: "seed: Breakfast Burrito",
      description: "Eggs, cheese, potatoes, salsa.",
      categoryId: "#cat-breakfast",
      priceCents: 750,
    }),
  );
  objects.push(
    makeItem({
      id: "#item-pancakes",
      name: "seed: Pancakes",
      description: "Fluffy buttermilk pancakes with maple syrup.",
      categoryId: "#cat-breakfast",
      priceCents: 700,
    }),
  );
  if (multiLocation) {
    objects.push(
      makeItem({
        id: "#item-special",
        name: "seed: Local Special",
        description: "Only available at our flagship location.",
        categoryId: "#cat-coffee",
        priceCents: 500,
        locationExclusive: true,
      }),
    );
  }

  return objects;
}

async function main() {
  const reset = process.argv.includes("--reset");

  console.log("Listing locations...");
  const locations = await listLocations();
  console.log(`Found ${locations.length} location(s):`);
  for (const l of locations) {
    console.log(`  - ${l.name} (${l.id}, tz=${l.timezone})`);
  }
  if (locations.length === 0) {
    console.error(
      "No locations found. Create at least one in the Square Dashboard, then re-run.",
    );
    process.exit(1);
  }
  if (locations.length < 2) {
    console.warn(
      "Note: only 1 location is present. Square sandbox limits API location creation; add a second via the Dashboard if you want to demo multi-location features. Proceeding with the single location.",
    );
  }

  const primary = locations[0];
  const multiLocation = locations.length >= 2;

  if (reset) {
    // A research probe AVAILABILITY_PERIOD was left in the sandbox during
    // development. Sweep it on every --reset; Square may have already
    // garbage-collected it, in which case the 404 is logged and ignored.
    await cleanupProbeObject("C37VVVYUFOMWSZWNIBONGYKE");
    console.log('Reset requested. Searching for existing "seed:" objects...');
    const seedObjects = await searchAllSeedObjects("seed:");
    if (seedObjects.length === 0) {
      console.log("No existing seed objects to delete.");
    } else {
      const ids = seedObjects.map((o) => o.id).filter(Boolean);
      console.log(`Deleting ${ids.length} existing seed objects...`);
      const delResult = await batchDeleteCatalog(ids);
      const deleted = Array.isArray(delResult.deleted_object_ids)
        ? delResult.deleted_object_ids
        : [];
      console.log(`Deleted ${deleted.length} existing seed objects (including cascaded children).`);
    }
  } else {
    console.log('Checking for existing "seed:" items...');
    const existing = await searchExistingItems("seed:");
    if (existing.length > 0) {
      console.log(
        `Sandbox already has ${existing.length} seeded item(s). Skipping catalog creation.`,
      );
      console.log(
        'Tip: re-run with --reset to delete and recreate the "seed:" objects.',
      );
      return;
    }
  }

  console.log("Creating catalog objects...");
  const objects = buildCatalogObjects(primary.id, multiLocation);
  const result = await batchUpsertCatalog(objects);
  const created = Array.isArray(result.objects) ? result.objects : [];
  console.log(`Created ${created.length} catalog object(s).`);

  // Find the Espresso variation in the response (single variation, simplest
  // candidate for the inventory adjustment).
  /** @type {string | null} */
  let espressoVariationId = null;
  for (const obj of created) {
    if (obj.type === "ITEM" && obj.item_data?.name === "seed: Espresso") {
      const variations = obj.item_data.variations ?? [];
      if (variations.length > 0) {
        espressoVariationId = variations[0].id;
      }
      break;
    }
  }
  if (!espressoVariationId) {
    console.warn(
      "Could not find seed: Espresso variation in batch-upsert response — skipping inventory adjustment.",
    );
  } else {
    console.log(
      `Adjusting inventory: setting ${espressoVariationId} to 0 IN_STOCK at ${primary.id} (proxy normalizes to OUT_OF_STOCK)...`,
    );
    const invResult = await setOutOfStock(espressoVariationId, primary.id);
    const counts = Array.isArray(invResult.counts) ? invResult.counts : [];
    console.log(`Inventory adjustment complete. ${counts.length} count(s) returned.`);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
