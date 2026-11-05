import { getCountryByCode } from "@hu/geography";

import { resolvePublicProjectionProvider } from "../../features/public-projection-engine/resolve-public-projection-provider";
import { ApiRequestError, apiRequest } from "../api-client";

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

export type CountryInventoryUnknownReason =
  "projection_mode" | "http_error" | "network_error" | "invalid_response" | "empty_inventory";

/** Log-safe summary of one inventory load: outcome, reason, counts and HTTP status only. */
export type CountryInventoryDiagnostic =
  | { readonly outcome: "known"; readonly eligibleCount: number }
  | {
      readonly outcome: "unknown";
      readonly reason: CountryInventoryUnknownReason;
      readonly httpStatus?: number;
    };

export interface PublicCountryInventoryResult {
  readonly inventory: PublicCountryInventory;
  readonly diagnostic: CountryInventoryDiagnostic;
}

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

function unknownResult(
  reason: CountryInventoryUnknownReason,
  httpStatus?: number,
): PublicCountryInventoryResult {
  return {
    inventory: UNKNOWN_INVENTORY,
    diagnostic:
      httpStatus === undefined
        ? { outcome: "unknown", reason }
        : { outcome: "unknown", reason, httpStatus },
  };
}

function classifyInventoryRequestError(error: unknown): PublicCountryInventoryResult {
  if (!(error instanceof ApiRequestError) || error.status === 0) {
    return unknownResult("network_error");
  }
  if (error.status >= 200 && error.status < 300) {
    return unknownResult("invalid_response", error.status);
  }
  return unknownResult("http_error", error.status);
}

export async function loadPublicCountryInventoryWithDiagnostic(): Promise<PublicCountryInventoryResult> {
  if (resolvePublicProjectionProvider().mode !== "api") {
    return unknownResult("projection_mode");
  }

  let data: unknown;
  try {
    data = await apiRequest<unknown>("/api/v1/public/sitemap/countries");
  } catch (error) {
    return classifyInventoryRequestError(error);
  }

  const inventory = parsePublicCountryInventory(data);
  if (inventory.status === "unknown") {
    return unknownResult("invalid_response");
  }
  if (inventory.countryCodes.size === 0) {
    return { inventory, diagnostic: { outcome: "unknown", reason: "empty_inventory" } };
  }
  return {
    inventory,
    diagnostic: { outcome: "known", eligibleCount: inventory.countryCodes.size },
  };
}

export async function loadPublicCountryInventory(): Promise<PublicCountryInventory> {
  return (await loadPublicCountryInventoryWithDiagnostic()).inventory;
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
