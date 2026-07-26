/**
 * TASK-107C — Civic Archive idle initial state and horizontal search results verification.
 * Run: npm run verify:civic-archive-idle-horizontal-results
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import {
  seedMultipleCivicArchiveVerificationFixtures,
  TASK107C_FIXTURE_TITLE_PREFIX,
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
  participantId: "member-archive-horizontal-author",
  displayName: "Archive Horizontal Author",
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyIdleSearchModel(): void {
  console.log("1. Idle search model and horizontal results UI");

  const experience = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveSearchExperience.tsx",
  );
  const panel = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveResultsPanel.tsx",
  );
  const filters = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveFiltersForm.tsx",
  );
  const horizontal = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveHorizontalResults.tsx",
  );
  const miniCard = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/PublicArchiveInitiativeMiniCard.tsx",
  );
  const css = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/civic-archive-results.css",
  );
  const query = readRepoFile("apps/web/src/features/public-civic-archive/civic-archive-query.ts");
  const pageCss = readRepoFile("apps/web/src/app/civic-archive/civic-archive-page.css");

  assert(
    experience.includes("hasSubmittedSearch"),
    "Search experience must track submitted search.",
  );
  assert(
    experience.includes("if (!hasSubmittedSearch)"),
    "Search experience must skip API requests until a search is submitted.",
  );
  assert(
    experience.includes("hasDraftSearchCriteria"),
    "Search experience must validate draft criteria before submitting.",
  );
  assert(
    experience.includes("CIVIC_ARCHIVE_EMPTY_SEARCH_MESSAGE"),
    "Search experience must block empty submissions with approved feedback.",
  );
  assert(
    experience.includes("useState(false)"),
    "Search experience must not start in loading state.",
  );
  assert(
    query.includes('CivicArchiveResultsStatus = "idle"'),
    "Query helpers must define idle status.",
  );
  assert(
    panel.includes("CIVIC_ARCHIVE_IDLE_INSTRUCTION"),
    "Results panel must render idle instructional copy.",
  );
  assert(
    panel.includes("CIVIC_ARCHIVE_NO_MATCH_MESSAGE"),
    "Results panel must render approved no-match copy.",
  );
  assert(
    !panel.includes("The Civic Archive is being prepared."),
    "Results panel must not show global empty placeholder.",
  );
  assert(
    !panel.includes("archived initiatives"),
    "Results panel must not render aggregate geography counts.",
  );
  assert(
    filters.includes("civic-archive-page__empty-search-feedback"),
    "Filters must expose amber empty-search feedback.",
  );
  assert(pageCss.includes("#df9815"), "Empty-search feedback must use approved amber color.");
  assert(
    horizontal.includes("Previous archive records"),
    "Horizontal controls must label previous navigation accessibly.",
  );
  assert(
    horizontal.includes("Next archive records"),
    "Horizontal controls must label next navigation accessibly.",
  );
  assert(
    css.includes(".civic-archive-results__viewport"),
    "Results CSS must expose horizontal viewport.",
  );
  assert(css.includes("flex-wrap: nowrap"), "Results track must stay on one horizontal row.");
  assert(
    !css.includes("grid-template-columns: repeat(3"),
    "Results must not use a wrapping vertical grid.",
  );
  assert(
    miniCard.includes("/initiative.webp"),
    "Mini archive card must use /initiative.webp fallback.",
  );
  assert(
    miniCard.includes("/civic-archive/"),
    "Mini archive card must link to civic archive detail route.",
  );
  assert(!miniCard.includes("visually-hidden"), "Mini archive card must render title once.");
}

async function verifyHorizontalSearchRuntime(): Promise<void> {
  console.log("2. Horizontal search runtime and fixture isolation");

  const isolation = activateVerificationDatabaseIsolation("TASK-107C");

  try {
    assertVerificationDatabaseIsolated();

    const { listCivicArchiveLifecycleRecords } =
      await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

    const publicBefore = listCivicArchiveLifecycleRecords();
    assert(
      !publicBefore.some((record) => record.title.includes("TASK-107")),
      "Public archive index must exclude verification fixtures before opt-in.",
    );

    const fixtures = await seedMultipleCivicArchiveVerificationFixtures({
      steward,
      author,
      verificationRunId: isolation.runId,
      verificationTask: "TASK-107C",
      titlePrefix: TASK107C_FIXTURE_TITLE_PREFIX,
      count: 5,
    });

    assert(fixtures.length === 5, "Verification must seed five archive fixtures.");
    assert(
      new Set(fixtures.map((fixture) => fixture.initiativeId)).size === 5,
      "Horizontal fixtures must produce five unique initiatives.",
    );

    const publicAfterSeed = listCivicArchiveLifecycleRecords();
    assert(
      !publicAfterSeed.some((record) => record.title.includes(TASK107C_FIXTURE_TITLE_PREFIX)),
      "Public archive index must exclude seeded verification fixtures.",
    );

    const query = {
      includeVerificationFixtures: true,
      verificationRunId: isolation.runId,
      search: "TASK-107C Horizontal Results",
    } as const;

    const results = listCivicArchiveLifecycleRecords(query);
    assert(results.length === 5, "Submitted search must return five matching archive records.");
    assert(
      new Set(results.map((record) => record.initiativeId)).size === 5,
      "Search results must remain unique per initiative.",
    );

    const unrelated = listCivicArchiveLifecycleRecords({
      ...query,
      search: "definitely-unrelated-archive-term-107c",
    });
    assert(unrelated.length === 0, "Unrelated search must return no records.");
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
    !afterRestore.some((record) => record.title.includes(TASK107C_FIXTURE_TITLE_PREFIX)),
    "Verification fixtures must not remain in public archive index after cleanup.",
  );
}

function verifyNoRuntimeFixtureSources(): void {
  console.log("3. Runtime fixture source exclusion");

  const experience = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveSearchExperience.tsx",
  );
  const panel = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveResultsPanel.tsx",
  );
  const api = readRepoFile("apps/web/src/features/public-civic-archive/api.ts");

  assert(
    !experience.includes("TASK-107"),
    "Search experience must not embed verification fixtures.",
  );
  assert(!panel.includes("TASK-107"), "Results panel must not embed verification fixtures.");
  assert(!api.includes("TASK-107"), "Archive API client must not embed verification fixtures.");
}

async function main(): Promise<void> {
  verifyIdleSearchModel();
  await verifyHorizontalSearchRuntime();
  verifyNoRuntimeFixtureSources();
  console.log("\nTASK-107C verify:civic-archive-idle-horizontal-results PASS");
}

void runVerificationScript(main);
