/**
 * TASK-084 — Map embed, initiative media, button consistency, and search repair.
 * Run: npm run verify:map-initiative-search-polish
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

function verifyMapEmbed(): void {
  console.log("1. WDCR map iframe embed");

  const map = readRepoFile("apps/web/src/features/world-map/components/InteractiveWorldMap.tsx");
  const mapCss = readRepoFile(
    "apps/web/src/features/world-map/components/interactive-world-map.css",
  );

  assert(map.includes('src="/wdcr-js-map/index.html"'), "Map must embed existing WDCR index.html");
  assert(
    map.includes("interactive-world-map-boundary__frame"),
    "Map iframe must live inside existing frame",
  );
  assert(
    map.includes("interactive-world-map-boundary__iframe"),
    "Map must use scoped iframe class",
  );
  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/public/wdcr-js-map/index.html")),
    "WDCR map asset must exist",
  );
  assert(mapCss.includes(".interactive-world-map-boundary__frame"), "Map frame CSS must exist");
  assert(mapCss.includes("width: 100%"), "Map frame must be full width");
  assert(mapCss.includes("min-height: 560px"), "Desktop map iframe min-height must be set");
  assert(mapCss.includes("min-height: 480px"), "Tablet map iframe min-height must be set");
  assert(mapCss.includes("min-height: 360px"), "Mobile map iframe min-height must be set");

  const geoSection = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeGeographicNavigationSection.tsx",
  );
  const homePage = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeV2Page.tsx",
  );
  assert(
    homePage.includes("PublicHomeGeographicNavigationSection"),
    "Home must include one geographic navigation section",
  );
  assert(geoSection.includes("InteractiveWorldMap"), "Geographic section must include map");
}

function verifyStatisticsAndButtons(): void {
  console.log("2. Statistics tooltips and primary button hover");

  const statsCss = readRepoFile(
    "apps/web/src/features/platform-statistics/platform-statistics.css",
  );
  const componentsCss = readRepoFile("apps/web/src/design-system/components.css");

  assert(
    statsCss.includes("top: calc(100% + var(--hu-space-2))"),
    "Statistics descriptions must open downward",
  );
  assert(statsCss.includes("bottom: auto"), "Statistics descriptions must not anchor upward");
  assert(componentsCss.includes("#df9815"), "Primary button hover must use #DF9815 background");
  assert(componentsCss.includes("color: #ffffff"), "Primary button hover must use white text");
}

function verifyInitiativeImageFoundation(): void {
  console.log("3. Initiative image component and fallback");

  const initiativeImage = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeImage.tsx",
  );

  assert(initiativeImage.includes("InitiativeImage"), "InitiativeImage component must exist");
  assert(
    initiativeImage.includes("/images/initiatives/initiative-default.webp"),
    "InitiativeImage must use /images/initiatives/initiative-default.webp",
  );
  assert(initiativeImage.includes("onError"), "InitiativeImage must handle load failures");
  assert(
    fs.existsSync(
      path.join(REPO_ROOT, "apps/web/public/images/initiatives/initiative-default.webp"),
    ),
    "Initiative fallback asset must exist",
  );

  for (const file of [
    "apps/web/src/features/initiatives/components/WorldInitiativesPageContent.tsx",
    "apps/web/src/features/public-home-v2/components/PublicHomeLatestInitiativesSection.tsx",
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
    "apps/web/src/features/initiatives/components/InitiativeCard.tsx",
    "apps/web/src/app/initiatives/public/[initiativeId]/page.tsx",
  ]) {
    assert(readRepoFile(file).includes("InitiativeImage"), `${file} must use InitiativeImage`);
  }
}

function verifyPublicInitiativeLayout(): void {
  console.log("4. Centered public initiative detail layout");

  const css = readRepoFile(
    "apps/web/src/app/initiatives/public/[initiativeId]/public-initiative-page.css",
  );

  assert(css.includes("margin-inline: auto"), "Public initiative page must center container");
  assert(
    css.includes("min(100% - 2rem, 960px)"),
    "Public initiative page must use readable max-width",
  );
  assert(css.includes("text-align: left"), "Public initiative body text must remain left-aligned");
  assert(
    css.includes("public-initiative-page__illustration"),
    "Public initiative page must show illustration",
  );
}

async function verifySearchRepair(): Promise<void> {
  console.log("5. Search discovery and canonical geography");

  const matching = readRepoFile("apps/api/src/modules/global-search/global-search.matching.ts");
  const searchPage = readRepoFile(
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
  );
  const geography = readRepoFile("packages/geography/src/index.ts");

  assert(
    matching.includes("resolveCountrySearchSlug"),
    "Search matching must resolve country tokens",
  );
  assert(
    matching.includes("resolveRegionSearchSlug"),
    "Search matching must resolve region tokens",
  );
  assert(geography.includes("formatRegionCode"), "Geography package must expose region codes");
  assert(searchPage.includes("Searching civic records"), "Search loading state must be visible");
  assert(
    searchPage.includes("No public civic records match your search."),
    "Search empty state must be explicit",
  );
  assert(
    searchPage.includes("Search is temporarily unavailable."),
    "Search error state must be explicit",
  );
  assert(searchPage.includes("View Initiative →"), "Initiative results must link to public page");

  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");
  const { seedMember } = await import("../modules/member/member.store.js");

  const steward: RequestIdentity = {
    participantId: `member-task084-${Date.now()}`,
    displayName: "Task 084 Steward",
  };

  seedMember({
    id: steward.participantId,
    profile: {
      displayName: steward.displayName ?? "Task 084 Steward",
      uniqueName: `task084-steward-${Date.now()}`,
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
    title: `Task 084 Search Draft ${Date.now()}`,
    description: "Climate resilience verification record for search repair.",
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

  const titleSearch = await searchPublicCivicRecords({
    q: published.title,
    entityTypes: ["initiative"],
    limit: 20,
    offset: 0,
  });
  assert(
    titleSearch.results.some((result) => result.entityId === published.initiativeId),
    "Published initiative must be searchable by title",
  );

  const countrySearch = await searchPublicCivicRecords({
    country: "CA",
    entityTypes: ["initiative"],
    limit: 50,
    offset: 0,
  });
  assert(
    countrySearch.results.some((result) => result.entityId === published.initiativeId),
    "Published initiative must match country code filter",
  );

  const regionSearch = await searchPublicCivicRecords({
    country: "CA",
    region: "CA-BC",
    entityTypes: ["initiative"],
    limit: 50,
    offset: 0,
  });
  assert(
    regionSearch.results.some((result) => result.entityId === published.initiativeId),
    "Published initiative must match region code filter",
  );

  const activitySearch = await searchPublicCivicRecords({
    activityArea: "Environment and Climate",
    entityTypes: ["initiative"],
    limit: 50,
    offset: 0,
  });
  assert(
    activitySearch.results.some((result) => result.entityId === published.initiativeId),
    "Published initiative must match activity area filter",
  );

  const initiativeResult = titleSearch.results.find(
    (result) => result.entityId === published.initiativeId,
  );
  assert(
    Boolean(initiativeResult?.publicUrl.includes("/initiatives/public/")),
    "Search result must link to public initiative route",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:map-initiative-search-polish pass ${pass} ===`);
  verifyMapEmbed();
  verifyStatisticsAndButtons();
  verifyInitiativeImageFoundation();
  verifyPublicInitiativeLayout();
  await verifySearchRepair();
  console.log("TASK-084 verify:map-initiative-search-polish PASS");
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }
}

void runVerificationScript(main);
