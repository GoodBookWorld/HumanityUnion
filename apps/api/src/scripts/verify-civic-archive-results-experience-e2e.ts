/**
 * TASK-107 — Civic Archive centered layout and results experience verification.
 * Run: npm run verify:civic-archive-results-experience
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import { seedCivicArchiveVerificationFixture } from "./civic-archive-verification-fixture.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";
import {
  activateVerificationDatabaseIsolationAsync,
  assertVerificationDatabaseIsolated,
} from "./verification-database-isolation.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

dotenv.config({ path: path.join(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const author: RequestIdentity = {
  participantId: "member-archive-results-author",
  displayName: "Archive Results Author",
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyCenteredLayout(): void {
  console.log("1. Centered page layout");

  const css = readRepoFile("apps/web/src/app/civic-archive/civic-archive-page.css");
  const page = readRepoFile("apps/web/src/app/civic-archive/page.tsx");

  assert(
    css.includes("max-width: var(--hu-content-max-width"),
    "Page must use shared content max width.",
  );
  assert(css.includes("margin: 0 auto"), "Page must center with automatic margins.");
  assert(css.includes("width: 100%"), "Page container must span available width.");
  assert(css.includes(".civic-archive-page__header"), "Page must expose header block.");
  assert(css.includes(".civic-archive-page__results"), "Page must expose dedicated results panel.");
  assert(page.includes("civic-archive-page__header"), "Page must render header block.");
  assert(page.includes("CivicArchiveSearchExperience"), "Page must use client search experience.");
  assert(
    !page.includes("Back to Home"),
    "Page must not use Back to Home as primary results action.",
  );
}

function verifyFilterPanel(): void {
  console.log("2. Filter panel contract");

  const filters = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveFiltersForm.tsx",
  );
  const experience = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveSearchExperience.tsx",
  );

  assert(
    filters.includes("GeographySearchSelect"),
    "Filters must use searchable geography selects.",
  );
  assert(!filters.includes("GeographyMultiSelect"), "Filters must not use checkbox lists.");
  assert(
    filters.includes("disabled={!draftFilters.countryCode}"),
    "Region/community must stay disabled until country.",
  );
  assert(
    filters.includes("draftFilters"),
    "Filters must use draft filter state separate from applied results.",
  );
  assert(filters.includes("onSearch"), "Filters must submit through explicit Search handler.");
  assert(filters.includes("countryCode"), "Filters must use canonical countryCode field.");
  assert(
    experience.includes('router.push("/civic-archive")'),
    "Clear Filters must reload neutral archive state.",
  );
  assert(experience.includes("#civic-archive-results"), "Search must target results section.");
  assert(
    filters.includes("civic-archive-page__filters-row--geography"),
    "Filters must split geography row.",
  );
  assert(
    filters.includes("civic-archive-page__filters-row--filters"),
    "Filters must split archive filter row.",
  );
}

function verifyResultsPanel(): void {
  console.log("3. Results panel and card projection");

  const panel = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveResultsPanel.tsx",
  );
  const miniCard = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/PublicArchiveInitiativeMiniCard.tsx",
  );
  const css = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/civic-archive-results.css",
  );
  const pageCss = readRepoFile("apps/web/src/app/civic-archive/civic-archive-page.css");
  const experience = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveSearchExperience.tsx",
  );

  assert(panel.includes('id="civic-archive-results"'), "Results panel must expose anchor id.");
  assert(panel.includes("Civic Archive Results"), "Results panel must use approved heading.");
  assert(panel.includes("CIVIC_ARCHIVE_IDLE_INSTRUCTION"), "Idle instructional state required.");
  assert(
    panel.includes("The Civic Archive is temporarily unavailable."),
    "Unavailable state required.",
  );
  assert(panel.includes("CIVIC_ARCHIVE_NO_MATCH_MESSAGE"), "Filtered empty state required.");
  assert(panel.includes("Clear Filters"), "Filtered empty state must offer Clear Filters.");
  assert(panel.includes("Adjust Search"), "Filtered empty state must offer Adjust Search.");
  assert(
    !panel.includes("The Civic Archive is being prepared."),
    "Panel must not show global empty placeholder.",
  );
  assert(
    !panel.includes("0 archived initiatives"),
    "Panel must not show zero aggregates on failure.",
  );
  assert(
    !miniCard.includes("visually-hidden"),
    "Archive mini card must render title once without hidden duplicate.",
  );
  assert(
    miniCard.includes("/civic-archive/"),
    "Archive mini cards must link to civic archive detail route.",
  );
  assert(
    css.includes(".civic-archive-results__viewport"),
    "Results must use a horizontal viewport.",
  );
  assert(css.includes("flex-wrap: nowrap"), "Results track must not wrap into additional rows.");
  assert(
    panel.includes("CivicArchiveHorizontalResults"),
    "Results panel must render horizontal collection.",
  );
  assert(
    experience.includes("if (!hasSubmittedSearch)"),
    "Search experience must remain idle until explicit search.",
  );
  assert(pageCss.includes("scroll-margin-top"), "Results heading must account for sticky header.");
}

function verifyApiClient(): void {
  console.log("4. Archive API client");

  const api = readRepoFile("apps/web/src/features/public-civic-archive/api.ts");
  assert(api.includes('from "../../lib/api-client"'), "Archive API must use shared API base URL.");
  assert(!api.includes('"http://localhost:4000"'), "Archive API must not hardcode localhost.");
}

async function verifyArchiveSearchFlow(): Promise<void> {
  console.log("5. Archive search flow and filters");

  const isolation = await activateVerificationDatabaseIsolationAsync("TASK-107B");

  try {
    assertVerificationDatabaseIsolated();

    const { listCivicArchiveLifecycleRecords } =
      await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

    const publicBefore = await listCivicArchiveLifecycleRecords();
    assert(
      !publicBefore.some((record) => record.title.includes("TASK-107")),
      "Public archive index must exclude verification fixtures.",
    );

    const fixture = await seedCivicArchiveVerificationFixture({
      steward,
      author,
      verificationRunId: isolation.runId,
      verificationTask: "TASK-107B",
    });

    const publicAfterSeed = await listCivicArchiveLifecycleRecords();
    assert(
      !publicAfterSeed.some((record) => record.initiativeId === fixture.initiativeId),
      "Public archive index must exclude seeded verification fixtures.",
    );

    const query = {
      includeVerificationFixtures: true,
      verificationRunId: isolation.runId,
    } as const;

    const unfiltered = await listCivicArchiveLifecycleRecords(query);
    assert(
      unfiltered.some((record) => record.initiativeId === fixture.initiativeId),
      "Isolated archive index must return fixture record.",
    );

    const titleSearch = await listCivicArchiveLifecycleRecords({
      ...query,
      search: fixture.title,
    });
    assert(
      titleSearch.some((record) => record.initiativeId === fixture.initiativeId),
      "Title search must return fixture record.",
    );

    const countryFilter = await listCivicArchiveLifecycleRecords({
      ...query,
      country: "CA",
    });
    assert(
      countryFilter.some((record) => record.initiativeId === fixture.initiativeId),
      "Country filter must return fixture record.",
    );

    const regionFilter = await listCivicArchiveLifecycleRecords({
      ...query,
      country: "CA",
      region: "CA-BC",
    });
    assert(
      regionFilter.some((record) => record.initiativeId === fixture.initiativeId),
      "Region filter must return fixture record.",
    );

    const communityFilter = await listCivicArchiveLifecycleRecords({
      ...query,
      country: "CA",
      region: "CA-BC",
      community: "16735",
    });
    assert(
      communityFilter.some((record) => record.initiativeId === fixture.initiativeId),
      "Community code filter must resolve to archive community label.",
    );

    const wrongCountry = await listCivicArchiveLifecycleRecords({
      ...query,
      country: "US",
    });
    assert(
      !wrongCountry.some((record) => record.initiativeId === fixture.initiativeId),
      "Incorrect country filter must exclude fixture record.",
    );

    const perInitiative = (
      await listCivicArchiveLifecycleRecords({
        ...query,
        search: fixture.title,
      })
    ).filter((record) => record.initiativeId === fixture.initiativeId);
    assert(
      perInitiative.length === 1,
      "Archive index must return one card per initiative lifecycle.",
    );
  } finally {
    const { removeVerificationFixturesForRun } =
      await import("../modules/public-civic-archive/public-civic-archive.store.js");
    removeVerificationFixturesForRun(isolation.runId);
    await isolation.dispose();
  }
}

async function main(): Promise<void> {
  verifyCenteredLayout();
  verifyFilterPanel();
  verifyResultsPanel();
  verifyApiClient();
  await verifyArchiveSearchFlow();
  console.log("\nTASK-107 verify:civic-archive-results-experience PASS");
}

void runVerificationScript(main);
