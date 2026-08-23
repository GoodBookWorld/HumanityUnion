import {
  getCountryByCode,
  getCommunityLabel,
  getRegionLabel,
  normalizeCountryInput,
  normalizeRegionInput,
} from "@hu/geography";
import type {
  EditorGeographicScope,
  EditorGeographicScopeLevel,
  EditorGeographicScopePresentation,
} from "@hu/types";

import { AdministrationValidationError } from "../administration/administration.errors.js";

const LEVEL_LABELS: Record<EditorGeographicScopeLevel, string> = {
  WORLD: "World",
  COUNTRY: "Country",
  REGION: "Region",
  CITY: "City",
};

/**
 * Content geography used for scope enforcement.
 * Missing fields mean the content is not classified at that level.
 */
export interface EditorContentGeography {
  readonly countryCode?: string;
  readonly regionCode?: string;
  readonly communityCode?: string;
}

export function formatEditorGeographicScope(
  scope: EditorGeographicScope,
): EditorGeographicScopePresentation {
  const levelLabel = LEVEL_LABELS[scope.level];

  if (scope.level === "WORLD") {
    return {
      ...scope,
      levelLabel,
      summary: "World",
      detail: "All countries, regions and cities",
    };
  }

  const country =
    scope.countryCode != null ? getCountryByCode(scope.countryCode)?.name : undefined;
  const region =
    scope.countryCode && scope.regionCode
      ? getRegionLabel(scope.countryCode, scope.regionCode)
      : undefined;

  const parts: string[] = [];
  if (country) {
    parts.push(country);
  }
  if (scope.level !== "COUNTRY" && region) {
    parts.push(region);
  }
  if (scope.level === "CITY" && scope.communityCode) {
    const cityLabel =
      scope.countryCode && scope.regionCode
        ? getCommunityLabel(scope.countryCode, scope.regionCode, scope.communityCode)
        : undefined;
    parts.push(cityLabel || scope.communityCode);
  }

  return {
    ...scope,
    levelLabel,
    summary: parts.length > 0 ? parts.join(" → ") : levelLabel,
    detail: "",
  };
}

/**
 * Validates and normalizes Admin-assigned geographic scope.
 * Rejects free-text / incomplete hierarchical selections.
 */
export function normalizeEditorGeographicScope(
  input: EditorGeographicScope,
): EditorGeographicScope {
  const level = input.level;

  if (level !== "WORLD" && level !== "COUNTRY" && level !== "REGION" && level !== "CITY") {
    throw new AdministrationValidationError("Invalid geographic editing level.");
  }

  if (level === "WORLD") {
    return { level: "WORLD" };
  }

  const countryCode = normalizeCountryInput(input.countryCode);
  if (!countryCode || !getCountryByCode(countryCode)) {
    throw new AdministrationValidationError("A valid country is required for this editing area.");
  }

  if (level === "COUNTRY") {
    return { level: "COUNTRY", countryCode };
  }

  const regionCode = normalizeRegionInput(countryCode, input.regionCode);
  if (!regionCode) {
    throw new AdministrationValidationError("A valid region is required for this editing area.");
  }

  if (level === "REGION") {
    return { level: "REGION", countryCode, regionCode };
  }

  const communityCode = input.communityCode?.trim().toLowerCase();
  if (!communityCode) {
    throw new AdministrationValidationError("A valid city is required for this editing area.");
  }

  return {
    level: "CITY",
    countryCode,
    regionCode,
    communityCode,
  };
}

/**
 * Returns whether content geography is within an Editor's assigned scope.
 *
 * Rules:
 * - WORLD: all content
 * - COUNTRY/REGION/CITY: content lacking sufficient canonical geography is denied
 * - Admin bypass is handled by callers (never call this alone for admins)
 */
export function contentMatchesEditorScope(
  scope: EditorGeographicScope,
  content: EditorContentGeography,
): boolean {
  if (scope.level === "WORLD") {
    return true;
  }

  const contentCountry = content.countryCode
    ? normalizeCountryInput(content.countryCode)
    : undefined;
  if (!contentCountry || contentCountry !== scope.countryCode) {
    return false;
  }

  if (scope.level === "COUNTRY") {
    return true;
  }

  const contentRegion = content.regionCode
    ? normalizeRegionInput(contentCountry, content.regionCode)
    : undefined;
  if (!contentRegion || contentRegion !== scope.regionCode) {
    return false;
  }

  if (scope.level === "REGION") {
    return true;
  }

  const contentCity = content.communityCode?.trim().toLowerCase();
  if (!contentCity || contentCity !== scope.communityCode) {
    return false;
  }

  return true;
}
