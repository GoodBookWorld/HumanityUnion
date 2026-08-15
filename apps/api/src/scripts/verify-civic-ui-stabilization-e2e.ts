/**
 * TASK-098A — Civic UI stabilization verification.
 * Run: npm run verify:civic-ui-stabilization
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

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

function verifyCarouselStabilization(): void {
  console.log("1. Shared carousel CSS and route consistency");

  const carousel = readRepoFile(
    "apps/web/src/features/public-home-v2/components/PublicHomeCarousel.tsx",
  );
  const carouselCss = readRepoFile("apps/web/src/features/public-home-v2/public-home-carousel.css");
  const mapInteract = readRepoFile("apps/web/public/wdcr-js-map/map-interact.js");

  assert(
    carousel.includes('import "../public-home-carousel.css"'),
    "Carousel must import shared CSS.",
  );
  assert(
    carouselCss.includes(".public-home-carousel__viewport") &&
      carouselCss.includes("display: grid"),
    "Carousel viewport must use horizontal grid layout.",
  );
  assert(carousel.includes("usePathname"), "Carousel must reinitialize after client navigation.");
  assert(
    mapInteract.includes('window.open(wdcrjsconfig[id].url, "_top")'),
    "Map must navigate top-level.",
  );
  assert(
    !mapInteract.includes("window.parent.location.href"),
    "Map must not trap country pages in iframe.",
  );
}

function verifyCountrySearchAndNavigation(): void {
  console.log("2. Country search contract and canonical routes");

  const countryPage = readRepoFile(
    "apps/web/src/features/country-experience/components/CountryExperienceDynamicPage.tsx",
  );
  const regionNav = readRepoFile(
    "apps/web/src/features/region-experience/components/RegionGeographicNavigator.tsx",
  );
  const searchPage = readRepoFile(
    "apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx",
  );
  const searchService = readRepoFile("apps/api/src/modules/global-search/global-search.service.ts");

  assert(
    countryPage.includes('params.set("country"'),
    "Country search must include country param.",
  );
  assert(countryPage.includes('params.set("q"'), "Country search must use q param.");
  assert(countryPage.includes("router.push(`/search?"), "Country search must redirect to /search.");
  assert(
    regionNav.includes("/countries/"),
    "Region navigator must link to canonical /countries/ route.",
  );
  assert(
    searchPage.includes("Browse all records in this country"),
    "Search empty state must offer country browse.",
  );
  assert(
    searchService.includes("normalizeCountryInput"),
    "Search API must normalize country codes.",
  );
}

function verifyMemberGeographyAndTimeline(): void {
  console.log("3. Member geography and civic activity viewport");

  const participation = readRepoFile(
    "apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx",
  );
  const civicActivityCss = readRepoFile(
    "apps/web/src/features/civic-activity/components/civic-activity-workspace.css",
  );

  assert(
    participation.includes('label="City / Community"'),
    "Participation area must include City / Community.",
  );
  assert(
    participation.includes("hydratedFormRef"),
    "Participation form must hydrate saved geography.",
  );
  assert(
    civicActivityCss.includes("--civic-activity-timeline-height: 430px"),
    "Civic activity timeline must use fixed viewport height.",
  );
  assert(
    civicActivityCss.includes("overflow-y: auto"),
    "Civic activity timeline must scroll internally.",
  );
}

function verifyInitiativeLifecyclePresentation(): void {
  console.log("4. Unified initiative lifecycle search presentation");

  const grouping = readRepoFile("apps/api/src/modules/global-search/global-search.grouping.ts");
  const timelineGroup = readRepoFile(
    "apps/web/src/features/global-search/components/InitiativeTimelineGroup.tsx",
  );
  const timelineCss = readRepoFile(
    "apps/web/src/features/global-search/components/initiative-timeline-group.css",
  );
  const facets = readRepoFile("apps/api/src/modules/global-search/global-search.facets.ts");

  assert(
    grouping.includes("INITIATIVE_TIMELINE_STAGES.map"),
    "Grouped search must include all lifecycle stages.",
  );
  assert(
    timelineGroup.includes("initiative-timeline-group__header-body"),
    "Timeline group must use unified header.",
  );
  assert(
    timelineCss.includes("grid-template-columns: minmax(0, 30%) minmax(0, 70%)"),
    "Timeline header must use 30/70 layout on desktop.",
  );
  assert(
    timelineGroup.includes("stageStateLabel"),
    "Timeline stages must expose accessible state labels.",
  );
  assert(
    facets.includes("buildGroupedSearchFacets"),
    "Grouped facets must not double-count child initiatives.",
  );
}

async function verifyGroupedCountrySearchApi(): Promise<void> {
  console.log("5. Grouped country search integration");

  process.env.INITIATIVE_PERSISTENCE = "memory";
  process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
  process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";

  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");
  const { seedMember } = await import("../modules/member/member.store.js");
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { createInitiativeCollaborativeAnalysisDraft, publishInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevision } =
    await import("../modules/initiative-version-revision/initiative-version-revision.service.js");

  resetGlobalSearchIndexForTests();

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const steward = {
    participantId: `civic-ui-stabilization-${suffix}`,
    displayName: "Stabilization Steward",
  };
  const initiativeTitle = `Canada Civic Stabilization Initiative ${suffix}`;
  const timestamp = new Date().toISOString();
  seedMember({
    id: steward.participantId,
    profile: {
      displayName: steward.displayName,
      uniqueName: `civic-ui-stabilization-${suffix}`,
      languages: ["en"],
      country: "Canada",
      region: "British Columbia",
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const draft = createInitiativeDraft(steward, {
    title: initiativeTitle,
    description: "Published initiative for country-scoped search verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
    countrySlug: "CA",
    regionSlug: "CA-BC",
  });

  const published = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = await createInitiativeCollaborativeAnalysisDraft(steward, {
    initiativeId: published.initiativeId,
    title: "Canada Stabilization Analysis",
    summary: "Analysis for grouped lifecycle verification.",
    supportingEvidence: "Evidence",
    risks: "Risk",
    suggestedImprovements: "Improve",
    references: "Ref",
  });
  await publishInitiativeCollaborativeAnalysis(steward, analysisDraft.analysisId);

  createInitiativeRevisionDraft(steward, published.initiativeId);
  saveInitiativeRevisionDraft(steward, published.initiativeId, {
    revisionSummary: "Canada stabilization revision",
    appliedProposalIds: [],
    skippedProposalIds: [],
  });
  publishInitiativeRevision(steward, published.initiativeId);

  resetGlobalSearchIndexForTests();

  const response = await searchPublicCivicRecords({
    country: "CA",
    q: initiativeTitle,
    limit: 20,
    offset: 0,
    view: "grouped",
  });

  assert(response.view === "grouped", "Country search must return grouped view.");

  const groups =
    response.displayResults?.filter((entry) => entry.kind === "initiative_group") ?? [];

  assert(groups.length >= 1, "Scoped country search must return initiative groups.");
  assert(
    (response.displayResults?.length ?? 0) >= 1,
    "Scoped country search must include display results.",
  );

  const group = response.displayResults?.find(
    (entry) => entry.kind === "initiative_group" && entry.initiativeId === published.initiativeId,
  );

  assert(
    group?.kind === "initiative_group",
    "Published Canada initiative must appear as one grouped result.",
  );
  assert(
    group.stages.some((stage) => stage.stageId === "initiative" && stage.records.length > 0),
    "Grouped result must include Initiative stage.",
  );
  assert(
    group.stages.some((stage) => stage.stageId === "analysis" && stage.records.length > 0),
    "Grouped result must include Collaborative Analysis stage.",
  );
  assert(
    group.stages.some((stage) => stage.stageId === "revision" && stage.records.length > 0),
    "Grouped result must include Revision stage.",
  );

  const initiativeFacet = response.facets.entityTypes.find((facet) => facet.value === "initiative");
  assert((initiativeFacet?.count ?? 0) >= 1, "Initiative facet must count grouped initiatives.");
  assert(
    (initiativeFacet?.count ?? 0) <= groups.length + (response.standaloneResultCount ?? 0),
    "Initiative facet must not exceed visible grouped initiative containers.",
  );
}

async function runVerificationPass(pass: number): Promise<void> {
  console.log(`\n=== verify:civic-ui-stabilization pass ${pass} ===`);

  verifyCarouselStabilization();
  verifyCountrySearchAndNavigation();
  verifyMemberGeographyAndTimeline();
  verifyInitiativeLifecyclePresentation();
  await verifyGroupedCountrySearchApi();

  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runVerificationPass(pass);
  }

  console.log("\nverify:civic-ui-stabilization PASSED (3 consecutive passes).");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
