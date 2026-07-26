/**
 * TASK-107B — Civic Archive runtime search and fixture isolation verification.
 * Run: npm run verify:civic-archive-runtime-search
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import {
  TASK107B_FIXTURE_TITLE,
  seedCivicArchiveVerificationFixture,
} from "./civic-archive-verification-fixture.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";
import {
  activateVerificationDatabaseIsolation,
  assertVerificationDatabaseIsolated,
} from "./verification-database-isolation.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const author: RequestIdentity = {
  participantId: "member-archive-runtime-author",
  displayName: "Archive Runtime Author",
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyStaticIsolationAndSearchModel(): void {
  console.log("A. Static fixture isolation and search model");

  const page = readRepoFile("apps/web/src/app/civic-archive/page.tsx");
  const experience = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveSearchExperience.tsx",
  );
  const filters = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveFiltersForm.tsx",
  );
  const card = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/PublicArchiveInitiativeMiniCard.tsx",
  );
  const query = readRepoFile("apps/web/src/features/public-civic-archive/civic-archive-query.ts");
  const store = readRepoFile(
    "apps/api/src/modules/public-civic-archive/public-civic-archive.store.ts",
  );

  assert(page.includes("CivicArchiveSearchExperience"), "Page must use client search experience.");
  assert(experience.includes("draftFilters"), "Search experience must separate draft filters.");
  assert(experience.includes("appliedFilters"), "Search experience must track applied filters.");
  assert(
    experience.includes("if (!hasSubmittedSearch)"),
    "Search experience must not fetch archive records on initial load.",
  );
  assert(
    experience.includes("hasDraftSearchCriteria"),
    "Search experience must validate criteria.",
  );
  assert(experience.includes("AbortController"), "Search experience must abort stale requests.");
  assert(
    experience.includes("buildCivicArchiveQueryKey"),
    "Search experience must key requests by filters.",
  );
  assert(filters.includes("onSearch"), "Filters must submit through explicit Search handler.");
  assert(!card.includes("visually-hidden"), "Archive card must not duplicate hidden title text.");
  assert(card.includes("civic-archive-mini-card"), "Archive mini card must use one link wrapper.");
  assert(query.includes("countryCode"), "Canonical query contract must use countryCode.");
  assert(query.includes("archiveYear"), "Canonical query contract must use archiveYear.");
  assert(
    store.includes("isPublicVerificationFixtureRecord"),
    "Store must exclude verification fixtures publicly.",
  );
}

async function verifyRuntimeFixtureIsolation(): Promise<void> {
  console.log("B. Runtime fixture isolation");

  const isolation = activateVerificationDatabaseIsolation("TASK-107B");

  try {
    assertVerificationDatabaseIsolated();

    const { listCivicArchiveLifecycleRecords } =
      await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

    const publicBefore = listCivicArchiveLifecycleRecords();
    assert(
      !publicBefore.some((record) => record.title.includes("TASK-107B")),
      "Public index must not expose verification fixtures before opt-in.",
    );

    const fixture = await seedCivicArchiveVerificationFixture({
      steward,
      author,
      verificationRunId: isolation.runId,
      verificationTask: "TASK-107B",
    });

    const publicAfterSeed = listCivicArchiveLifecycleRecords();
    assert(
      !publicAfterSeed.some((record) => record.initiativeId === fixture.initiativeId),
      "Public index must exclude verification fixtures by default.",
    );

    const isolated = listCivicArchiveLifecycleRecords({
      includeVerificationFixtures: true,
      verificationRunId: isolation.runId,
    });
    assert(
      isolated.some((record) => record.initiativeId === fixture.initiativeId),
      "Isolated verification query must return the fixture for the active run.",
    );
  } finally {
    const { removeVerificationFixturesForRun } =
      await import("../modules/public-civic-archive/public-civic-archive.store.js");
    removeVerificationFixturesForRun(isolation.runId);
    isolation.restore();
  }

  const { listCivicArchiveLifecycleRecords } =
    await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");
  const afterRestore = listCivicArchiveLifecycleRecords();
  assert(
    !afterRestore.some((record) => record.title === TASK107B_FIXTURE_TITLE),
    "Public archive index must not expose verification fixtures after cleanup.",
  );
}

async function verifyRuntimeSearchFilters(): Promise<void> {
  console.log("C. Runtime search filters");

  const isolation = activateVerificationDatabaseIsolation("TASK-107B");

  try {
    assertVerificationDatabaseIsolated();

    const { listCivicArchiveLifecycleRecords } =
      await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

    const fixture = await seedCivicArchiveVerificationFixture({
      steward,
      author,
      verificationRunId: isolation.runId,
      verificationTask: "TASK-107B",
    });

    const query = {
      includeVerificationFixtures: true,
      verificationRunId: isolation.runId,
    } as const;

    const unfiltered = listCivicArchiveLifecycleRecords(query);
    assert(
      unfiltered.some((record) => record.initiativeId === fixture.initiativeId),
      "Unfiltered isolated query must return fixture.",
    );

    const titleSearch = listCivicArchiveLifecycleRecords({
      ...query,
      search: fixture.title,
    });
    assert(titleSearch.length === 1, "Exact title search must return one fixture record.");

    const unrelated = listCivicArchiveLifecycleRecords({
      ...query,
      search: "definitely-unrelated-archive-term-107b",
    });
    assert(unrelated.length === 0, "Unrelated search must return empty results.");

    const countryFilter = listCivicArchiveLifecycleRecords({
      ...query,
      country: "CA",
    });
    assert(
      countryFilter.some((record) => record.initiativeId === fixture.initiativeId),
      "Country filter must return fixture.",
    );

    const wrongCountry = listCivicArchiveLifecycleRecords({
      ...query,
      country: "US",
    });
    assert(
      !wrongCountry.some((record) => record.initiativeId === fixture.initiativeId),
      "Wrong country must exclude fixture.",
    );

    const regionFilter = listCivicArchiveLifecycleRecords({
      ...query,
      country: "CA",
      region: "CA-BC",
    });
    assert(
      regionFilter.some((record) => record.initiativeId === fixture.initiativeId),
      "Region filter must return fixture.",
    );

    const communityFilter = listCivicArchiveLifecycleRecords({
      ...query,
      country: "CA",
      region: "CA-BC",
      community: "16735",
    });
    assert(
      communityFilter.some((record) => record.initiativeId === fixture.initiativeId),
      "Community code filter must return fixture.",
    );

    const activityFilter = listCivicArchiveLifecycleRecords({
      ...query,
      activityArea: fixture.activityArea,
    });
    assert(
      activityFilter.some((record) => record.initiativeId === fixture.initiativeId),
      "Activity area filter must return fixture.",
    );
  } finally {
    const { removeVerificationFixturesForRun } =
      await import("../modules/public-civic-archive/public-civic-archive.store.js");
    removeVerificationFixturesForRun(isolation.runId);
    isolation.restore();
  }
}

async function main(): Promise<void> {
  verifyStaticIsolationAndSearchModel();
  await verifyRuntimeFixtureIsolation();
  await verifyRuntimeSearchFilters();
  console.log("\nTASK-107B verify:civic-archive-runtime-search PASS");
}

void runVerificationScript(main);
