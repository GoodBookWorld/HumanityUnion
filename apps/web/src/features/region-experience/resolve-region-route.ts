import { findRegionsByNameSlug, getRegionByIsoCode } from "@hu/geography";

/**
 * REGION-500B.2 — canonical region URLs are /region/{ISO 3166-2 code}.
 *
 * - The exact registry code renders.
 * - Another casing of a registry code redirects to the canonical code.
 * - A legacy name slug ("british-columbia") redirects only when exactly one
 *   registry region in any country has that name; ambiguous names are not guessed.
 * - Anything else is not found.
 *
 * Redirect targets are always canonical codes, which never redirect again.
 */
export type RegionRouteResolution =
  | { kind: "canonical"; regionCode: string; countryCode: string }
  | { kind: "redirect"; regionCode: string }
  | { kind: "not-found" };

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export function resolveRegionRoute(regionParam: string): RegionRouteResolution {
  const value = decodeParam(regionParam);

  if (!value) {
    return { kind: "not-found" };
  }

  const byCode = getRegionByIsoCode(value);

  if (byCode) {
    return value === byCode.code
      ? { kind: "canonical", regionCode: byCode.code, countryCode: byCode.countryCode }
      : { kind: "redirect", regionCode: byCode.code };
  }

  const byName = findRegionsByNameSlug(value);

  if (byName.length === 1 && byName[0]) {
    return { kind: "redirect", regionCode: byName[0].code };
  }

  return { kind: "not-found" };
}

export function regionHref(regionCode: string): string {
  return `/region/${encodeURIComponent(regionCode)}`;
}
