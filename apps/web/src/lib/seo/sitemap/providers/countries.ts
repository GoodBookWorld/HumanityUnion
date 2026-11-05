import { getCountries } from "@hu/geography";

import {
  loadPublicCountryInventory,
  resolveCountryIndexability,
  type PublicCountryInventory,
} from "../../country-indexability";
import type { SitemapPathEntry } from "../types";

/**
 * Canonical Country pages from the shared geography catalog.
 * Legacy `/country/{slug}` redirects are intentionally omitted.
 */
export function listCountrySitemapEntries(
  countries: readonly { code: string }[] = getCountries(),
): SitemapPathEntry[] {
  return countries.map((country) => ({
    path: `/countries/${encodeURIComponent(country.code)}`,
  }));
}

/**
 * SEO-BING-06 — only countries with meaningful public content are listed.
 * Uses the page robots rule: only `ineligible` countries are dropped, so an
 * unknown or empty inventory keeps every catalog country (never a mass removal).
 */
export function filterCountrySitemapEntries(
  inventory: PublicCountryInventory,
  countries: readonly { code: string }[] = getCountries(),
): SitemapPathEntry[] {
  return listCountrySitemapEntries(
    countries.filter(
      (country) => resolveCountryIndexability(inventory, country.code) !== "ineligible",
    ),
  );
}

export async function listEligibleCountrySitemapEntries(): Promise<SitemapPathEntry[]> {
  return filterCountrySitemapEntries(await loadPublicCountryInventory());
}
