/**
 * TASK-083 — World navigation, home polish, preferences alignment, initiative discoverability.
 * Run: npm run verify:world-navigation-home-preferences
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

dotenv.config({ path: path.join(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

async function verifyInitiativeDiscoverability(): Promise<void> {
  console.log("1. Initiative discoverability");

  const service = readRepoFile("apps/api/src/modules/initiatives/initiative.service.ts");
  const matching = readRepoFile("apps/api/src/modules/global-search/global-search.matching.ts");
  const geography = readRepoFile("apps/api/src/modules/initiatives/initiative-geography.ts");

  assert(service.includes("invalidateGlobalSearchIndex"), "Publish must invalidate search index");
  assert(
    service.includes("enrichInitiativeMetadataGeography"),
    "Publish must enrich geography metadata",
  );
  assert(
    geography.includes("resolveInitiativeSearchGeography"),
    "Search geography helper must exist",
  );
  assert(
    matching.includes("resolveCountrySearchSlug"),
    "Search filters must resolve country tokens",
  );
  assert(matching.includes("resolveRegionSearchSlug"), "Search filters must resolve region tokens");

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");
  const { seedMember } = await import("../modules/member/member.store.js");

  const steward: RequestIdentity = {
    participantId: `member-task083-${Date.now()}`,
    displayName: "Task 083 Steward",
  };

  seedMember({
    id: steward.participantId,
    profile: {
      displayName: steward.displayName ?? "Task 083 Steward",
      uniqueName: `task083-steward-${Date.now()}`,
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
    title: `Task 083 Discoverability Draft ${Date.now()}`,
    description: "Published initiative discoverability verification record.",
    activityArea: "Environment and Climate",
    participationScope: "region",
    countrySlug: "CA",
    regionSlug: "CA-BC",
  });

  const draftSearch = await searchPublicCivicRecords({
    q: draft.title,
    limit: 20,
    offset: 0,
  });
  assert(
    !draftSearch.results.some((result) => result.entityId === draft.initiativeId),
    "Draft initiatives must not appear in search",
  );

  const published = publishInitiative(steward, draft.initiativeId);
  assert(published.lifecyclePhase === "projected", "Publish must reach projected lifecycle");

  const publishedSearch = await searchPublicCivicRecords({
    q: published.title,
    limit: 20,
    offset: 0,
  });
  assert(
    publishedSearch.results.some(
      (result) => result.entityType === "initiative" && result.entityId === published.initiativeId,
    ),
    "Published initiative must appear in search without manual index reset",
  );

  const countrySearch = await searchPublicCivicRecords({
    country: "Canada",
    entityTypes: ["initiative"],
    limit: 50,
    offset: 0,
  });
  assert(
    countrySearch.results.some((result) => result.entityId === published.initiativeId),
    "Published initiative must match canonical country search filter",
  );
}

function verifyHomeAndNavigation(): void {
  console.log("2. Home navigation and map boundary");

  const homePage = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeV2Page.tsx",
  );
  const geoSection = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeGeographicNavigationSection.tsx",
  );
  const map = readRepoFile("apps/web/src/features/world-map/components/InteractiveWorldMap.tsx");
  const navigator = readRepoFile(
    "apps/web/src/features/global-experience/components/GeographicNavigator.tsx",
  );

  assert(
    homePage.includes("PublicHomeGeographicNavigationSection"),
    "Home must include geographic navigation",
  );
  assert(geoSection.includes("GeographicNavigator"), "Geographic section must include navigator");
  assert(
    geoSection.includes("InteractiveWorldMap"),
    "Geographic section must include map boundary",
  );
  assert(map.includes("/search?country="), "Map country selection must navigate to Search");
  assert(
    navigator.includes("buildSearchUrlForGeographyScope"),
    "Navigator must link to Search filters",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "docs/INTERACTIVE_WORLD_MAP_INTEGRATION.md")),
    "Map integration doc must exist",
  );
}

function verifyStatisticsAndCoreValues(): void {
  console.log("3. Statistics and core values icons");

  const stats = readRepoFile(
    "apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx",
  );
  const statsCss = readRepoFile(
    "apps/web/src/features/platform-statistics/platform-statistics.css",
  );
  const coreValues = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCoreValuesSection.tsx",
  );
  const constants = readRepoFile("apps/web/src/features/public-home-v2/constants.ts");

  assert(stats.includes("width={64}"), "Statistics icons must be enlarged");
  assert(
    stats.includes("platform-statistics__info-trigger"),
    "Statistics must expose metric explanation control",
  );
  assert(
    statsCss.includes(".platform-statistics__description"),
    "Statistics descriptions must be styled for reveal",
  );
  assert(
    statsCss.includes(".platform-statistics__card:hover .platform-statistics__description"),
    "Statistics descriptions must reveal on hover",
  );
  assert(
    statsCss.includes(".platform-statistics__card:focus-within .platform-statistics__description"),
    "Statistics descriptions must reveal on focus",
  );

  for (const icon of ["responsibility.svg", "justice.svg", "security.svg", "progress.svg"]) {
    assert(constants.includes(icon), `Core value icon path must include ${icon}`);
    assert(
      fs.existsSync(path.join(REPO_ROOT, `apps/web/public/icons/workspace/${icon}`)),
      `Core value icon asset must exist: ${icon}`,
    );
  }

  assert(coreValues.includes("width={64}"), "Core values icons must render at 64x64");
}

function verifyFooterAndPreferences(): void {
  console.log("4. Footer stability and preferences alignment");

  const footer = readRepoFile("apps/web/src/design-system/components/HumanityFooter.tsx");
  const preferenceOption = readRepoFile(
    "apps/web/src/features/preferences/components/PreferenceOption.tsx",
  );
  const preferenceCss = readRepoFile(
    "apps/web/src/features/preferences/components/preference-option.css",
  );
  const preferences = readRepoFile(
    "apps/web/src/features/preferences/components/PreferencesWorkspace.tsx",
  );

  assert(footer.includes("public-experience-footer.css"), "Footer styles must load globally");
  assert(
    preferenceOption.includes("preference-option"),
    "Shared preference option component must exist",
  );
  assert(
    preferenceCss.includes("grid-template-columns: 20px"),
    "Preference options must align checkbox column",
  );
  assert(
    preferences.includes("PreferenceOption"),
    "Preferences workspace must use shared option component",
  );
  assert(
    preferences.includes("PreferenceOptionGrid columns={2}"),
    "Activity areas must use two-column desktop grid",
  );
}

function verifyOptionalPipelineAndSearch(): void {
  console.log("5. Optional pipeline 404 handling and search geography");

  const apiClient = readRepoFile("apps/web/src/lib/api-client.ts");
  const analysisApi = readRepoFile("apps/web/src/features/collaborative-analysis/api.ts");
  const decisionApi = readRepoFile("apps/web/src/features/collective-decision/api.ts");
  const petitionApi = readRepoFile("apps/web/src/features/petition/api.ts");
  const searchPage = readRepoFile(
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
  );
  const geographyIndex = readRepoFile("apps/web/src/data/geography/index.ts");

  assert(
    apiClient.includes("apiRequestOptional"),
    "API client must support optional 404 responses",
  );
  assert(analysisApi.includes("apiRequestOptional"), "Analysis lookup must treat 404 as empty");
  assert(decisionApi.includes("apiRequestOptional"), "Decision lookup must treat 404 as empty");
  assert(petitionApi.includes("apiRequestOptional"), "Petition lookup must treat 404 as empty");
  assert(
    searchPage.includes("GEOGRAPHY_COUNTRIES"),
    "Search must use shared geography dataset for country filter",
  );
  assert(searchPage.includes('<select name="country"'), "Search must expose country selector");
  assert(geographyIndex.includes("getCountries"), "Shared geography source must export countries");
  assert(
    fs.existsSync(path.join(REPO_ROOT, "docs/FRONTEND_MANUAL_CUSTOMIZATION.md")),
    "Manual customization doc must exist",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:world-navigation-home-preferences pass ${pass} ===`);
  verifyHomeAndNavigation();
  verifyStatisticsAndCoreValues();
  verifyFooterAndPreferences();
  verifyOptionalPipelineAndSearch();
  await verifyInitiativeDiscoverability();
  console.log("TASK-083 verify:world-navigation-home-preferences PASS");
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }
}

void runVerificationScript(main);
