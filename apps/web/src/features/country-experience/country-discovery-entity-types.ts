/**
 * Pack 09F2 — Country discovery Entity Type options.
 * Maps Standard / Public Choice to lifecycleProfile + entityType=initiative.
 */

import { ENTITY_TYPE_OPTIONS } from "../global-search/api";

export type CountryDiscoveryEntityTypeValue =
  | ""
  | "standard_initiatives"
  | "public_choice"
  | (typeof ENTITY_TYPE_OPTIONS)[number]["value"];

export interface CountryDiscoveryEntityTypeOption {
  value: CountryDiscoveryEntityTypeValue;
  /** English seed label — Country page localizes via `publicGeo.country.search` / globalSearch. */
  label: string;
}

/** Entity Type for Country search — All / Standard / Public Choice + other civic types. */
export const COUNTRY_DISCOVERY_ENTITY_TYPE_OPTIONS: readonly CountryDiscoveryEntityTypeOption[] = [
  { value: "", label: "All" },
  { value: "standard_initiatives", label: "Standard Initiatives" },
  { value: "public_choice", label: "Public Choice" },
  ...ENTITY_TYPE_OPTIONS.filter(
    (option) => option.value !== "" && option.value !== "initiative",
  ).map((option) => ({ value: option.value, label: option.label })),
];

/** Stable option values for localized Country search selects (Pack 08I.6). */
export const COUNTRY_DISCOVERY_ENTITY_TYPE_OPTION_VALUES: readonly CountryDiscoveryEntityTypeValue[] =
  COUNTRY_DISCOVERY_ENTITY_TYPE_OPTIONS.map((option) => option.value);

export interface CountrySearchFilterParams {
  entityType?: string;
  lifecycleProfile?: "STANDARD" | "PUBLIC_CHOICE";
}

export function resolveCountrySearchFilterParams(
  entityTypeValue: string,
): CountrySearchFilterParams {
  if (entityTypeValue === "standard_initiatives") {
    return { entityType: "initiative", lifecycleProfile: "STANDARD" };
  }

  if (entityTypeValue === "public_choice") {
    return { entityType: "initiative", lifecycleProfile: "PUBLIC_CHOICE" };
  }

  if (!entityTypeValue) {
    return {};
  }

  return { entityType: entityTypeValue };
}

export type CountryDiscoveryScope = "country" | "region" | "city";

export function resolveCountryDiscoveryScope(input: {
  regionCode: string;
  communityCode: string;
}): CountryDiscoveryScope {
  if (input.communityCode.trim()) {
    return "city";
  }

  if (input.regionCode.trim()) {
    return "region";
  }

  return "country";
}
