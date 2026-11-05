import { getCountryByCode } from "@hu/geography";

import { resolvePublicProjectionProvider } from "../../features/public-projection-engine/resolve-public-projection-provider";
import { apiRequest } from "../api-client";

/**
 * SEO-BING-06 — countries with meaningful public content, from one API
 * inventory request. Shared by country page robots and the country sitemap
 * so both always interpret the inventory the same way.
 *
 * `unknown` (API disabled, network/HTTP failure, malformed payload) must never
 * be read as an empty list: callers keep today's index/listing behaviour.
 * A valid but empty inventory gets the same conservative fallback.
 */
export type PublicCountryInventory =
  | { readonly status: "known"; readonly countryCodes: ReadonlySet<string> }
  | { readonly status: "unknown" };

export type CountryIndexability = "eligible" | "ineligible" | "unknown";

const UNKNOWN_INVENTORY: PublicCountryInventory = { status: "unknown" };
const ISO_ALPHA2 = /^[A-Z]{2}$/;

/**
 * Validates the endpoint `data` payload. Any malformed entry makes the whole
 * inventory untrusted; well-formed codes outside the geography catalog are ignored.
 */
export function parsePublicCountryInventory(data: unknown): PublicCountryInventory {
  const entries = (data as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) {
    return UNKNOWN_INVENTORY;
  }

  const countryCodes = new Set<string>();
  for (const entry of entries) {
    const countryCode = (entry as { countryCode?: unknown } | null)?.countryCode;
    if (typeof countryCode !== "string" || !ISO_ALPHA2.test(countryCode)) {
      return UNKNOWN_INVENTORY;
    }
    if (getCountryByCode(countryCode)?.code === countryCode) {
      countryCodes.add(countryCode);
    }
  }

  return { status: "known", countryCodes };
}

export async function loadPublicCountryInventory(): Promise<PublicCountryInventory> {
  if (resolvePublicProjectionProvider().mode !== "api") {
    return UNKNOWN_INVENTORY;
  }

  try {
    const data = await apiRequest<unknown>("/api/v1/public/sitemap/countries");
    return parsePublicCountryInventory(data);
  } catch {
    return UNKNOWN_INVENTORY;
  }
}

/**
 * Single interpretation used by page robots and the sitemap. A valid inventory
 * with zero catalog countries is treated like `unknown`, so an accidental empty
 * response can never de-index or de-list every country at once.
 */
export function resolveCountryIndexability(
  inventory: PublicCountryInventory,
  countryCode: string,
): CountryIndexability {
  if (inventory.status === "unknown" || inventory.countryCodes.size === 0) {
    return "unknown";
  }
  return inventory.countryCodes.has(countryCode) ? "eligible" : "ineligible";
}
