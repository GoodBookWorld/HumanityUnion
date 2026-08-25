import { getCountries } from "@hu/geography";

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
