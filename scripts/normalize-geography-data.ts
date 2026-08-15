/**
 * Normalizes local geography source data into platform-ready JSON files.
 * Run: npm run geography:normalize
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

const SOURCE_PATH = path.join(
  REPO_ROOT,
  "packages/geography/source/countries+states+cities.json",
);
const OUTPUT_DIR = path.join(REPO_ROOT, "packages/geography/src");
const COMMUNITIES_OUTPUT_DIR = path.join(REPO_ROOT, "apps/web/public/data/geography/communities");
const COUNTRIES_OUTPUT = path.join(OUTPUT_DIR, "countries.json");
const REGIONS_OUTPUT = path.join(OUTPUT_DIR, "administrative-regions.json");

interface SourceCity {
  id: number;
  name: string;
}

interface SourceState {
  id: number;
  name: string;
  iso2?: string;
  iso3166_2?: string;
  type?: string;
  cities?: SourceCity[];
}

interface SourceCountry {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
  region: string;
  region_id?: number;
  subregion: string;
  subregion_id?: number;
  states?: SourceState[];
}

interface NormalizedCountry {
  code: string;
  alpha3: string;
  name: string;
  region: string;
  subregion: string;
}

interface NormalizedRegion {
  countryCode: string;
  code: string;
  localCode: string;
  name: string;
  type?: string;
}

interface NormalizedCommunity {
  code: string;
  label: string;
}

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

function buildRegionCode(countryIso2: string, state: SourceState): string {
  const iso3166 = trim(state.iso3166_2);

  if (iso3166) {
    return iso3166.toUpperCase();
  }

  const localCode = trim(state.iso2).toUpperCase();

  if (!localCode) {
    throw new Error(`State "${state.name}" in ${countryIso2} is missing iso2 and iso3166_2.`);
  }

  return `${countryIso2.toUpperCase()}-${localCode}`;
}

function main(): void {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Source geography file not found: ${SOURCE_PATH}`);
  }

  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf-8")) as SourceCountry[];

  const countries: NormalizedCountry[] = [];
  const regions: NormalizedRegion[] = [];
  const countryCodes = new Set<string>();
  const regionCodesByCountry = new Map<string, Set<string>>();
  const regionKeys = new Set<string>();
  const communitiesByRegion = new Map<string, NormalizedCommunity[]>();
  let missingCountryRelationship = 0;
  let communityCount = 0;

  for (const country of source) {
    const code = trim(country.iso2).toUpperCase();

    if (!code || code.length !== 2) {
      throw new Error(`Country "${country.name}" has invalid iso2: ${country.iso2}`);
    }

    if (countryCodes.has(code)) {
      throw new Error(`Duplicate country code detected: ${code}`);
    }

    countryCodes.add(code);
    countries.push({
      code,
      alpha3: trim(country.iso3).toUpperCase(),
      name: trim(country.name),
      region: trim(country.region),
      subregion: trim(country.subregion),
    });

    for (const state of country.states ?? []) {
      if (!country.iso2) {
        missingCountryRelationship += 1;
        continue;
      }

      const regionCode = buildRegionCode(code, state);
      const localCode = trim(state.iso2).toUpperCase() || regionCode.split("-").slice(1).join("-");
      const dedupeKey = `${code}::${regionCode}`;

      if (regionKeys.has(dedupeKey)) {
        continue;
      }

      regionKeys.add(dedupeKey);

      const countryRegionCodes = regionCodesByCountry.get(code) ?? new Set<string>();

      if (countryRegionCodes.has(regionCode)) {
        continue;
      }

      countryRegionCodes.add(regionCode);
      regionCodesByCountry.set(code, countryRegionCodes);

      regions.push({
        countryCode: code,
        code: regionCode,
        localCode,
        name: trim(state.name),
        type: trim(state.type) || undefined,
      });

      const regionCommunityKey = `${code}::${regionCode}`;
      const regionCommunities: NormalizedCommunity[] = [];

      for (const city of state.cities ?? []) {
        const cityName = trim(city.name);

        if (!cityName) {
          continue;
        }

        regionCommunities.push({
          code: String(city.id),
          label: cityName,
        });
        communityCount += 1;
      }

      if (regionCommunities.length > 0) {
        regionCommunities.sort((left, right) => left.label.localeCompare(right.label));
        communitiesByRegion.set(regionCommunityKey, regionCommunities);
      }
    }
  }

  countries.sort((left, right) => left.name.localeCompare(right.name));
  regions.sort((left, right) => {
    const countryCompare = left.countryCode.localeCompare(right.countryCode);

    if (countryCompare !== 0) {
      return countryCompare;
    }

    return left.name.localeCompare(right.name);
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(COUNTRIES_OUTPUT, `${JSON.stringify(countries, null, 2)}\n`, "utf-8");
  fs.writeFileSync(REGIONS_OUTPUT, `${JSON.stringify(regions, null, 2)}\n`, "utf-8");

  if (fs.existsSync(COMMUNITIES_OUTPUT_DIR)) {
    fs.rmSync(COMMUNITIES_OUTPUT_DIR, { recursive: true, force: true });
  }

  fs.mkdirSync(COMMUNITIES_OUTPUT_DIR, { recursive: true });

  for (const [regionCommunityKey, regionCommunities] of communitiesByRegion) {
    const [countryCode, regionCode] = regionCommunityKey.split("::");

    if (!countryCode || !regionCode) {
      continue;
    }

    const countryDir = path.join(COMMUNITIES_OUTPUT_DIR, countryCode);
    fs.mkdirSync(countryDir, { recursive: true });
    fs.writeFileSync(
      path.join(countryDir, `${regionCode}.json`),
      `${JSON.stringify(regionCommunities)}\n`,
      "utf-8",
    );
  }

  console.log(
    `Normalized ${countries.length} countries -> ${path.relative(REPO_ROOT, COUNTRIES_OUTPUT)}`,
  );
  console.log(
    `Normalized ${regions.length} administrative regions -> ${path.relative(REPO_ROOT, REGIONS_OUTPUT)}`,
  );
  console.log(
    `Normalized ${communityCount} communities across ${communitiesByRegion.size} regions -> ${path.relative(REPO_ROOT, COMMUNITIES_OUTPUT_DIR)}`,
  );

  if (missingCountryRelationship > 0) {
    console.warn(
      `Warning: skipped ${missingCountryRelationship} states missing country relationship.`,
    );
  }
}

main();
