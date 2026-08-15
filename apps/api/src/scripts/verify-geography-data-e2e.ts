/**
 * Geography dataset integration verification.
 * Run: npm run verify:geography-data
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runVerificationScript } from "./verification-script-lifecycle.js";
import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyNormalizationOutputs(): void {
  console.log("1. Normalization outputs and attribution");

  const countriesPath = path.join(REPO_ROOT, "apps/web/src/data/geography/countries.json");
  const regionsPath = path.join(
    REPO_ROOT,
    "apps/web/src/data/geography/administrative-regions.json",
  );

  assert(fs.existsSync(countriesPath), "countries.json must exist");
  assert(fs.existsSync(regionsPath), "administrative-regions.json must exist");
  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/data/geography/ATTRIBUTION.md")),
    "ATTRIBUTION.md must exist",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/data/geography/source/LICENSE")),
    "source LICENSE must be preserved",
  );

  const countries = JSON.parse(fs.readFileSync(countriesPath, "utf-8")) as Array<{
    code: string;
    name: string;
  }>;
  const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8")) as Array<{
    countryCode: string;
    code: string;
    name: string;
    localCode?: string;
  }>;

  assert(countries.length > 0, "countries.json must not be empty");
  assert(regions.length > 0, "administrative-regions.json must not be empty");

  const countryCodes = new Set<string>();

  for (const country of countries) {
    assert(/^[A-Z]{2}$/.test(country.code), `Invalid country code: ${country.code}`);
    assert(!countryCodes.has(country.code), `Duplicate country code: ${country.code}`);
    countryCodes.add(country.code);
  }

  const regionCodesByCountry = new Map<string, Set<string>>();

  for (const region of regions) {
    assert(
      countryCodes.has(region.countryCode),
      `Region references unknown country: ${region.code}`,
    );
    const bucket = regionCodesByCountry.get(region.countryCode) ?? new Set<string>();
    assert(
      !bucket.has(region.code),
      `Duplicate region code within country: ${region.countryCode}/${region.code}`,
    );
    bucket.add(region.code);
    regionCodesByCountry.set(region.countryCode, bucket);

    assert(!("cities" in region), "Normalized regions must not include cities");
  }

  const serialized = JSON.stringify({ countries, regions });
  assert(!serialized.includes('"cities"'), "Normalized files must not include city records");
}

async function verifyGeographyHelpers(): Promise<void> {
  console.log("2. Shared geography helpers");

  const helpers = readRepoFile("apps/web/src/data/geography/geography.helpers.ts");
  const index = readRepoFile("apps/web/src/data/geography/index.ts");

  assert(helpers.includes("getCountries"), "Helpers must expose getCountries");
  assert(helpers.includes("normalizeCountryInput"), "Helpers must expose normalizeCountryInput");
  assert(helpers.includes("normalizeRegionInput"), "Helpers must expose normalizeRegionInput");
  assert(index.includes("geography.helpers"), "Index must export shared helpers");
  assert(
    !readRepoFile(
      "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
    ).includes("countries+states+cities.json"),
    "Client search must not import raw source dataset",
  );

  const {
    getCountries,
    getRegionByCode,
    getRegionsByCountry,
    normalizeCountryInput,
    normalizeRegionInput,
  } = await import("@hu/geography");

  const afghanistan = getCountries().find((country) => country.code === "AF");
  assert(Boolean(afghanistan), "Afghanistan must exist");

  const badakhshan = getRegionByCode("AF", "AF-BDS");
  assert(badakhshan?.name === "Badakhshan", "Afghanistan must include Badakhshan");

  const canadaRegions = getRegionsByCountry("CA");
  assert(
    canadaRegions.some((region) => region.code === "CA-BC"),
    "Canada must include British Columbia",
  );
  assert(canadaRegions.length >= 10, "Canada must include provinces and territories");

  const ukraineRegions = getRegionsByCountry("UA");
  assert(ukraineRegions.length > 0, "Ukraine must include administrative regions");

  const usRegions = getRegionsByCountry("US");
  assert(
    usRegions.some((region) => region.code.startsWith("US-")),
    "United States must include states/territories",
  );

  assert(normalizeCountryInput("Canada") === "CA", "Legacy country label must resolve");
  assert(
    normalizeRegionInput("CA", "British Columbia") === "CA-BC",
    "Legacy region label must resolve",
  );
  assert(normalizeRegionInput("CA", "british-columbia") === "CA-BC", "Legacy slug must resolve");
}

function verifyFormIntegration(): void {
  console.log("3. Form and search integration");

  const participation = readRepoFile(
    "apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx",
  );
  const preferences = readRepoFile(
    "apps/web/src/features/preferences/components/PreferencesWorkspace.tsx",
  );
  const preferredGeography = readRepoFile(
    "apps/web/src/features/preferences/components/PreferredGeographyFields.tsx",
  );
  const initiativeForm = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeFormFields.tsx",
  );
  const search = readRepoFile(
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
  );
  const map = readRepoFile("apps/web/src/features/world-map/components/InteractiveWorldMap.tsx");

  assert(
    participation.includes("GeographySearchSelect"),
    "Participation area must use shared selector",
  );
  assert(
    preferences.includes("GeographySearchSelect") ||
      preferredGeography.includes("GeographySearchSelect"),
    "Preferences must use shared selector",
  );
  assert(
    initiativeForm.includes("GeographySearchSelect"),
    "Initiative form must use shared selector",
  );
  assert(search.includes("GeographySearchSelect"), "Search must use shared geography selectors");
  assert(
    search.includes("fetchCommunitiesByRegion"),
    "Search must load communities after region selection",
  );
  assert(
    search.includes("City / Community"),
    "Search must label community filter as City / Community",
  );
  assert(
    search.includes("global-search-page__item-media"),
    "All search result cards must include media column",
  );
  assert(search.includes("toGeographyCountryOptions"), "Search must use shared countries dataset");
  assert(
    map.includes("GEOGRAPHY_COUNTRIES"),
    "Home map fallback must use shared countries dataset",
  );
  assert(participation.includes('setRegionSlug("")'), "Country change must reset region");
  assert(
    initiativeForm.includes('communityCode: ""'),
    "Initiative country change must reset community",
  );
  assert(initiativeForm.includes('regionCode: ""'), "Initiative country change must reset region");

  const nominationForm = readRepoFile(
    "apps/web/src/features/civic-nomination/components/CivicNominationFormPageContent.tsx",
  );
  assert(
    nominationForm.includes("GeographySearchSelect"),
    "Civic nomination form must use shared geography selectors",
  );
  assert(
    nominationForm.includes("fetchCommunitiesByRegion"),
    "Civic nomination form must load communities after region selection",
  );
}

async function verifySearchCompatibility(): Promise<void> {
  console.log("4. Search compatibility with canonical geography");

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");
  const { seedMember } = await import("../modules/member/member.store.js");

  const steward: RequestIdentity = {
    participantId: `member-geo-${Date.now()}`,
    displayName: "Geography Steward",
  };

  seedMember({
    id: steward.participantId,
    profile: {
      displayName: steward.displayName ?? "Geography Steward",
      uniqueName: `geo-steward-${Date.now()}`,
      languages: ["en"],
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const draft = createInitiativeDraft(steward, {
    title: `Geography Search ${Date.now()}`,
    description: "Geography dataset search verification.",
    activityArea: "Environment and Climate",
    participationScope: "region",
    countrySlug: "CA",
    regionSlug: "CA-BC",
  });

  const draftSearch = await searchPublicCivicRecords({ q: draft.title, limit: 20, offset: 0 });
  assert(
    !draftSearch.results.some((result) => result.entityId === draft.initiativeId),
    "Draft initiatives must remain excluded from search",
  );

  const published = publishInitiative(steward, draft.initiativeId);

  const byCountryName = await searchPublicCivicRecords({
    country: "Canada",
    entityTypes: ["initiative"],
    limit: 50,
    offset: 0,
  });
  assert(
    byCountryName.results.some((result) => result.entityId === published.initiativeId),
    "Search must match by country name",
  );

  const byRegionCode = await searchPublicCivicRecords({
    country: "CA",
    region: "CA-BC",
    entityTypes: ["initiative"],
    limit: 50,
    offset: 0,
  });
  assert(
    byRegionCode.results.some((result) => result.entityId === published.initiativeId),
    "Search must match by region code",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:geography-data pass ${pass} ===`);
  verifyNormalizationOutputs();
  await verifyGeographyHelpers();
  verifyFormIntegration();
  await verifySearchCompatibility();
  console.log("verify:geography-data PASS");
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }
}

void runVerificationScript(main);
