/**
 * COUNTRY-MEDIA-NEWS-01 — shared constants for the source-based Country News widget.
 *
 * Country rails show articles from the country's own NEWS_SOURCE resources.
 * Only when a country has none (or none of them has articles) does the widget show
 * these global outlets, labelled as global sources, never as country media.
 */

import { getMediaRegistryProviderById } from "./media-registry.js";

/** Cards shown by the Country News widget, for "All" and for a selected source. */
export const COUNTRY_NEWS_RAIL_LIMIT = 6;

/** Registered global outlets used for the labelled Country News fallback (display order). */
export const COUNTRY_NEWS_FALLBACK_PROVIDER_IDS = [
  "bbc-world",
  "deutsche-welle",
  "france24",
  "euronews",
  "the-guardian",
  "new-york-times",
] as const;

/** Source names (= ingested `sourceName`) of the fallback outlets, in display order. */
export function listCountryNewsFallbackSourceNames(): string[] {
  return COUNTRY_NEWS_FALLBACK_PROVIDER_IDS.map(
    (id) => getMediaRegistryProviderById(id)?.name,
  ).filter((name): name is string => Boolean(name));
}
