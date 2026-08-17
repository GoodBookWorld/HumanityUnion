/**
 * TASK-107D — Civic Archive real MongoDB / runtime data source verification.
 * Run: npm run verify:civic-archive-real-data-source
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import {
  seedCivicArchiveVerificationFixture,
  seedMultipleCivicArchiveVerificationFixtures,
  TASK107B_FIXTURE_TITLE,
} from "./civic-archive-verification-fixture.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";
import {
  activateVerificationDatabaseIsolationAsync,
  assertVerificationDatabaseIsolated,
} from "./verification-database-isolation.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyStaticDataSourceGuards(): void {
  console.log("1. Static runtime data source guards");

  const store = readRepoFile(
    "apps/api/src/modules/public-civic-archive/public-civic-archive.store.ts",
  );
  const resolver = readRepoFile(
    "apps/api/src/modules/public-civic-archive/persistence/resolve-public-civic-archive-persistence.ts",
  );
  const query = readRepoFile("apps/web/src/features/public-civic-archive/civic-archive-query.ts");
  const api = readRepoFile("apps/web/src/features/public-civic-archive/api.ts");
  const projection = readRepoFile(
    "apps/api/src/modules/public-civic-archive/public-civic-archive-lifecycle.projection.ts",
  );

  assert(
    store.includes("isPublicVerificationFixtureRecord"),
    "Archive store must exclude verification fixtures with defense-in-depth guard.",
  );
  assert(
    resolver.includes("isMongoConfigured()") && resolver.includes('"mongodb"'),
    "Archive persistence must default to MongoDB when configured.",
  );
  assert(
    !store.includes("TASK-107") && !api.includes("TASK-107"),
    "Runtime archive code must not embed TASK-107 fixture fallbacks.",
  );
  assert(
    query.includes('CIVIC_ARCHIVE_QUERY_SCHEMA_VERSION = "107d"'),
    "Frontend query cache key must include schema version.",
  );
  assert(
    projection.includes("resolvePublicArchiveImageUrl"),
    "Archive projection must sanitize image URLs before returning cards.",
  );
}

async function verifyRealEligibleCanadianRecords(): Promise<void> {
  console.log("2. Real eligible Canadian archive records");

  const isolation = await activateVerificationDatabaseIsolationAsync("TASK-107D");

  try {
    assertVerificationDatabaseIsolated();

    const { listCivicArchiveLifecycleRecords } =
      await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

    await seedMultipleCivicArchiveVerificationFixtures({
      steward,
      author: {
        participantId: "member-real-archive-author",
        displayName: "Real Archive Author",
      },
      verificationRunId: isolation.runId,
      verificationTask: "TASK-107D",
      titlePrefix: "Canadian Archive Eligible Record",
      count: 3,
      markAsVerificationFixture: false,
    });

    const results = await listCivicArchiveLifecycleRecords({ country: "CA" });
    assert(results.length === 3, "Country=CA must return three real eligible archive records.");
    assert(
      results.every((record) => !record.title.includes("TASK-107")),
      "Real archive search must not return TASK-107 fixture titles.",
    );
    assert(
      new Set(results.map((record) => record.initiativeId)).size === 3,
      "Real archive search must return three unique initiatives.",
    );
  } finally {
    const { removeVerificationFixturesForRun, removePublicVerificationFixtureRecords } =
      await import("../modules/public-civic-archive/public-civic-archive.store.js");
    removeVerificationFixturesForRun(isolation.runId);
    removePublicVerificationFixtureRecords();
    await isolation.dispose();
  }
}

async function verifyNonEligiblePublicationExcluded(): Promise<void> {
  console.log("3. Non-eligible publication exclusion");

  const isolation = await activateVerificationDatabaseIsolationAsync("TASK-107D");

  try {
    assertVerificationDatabaseIsolated();

    const { publishInitiative, createInitiativeDraft } =
      await import("../modules/initiatives/initiative.service.js");
    const { listCivicArchiveLifecycleRecords } =
      await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

    const draft = createInitiativeDraft(steward, {
      title: "Canadian Public Proposal Without Archive",
      description: "Published initiative without archive lifecycle.",
      communitySlug: "nelson-community-garden",
      activityArea: "Environment",
    });
    publishInitiative(steward, draft.initiativeId);

    const results = await listCivicArchiveLifecycleRecords({ country: "CA" });
    assert(
      !results.some((record) => record.initiativeId === draft.initiativeId),
      "Published but non-archived initiative must not appear in civic archive index.",
    );
  } finally {
    await isolation.dispose();
  }
}

async function verifyFixtureExclusion(): Promise<void> {
  console.log("4. Fixture exclusion");

  const isolation = await activateVerificationDatabaseIsolationAsync("TASK-107D");

  try {
    assertVerificationDatabaseIsolated();

    const { listCivicArchiveLifecycleRecords } =
      await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

    const fixture = await seedCivicArchiveVerificationFixture({
      steward,
      author: {
        participantId: "member-fixture-exclusion-author",
        displayName: "Fixture Exclusion Author",
      },
      verificationRunId: isolation.runId,
      verificationTask: "TASK-107D",
      title: TASK107B_FIXTURE_TITLE,
    });

    const publicResults = await listCivicArchiveLifecycleRecords({ country: "CA" });
    assert(
      !publicResults.some((record) => record.initiativeId === fixture.initiativeId),
      "Marked verification fixture must be excluded from public archive index.",
    );
  } finally {
    const { removeVerificationFixturesForRun } =
      await import("../modules/public-civic-archive/public-civic-archive.store.js");
    removeVerificationFixturesForRun(isolation.runId);
    await isolation.dispose();
  }
}

async function verifyImageFallback(): Promise<void> {
  console.log("5. Image fallback sanitization");

  const projection = readRepoFile(
    "apps/api/src/modules/public-civic-archive/public-civic-archive-lifecycle.projection.ts",
  );
  const miniCard = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/PublicArchiveInitiativeMiniCard.tsx",
  );

  assert(
    projection.includes("resolvePublicArchiveImageUrl"),
    "Archive projection must sanitize image URLs.",
  );
  assert(
    miniCard.includes("/images/initiatives/initiative-default.webp"),
    "Archive mini card must fall back to /images/initiatives/initiative-default.webp.",
  );
}

function verifyCacheSchemaVersion(): void {
  console.log("6. Cache schema version");

  const query = readRepoFile("apps/web/src/features/public-civic-archive/civic-archive-query.ts");
  assert(
    query.includes("107d"),
    "Civic archive query cache key must include TASK-107D schema version.",
  );
}

async function main(): Promise<void> {
  verifyStaticDataSourceGuards();
  await verifyRealEligibleCanadianRecords();
  await verifyNonEligiblePublicationExcluded();
  await verifyFixtureExclusion();
  await verifyImageFallback();
  verifyCacheSchemaVersion();
  console.log("\nTASK-107D verify:civic-archive-real-data-source PASS");
}

void runVerificationScript(main);
