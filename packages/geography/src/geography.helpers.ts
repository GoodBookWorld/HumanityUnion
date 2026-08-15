import countriesData from "./countries.json" with { type: "json" };
import regionsData from "./administrative-regions.json" with { type: "json" };

import type {
  AdministrativeRegionOption,
  CountryOption,
  GeographyCountryOption,
  GeographyRegionOption,
} from "./geography.types.js";

export type {
  AdministrativeRegionOption,
  CountryOption,
  GeographyCountryOption,
  GeographyRegionOption,
} from "./geography.types.js";

export const OTHER_REGION_CODE = "OTHER-NOT-LISTED";
export const OTHER_REGION_SLUG = "other-not-listed";

const LEGACY_COUNTRY_ALIASES: Record<string, string> = {
  canada: "CA",
  ca: "CA",
};

const countries = Object.freeze(
  (countriesData as CountryOption[]).map((country) => ({
    ...country,
    code: country.code.trim().toUpperCase(),
    alpha3: country.alpha3.trim().toUpperCase(),
    name: country.name.trim(),
    region: country.region.trim(),
    subregion: country.subregion.trim(),
  })),
);

const regions = Object.freeze(
  (regionsData as AdministrativeRegionOption[]).map((region) => ({
    ...region,
    countryCode: region.countryCode.trim().toUpperCase(),
    code: region.code.trim().toUpperCase(),
    localCode: region.localCode?.trim().toUpperCase(),
    name: region.name.trim(),
    type: region.type?.trim() || undefined,
  })),
);

const countriesByCode = new Map(countries.map((country) => [country.code, country]));
const countriesByAlpha3 = new Map(countries.map((country) => [country.alpha3, country]));
const countriesByName = new Map(
  countries.map((country) => [country.name.trim().toLowerCase(), country]),
);

const regionsByCountry = new Map<string, AdministrativeRegionOption[]>();
const regionsByCode = new Map<string, AdministrativeRegionOption>();
const regionsByLegacySlug = new Map<string, AdministrativeRegionOption>();

for (const region of regions) {
  const countryRegions = regionsByCountry.get(region.countryCode) ?? [];
  countryRegions.push(region);
  regionsByCountry.set(region.countryCode, countryRegions);
  regionsByCode.set(`${region.countryCode}::${region.code}`, region);

  const legacySlug = slugifyLabel(region.name);
  regionsByLegacySlug.set(`${region.countryCode}::${legacySlug}`, region);
  regionsByLegacySlug.set(legacySlug, region);
}

function slugifyLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function getCountries(): readonly CountryOption[] {
  return countries;
}

export function getCountryByCode(countryCode: string): CountryOption | undefined {
  const normalized = normalizeCountryInput(countryCode);
  return normalized ? countriesByCode.get(normalized) : undefined;
}

export function getCountriesByRegion(region: string): readonly CountryOption[] {
  const needle = region.trim().toLowerCase();
  return countries.filter((country) => country.region.toLowerCase() === needle);
}

export function getCountriesBySubregion(subregion: string): readonly CountryOption[] {
  const needle = subregion.trim().toLowerCase();
  return countries.filter((country) => country.subregion.toLowerCase() === needle);
}

export function getRegionsByCountry(countryCode: string): readonly AdministrativeRegionOption[] {
  const normalizedCountry = normalizeCountryInput(countryCode);

  if (!normalizedCountry) {
    return [];
  }

  return [...(regionsByCountry.get(normalizedCountry) ?? [])];
}

export function getRegionByCode(
  countryCode: string,
  regionCode: string,
): AdministrativeRegionOption | undefined {
  const normalizedCountry = normalizeCountryInput(countryCode);
  const normalizedRegion = normalizeRegionInput(countryCode, regionCode);

  if (!normalizedCountry || !normalizedRegion) {
    return undefined;
  }

  if (normalizedRegion === OTHER_REGION_SLUG) {
    return undefined;
  }

  return regionsByCode.get(`${normalizedCountry}::${normalizedRegion}`);
}

export function normalizeCountryInput(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return undefined;
  }

  const upper = trimmed.toUpperCase();

  if (upper.length === 2 && countriesByCode.has(upper)) {
    return upper;
  }

  if (upper.length === 3 && countriesByAlpha3.has(upper)) {
    return countriesByAlpha3.get(upper)?.code;
  }

  const alias = LEGACY_COUNTRY_ALIASES[normalizeToken(trimmed)];

  if (alias) {
    return alias;
  }

  const slugCandidate = normalizeToken(trimmed);

  if (slugCandidate.length === 2 && countriesByCode.has(slugCandidate.toUpperCase())) {
    return slugCandidate.toUpperCase();
  }

  return countriesByName.get(normalizeToken(trimmed))?.code;
}

export function normalizeRegionInput(
  countryCode: string,
  value: string | undefined,
): string | undefined {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return undefined;
  }

  const normalizedCountry = normalizeCountryInput(countryCode);

  if (!normalizedCountry) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();

  if (lower === OTHER_REGION_SLUG || lower === "other-not-listed") {
    return OTHER_REGION_SLUG;
  }

  const upper = trimmed.toUpperCase();
  const direct = regionsByCode.get(`${normalizedCountry}::${upper}`);

  if (direct) {
    return direct.code;
  }

  const countryRegions = regionsByCountry.get(normalizedCountry) ?? [];

  const byLocalCode = countryRegions.find((region) => region.localCode?.toUpperCase() === upper);

  if (byLocalCode) {
    return byLocalCode.code;
  }

  const byName = countryRegions.find((region) => region.name.trim().toLowerCase() === lower);

  if (byName) {
    return byName.code;
  }

  const legacySlug = slugifyLabel(trimmed);
  const byLegacy = regionsByLegacySlug.get(`${normalizedCountry}::${legacySlug}`);

  if (byLegacy) {
    return byLegacy.code;
  }

  const regionCodeMatch = /^([A-Z]{2})-(.+)$/i.exec(trimmed);

  if (regionCodeMatch) {
    const [, countryPart, regionPart] = regionCodeMatch;
    const matchedCountry = normalizeCountryInput(countryPart ?? "");

    if (matchedCountry === normalizedCountry && regionPart) {
      const normalizedRegionPart = normalizeRegionInput(normalizedCountry, regionPart);

      if (normalizedRegionPart) {
        return normalizedRegionPart;
      }
    }
  }

  return undefined;
}

export function getCountryLabel(countryCode: string): string | undefined {
  return getCountryByCode(countryCode)?.name;
}

export function getRegionLabel(countryCode: string, regionCode: string): string | undefined {
  const normalizedRegion = normalizeRegionInput(countryCode, regionCode);

  if (!normalizedRegion) {
    return undefined;
  }

  if (normalizedRegion === OTHER_REGION_SLUG) {
    return "Other / Not listed";
  }

  return getRegionByCode(countryCode, normalizedRegion)?.name;
}

export function toGeographyCountryOptions(): readonly GeographyCountryOption[] {
  return countries.map((country) => ({
    slug: country.code,
    label: country.name,
    code: country.code,
  }));
}

export function toGeographyRegionOptions(
  countryCode: string,
  includeOther = true,
): readonly GeographyRegionOption[] {
  const normalizedCountry = normalizeCountryInput(countryCode);

  if (!normalizedCountry) {
    return [];
  }

  const options = getRegionsByCountry(normalizedCountry).map((region) => ({
    slug: region.code,
    label: region.name,
    countrySlug: normalizedCountry,
  }));

  if (!includeOther) {
    return options;
  }

  return [
    ...options,
    {
      slug: OTHER_REGION_SLUG,
      label: "Other / Not listed",
      countrySlug: normalizedCountry,
    },
  ];
}

export function resolveCountrySearchToken(value: string): string {
  return normalizeCountryInput(value) ?? value.trim().toUpperCase();
}

export function resolveRegionSearchToken(countryCode: string, value: string): string {
  return normalizeRegionInput(countryCode, value) ?? value.trim().toUpperCase();
}

export function formatRegionCode(countryCode: string, regionCode: string): string {
  const normalizedRegion = normalizeRegionInput(countryCode, regionCode);
  return normalizedRegion ?? regionCode.trim().toUpperCase();
}

export function searchCountries(query: string, limit = 50): readonly CountryOption[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return countries.slice(0, limit);
  }

  return countries
    .filter(
      (country) =>
        country.name.toLowerCase().includes(needle) ||
        country.code.toLowerCase().includes(needle) ||
        country.alpha3.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

export function searchRegions(
  countryCode: string,
  query: string,
  limit = 50,
): readonly AdministrativeRegionOption[] {
  const needle = query.trim().toLowerCase();
  const countryRegions = getRegionsByCountry(countryCode);

  if (!needle) {
    return countryRegions.slice(0, limit);
  }

  return countryRegions
    .filter(
      (region) =>
        region.name.toLowerCase().includes(needle) ||
        region.code.toLowerCase().includes(needle) ||
        region.localCode?.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

/** @deprecated Use normalizeCountryInput and uppercase ISO codes. */
export function normalizeCountrySlug(value: string): string {
  return normalizeCountryInput(value)?.toLowerCase() ?? value.trim().toLowerCase();
}

/** @deprecated Use getCountryByCode. */
export function getCountryBySlug(slug: string): GeographyCountryOption | undefined {
  const country = getCountryByCode(slug);

  if (!country) {
    return undefined;
  }

  return {
    slug: country.code,
    label: country.name,
    code: country.code,
  };
}

/** @deprecated Use getCountryByCode. */
export function getCountryByCodeOrLabel(token: string): GeographyCountryOption | undefined {
  return getCountryBySlug(token);
}

/** @deprecated Use resolveCountrySearchToken. */
export function resolveCountrySearchSlug(token: string): string {
  return resolveCountrySearchToken(token);
}

/** @deprecated Use resolveRegionSearchToken. */
export function resolveRegionSearchSlug(countryCode: string, token: string): string {
  const resolved = resolveRegionSearchToken(countryCode, token);
  return resolved === OTHER_REGION_SLUG ? OTHER_REGION_SLUG : resolved;
}

/** @deprecated Use toGeographyCountryOptions. */
export const GEOGRAPHY_COUNTRIES = toGeographyCountryOptions();

/** @deprecated Use getRegionsByCountry via helper wrappers. */
export function getRegionsForCountry(countrySlug: string): GeographyRegionOption[] {
  return [...toGeographyRegionOptions(countrySlug)];
}

export function isRecognizedCountrySlug(countrySlug: string): boolean {
  return Boolean(getCountryByCode(countrySlug));
}

export function isRecognizedRegionSlug(countrySlug: string, regionSlug: string): boolean {
  if (regionSlug === OTHER_REGION_SLUG || regionSlug === OTHER_REGION_CODE) {
    return true;
  }

  return Boolean(getRegionByCode(countrySlug, regionSlug));
}

export type GeographyCountry = GeographyCountryOption;
export type GeographyRegion = GeographyRegionOption;
