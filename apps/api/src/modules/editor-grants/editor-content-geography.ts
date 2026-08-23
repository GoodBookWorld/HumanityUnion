import { normalizeCountryInput, normalizeRegionInput } from "@hu/geography";
import type { EditorGeographicScope, MediaResource } from "@hu/types";

import type { EditorContentGeography } from "./editor-grant.scope.js";
import { contentMatchesEditorScope } from "./editor-grant.scope.js";

/** Map Initiative metadata slugs into Editor content geography. */
export function initiativeContentGeography(input: {
  countrySlug?: string;
  regionSlug?: string;
  communitySlug?: string;
}): EditorContentGeography {
  const countryCode = input.countrySlug
    ? normalizeCountryInput(input.countrySlug)
    : undefined;
  const regionCode =
    countryCode && input.regionSlug
      ? normalizeRegionInput(countryCode, input.regionSlug)
      : undefined;
  const communityCode = input.communitySlug?.trim().toLowerCase() || undefined;

  return {
    ...(countryCode ? { countryCode } : {}),
    ...(regionCode ? { regionCode } : {}),
    ...(communityCode ? { communityCode } : {}),
  };
}

export function mediaResourceContentGeography(resource: {
  scopeType: MediaResource["scopeType"];
  countryCode?: string | null;
}): EditorContentGeography {
  if (resource.scopeType === "WORLD") {
    return {};
  }
  const countryCode = resource.countryCode
    ? normalizeCountryInput(resource.countryCode)
    : undefined;
  return countryCode ? { countryCode } : {};
}

export function countryAffiliationContentGeography(countryCode: string): EditorContentGeography {
  const normalized = normalizeCountryInput(countryCode);
  return normalized ? { countryCode: normalized } : {};
}

/**
 * MediaResource is WORLD|COUNTRY only.
 * REGION/CITY Editors cannot safely mutate country-only resources.
 */
export function mediaResourceCompatibleWithEditorScope(
  editorScope: EditorGeographicScope,
  resource: { scopeType: MediaResource["scopeType"]; countryCode?: string | null },
): boolean {
  if (editorScope.level === "REGION" || editorScope.level === "CITY") {
    return false;
  }

  if (editorScope.level === "WORLD") {
    return true;
  }

  // COUNTRY Editor: only COUNTRY-scoped resources in that country (not WORLD).
  if (resource.scopeType !== "COUNTRY") {
    return false;
  }
  return contentMatchesEditorScope(editorScope, mediaResourceContentGeography(resource));
}

/**
 * CountryAffiliation is country-only.
 * REGION/CITY Editors: not compatible (do not invent region ownership).
 */
export function countryAffiliationCompatibleWithEditorScope(
  editorScope: EditorGeographicScope,
  countryCode: string,
): boolean {
  if (editorScope.level === "REGION" || editorScope.level === "CITY") {
    return false;
  }
  if (editorScope.level === "WORLD") {
    return true;
  }
  return contentMatchesEditorScope(
    editorScope,
    countryAffiliationContentGeography(countryCode),
  );
}

/** Beta invites are platform-wide — only WORLD Editors. */
export function betaAccessCompatibleWithEditorScope(
  editorScope: EditorGeographicScope,
): boolean {
  return editorScope.level === "WORLD";
}
