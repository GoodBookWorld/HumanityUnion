/**
 * ES.11 — authoritative revision inventory, readiness semantics, activation convergence.
 * No provider calls and no live Mongo writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative, LanguageLocalizationReadinessReport } from "@hu/types";
import {
  deriveLanguageLocalizationReadinessState,
  derivePwaCivicReadinessState,
  emptyLanguageLocalizationCountBucket,
  emptyPwaCivicCoverageScalars,
} from "@hu/types";

import { deriveLocalizationProgress } from "../../../../../apps/web/src/features/administration/admin-languages-localization-progress.ts";
import { ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { emptyPendingDomains } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  convergeFailedActivationWhenAuthoritativeReady,
  isEligibleFailedActivationConvergence,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.service.js";
import {
  getLanguageActivationJobById,
  saveLanguageActivationJob,
  setLanguageActivationJobForceMemoryForTests,
  resetLanguageActivationJobStoreForTests,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import type { LanguageActivationJobRecord } from "@hu/types";
import { applyLiveResidualBucket } from "../../../src/modules/language/live-residual-ct-coverage.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
  resetContentTranslationWarmMemoryForTests,
  setContentTranslationWarmForceMemoryForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import {
  materializeCanonicalInitialInitiativeRevisions,
  resetCanonicalRevisionInventoryForTests,
} from "../../../src/modules/initiative-version-revision/materialize-canonical-initial-revisions.js";
import {
  createRevision,
  getLatestRevisionForInitiative,
  listRevisionsByInitiative,
  syncInitiativeVersionRevisionStoreAfterMongoHydrate,
} from "../../../src/modules/initiative-version-revision/initiative-version-revision.store.js";
import { buildInitialInitiativeVersionRevision } from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import {
  replaceRecordMap,
  upsertRecordMap,
} from "../../../src/infrastructure/mongodb/mongo-snapshot-store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repo, relativePath), "utf8");
}

function buildInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: "es11-steward",
    title: "Fixture",
    description: "Fixture",
    status: "proposal",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: {
      activityArea: "Environment",
      communitySlug: "fixture-community",
      category: "Environment",
    },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as Initiative;
}

function readyBuckets() {
  return {
    ...emptyLanguageLocalizationCountBucket(),
    current: 4,
  };
}

function derive(input: {
  readonly current?: number;
  readonly missing?: number;
  readonly stale?: number;
  readonly invalid?: number;
  readonly failed?: number;
  readonly pending?: number;
  readonly activeWork?: number;
  readonly preflightBlocked?: number;
  readonly workItemsRequired?: number;
  readonly revisionInventoryReady?: boolean;
}) {
  const ct = {
    ...emptyLanguageLocalizationCountBucket(),
    current: input.current ?? 0,
    missing: input.missing ?? 0,
    stale: input.stale ?? 0,
    invalid: input.invalid ?? 0,
    failed: input.failed ?? 0,
    pending: input.pending ?? 0,
    activeWork: input.activeWork ?? 0,
    preflightBlocked: input.preflightBlocked ?? 0,
    workItemsRequired: input.workItemsRequired ?? 0,
  };
  return deriveLanguageLocalizationReadinessState({
    enabled: true,
    contentTranslationEnabled: true,
    webUiDataReady: true,
    participantWebUiDataReady: true,
    controlledVocabularyPresentationReady: true,
    ct,
    plpMedia: emptyLanguageLocalizationCountBucket(),
    revisionInventoryReady: input.revisionInventoryReady,
  });
}

function readyReport(): LanguageLocalizationReadinessReport {
  const ct = readyBuckets();
  return {
    state: "READY",
    languageDataReady: true,
    ct,
    plpMedia: emptyLanguageLocalizationCountBucket(),
  } as LanguageLocalizationReadinessReport;
}

function failedJob(jobId: string): LanguageActivationJobRecord {
  return {
    jobId,
    locale: "es",
    languageId: "lang-es",
    generation: 1,
    status: "failed",
    domains: emptyPendingDomains(),
    lastError: ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL,
    diagnosticSummary: "job=failed · readiness=BACKFILL_REQUIRED",
    createdAt: "2026-10-03T16:28:01.957Z",
    updatedAt: "2026-10-04T22:28:00.487Z",
    startedAt: "2026-10-03T16:28:02.123Z",
    completedAt: "2026-10-04T22:28:00.487Z",
    createdByParticipantId: null,
    searchEnabledSnapshot: false,
    seoIndexingEnabledSnapshot: false,
  };
}

async function flushWarm(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("ES.11 inventory, readiness, and activation convergence", () => {
  beforeEach(() => {
    setContentTranslationWarmForceMemoryForTests(true);
    resetContentTranslationWarmMemoryForTests();
    resetCanonicalRevisionInventoryForTests();
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
  });

  it("1 — public reads do not create an initial revision", () => {
    const files = [
      "apps/api/src/modules/initiatives/public-initiative.routes.ts",
      "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
      "apps/api/src/modules/initiative-version-revision/public-initiative-version-revision.routes.ts",
    ];
    for (const file of files) {
      assert.equal(read(file).includes("createInitialInitiativeVersionRevision"), false, file);
    }
    const publish = read("apps/api/src/modules/initiatives/initiative.service.ts");
    assert.match(publish, /createInitialInitiativeVersionRevision\(/);
  });

  it("2/3/5 — canonical materialization creates once and keeps an existing revision", async () => {
    const initiative = buildInitiative(`initiative-es11-existing-${Date.now()}`);
    const historical = buildInitialInitiativeVersionRevision(initiative, initiative.stewardId);
    const preserved = {
      ...historical,
      revisionId: `initiative-version-revision-historical-${initiative.initiativeId}`,
      version: 2,
      previousVersion: 1,
    };
    createRevision(preserved);

    const first = await materializeCanonicalInitialInitiativeRevisions({
      initiatives: [initiative],
    });
    await flushWarm();
    assert.equal(first.created, 0);
    assert.equal(getLatestRevisionForInitiative(initiative.initiativeId)?.revisionId, preserved.revisionId);
    assert.equal(listRevisionsByInitiative(initiative.initiativeId).length, 1);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 0);
  });

  it("2/3/10 — missing initial revision is created once and enters the warm flow", async () => {
    const initiative = buildInitiative(`initiative-es11-missing-${Date.now()}`);
    const first = await materializeCanonicalInitialInitiativeRevisions({
      initiatives: [initiative],
    });
    await flushWarm();
    const revision = getLatestRevisionForInitiative(initiative.initiativeId);
    assert.equal(first.created, 1);
    assert.equal(first.converged, true);
    assert.ok(revision);
    assert.equal(revision.version, 1);
    assert.equal(revision.previousVersion, null);
    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.command.sourceRecordId, revision.revisionId);
    assert.equal(pending[0]?.command.reason, "public_mutation");
  });

  it("3/11/24 — a second pass creates no revision and no warm", async () => {
    const initiative = buildInitiative(`initiative-es11-idempotent-${Date.now()}`);
    await materializeCanonicalInitialInitiativeRevisions({ initiatives: [initiative] });
    await flushWarm();
    resetContentTranslationWarmMemoryForTests();
    const second = await materializeCanonicalInitialInitiativeRevisions({
      initiatives: [initiative],
    });
    await flushWarm();
    assert.equal(second.created, 0);
    assert.equal(listRevisionsByInitiative(initiative.initiativeId).length, 1);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 0);
  });

  it("4 — concurrent materialization cannot create duplicate revisions", async () => {
    const initiative = buildInitiative(`initiative-es11-concurrent-${Date.now()}`);
    const [left, right] = await Promise.all([
      materializeCanonicalInitialInitiativeRevisions({ initiatives: [initiative] }),
      materializeCanonicalInitialInitiativeRevisions({ initiatives: [initiative] }),
    ]);
    await flushWarm();
    assert.equal(left.created + right.created, 1);
    assert.equal(listRevisionsByInitiative(initiative.initiativeId).length, 1);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 1);
  });

  it("6/8 — empty memory cannot delete historical revision rows", async () => {
    const store = read("apps/api/src/infrastructure/mongodb/mongo-snapshot-store.ts");
    const upsertStart = store.indexOf("export async function upsertRecordMap");
    const replaceStart = store.indexOf("export async function replaceRecordMap");
    const upsert = store.slice(upsertStart, replaceStart);
    assert.equal(upsert.includes("deleteMany"), false);
    assert.match(upsert, /ids\.length === 0/);
    assert.match(store, /initiativeVersionRevisions[\s\S]*upsertRecordMap/);
    await upsertRecordMap(MONGO_COLLECTIONS.initiativeVersionRevisions, {}, "revisionId");
    await replaceRecordMap(MONGO_COLLECTIONS.initiativeVersionRevisions, {}, "revisionId");
  });

  it("7 — revision store reloads from the hydrated Mongo cache after bootstrap", () => {
    const bootstrap = read("apps/api/src/infrastructure/mongodb/bootstrap-mongo-persistence.ts");
    const hydrateAt = bootstrap.indexOf("hydrateInitiativeVersionRevisionMongoPersistence");
    const syncAt = bootstrap.indexOf("syncInitiativeVersionRevisionStoreAfterMongoHydrate");
    assert.ok(hydrateAt >= 0 && syncAt > hydrateAt);
    const initiative = buildInitiative(`initiative-es11-sync-${Date.now()}`);
    const created = createRevision(buildInitialInitiativeVersionRevision(initiative, "author"));
    syncInitiativeVersionRevisionStoreAfterMongoHydrate();
    assert.equal(getLatestRevisionForInitiative(initiative.initiativeId)?.revisionId, created.revisionId);
  });

  it("9/17/18 — READY waits for inventory and in-flight work is not 100%", () => {
    assert.equal(
      derive({ current: 6, revisionInventoryReady: false }),
      "DATA_NOT_READY",
    );
    assert.equal(derive({ current: 6, revisionInventoryReady: true }), "READY");
    assert.equal(derive({ current: 5, activeWork: 1 }), "BACKFILL_IN_PROGRESS");
    const progress = deriveLocalizationProgress({
      jobStatus: null,
      brandStatus: null,
      brandNextAttemptAt: null,
      brandLastTransientFailure: null,
      terminologyStatus: null,
      terminologyNextAttemptAt: null,
      terminologyLastTransientFailure: null,
      webUi: null,
      cvChecked: 0,
      cvMissing: 0,
      cvReady: true,
      ctCurrent: 5,
      ctRemaining: 0,
      ctActiveWork: 1,
      ctPreflightBlocked: 0,
      plpCurrent: 0,
      plpRemaining: 0,
      publishedRequired: 0,
      publishedMissing: 0,
      publishedDataReady: true,
      readinessState: "BACKFILL_IN_PROGRESS",
    });
    assert.ok(progress.percent < 100);
    assert.notEqual(progress.percent, 100);
  });

  it("12/13/14/15/16 — active work, retry work, and preflight stay distinct", () => {
    const active = emptyLanguageLocalizationCountBucket();
    applyLiveResidualBucket(active, "ACTIVE_WORK");
    assert.equal(active.activeWork, 1);
    assert.equal(active.pending, 0);
    assert.equal(active.workItemsRequired, 0);
    assert.equal(derive({ current: 1, activeWork: 1 }), "BACKFILL_IN_PROGRESS");

    const missing = emptyLanguageLocalizationCountBucket();
    applyLiveResidualBucket(missing, "RETRY_READY_MISSING");
    assert.equal(missing.missing, 1);
    assert.equal(missing.workItemsRequired, 1);
    assert.equal(derive({ missing: 1, workItemsRequired: 1 }), "BACKFILL_REQUIRED");

    const blocked = emptyLanguageLocalizationCountBucket();
    applyLiveResidualBucket(blocked, "SOURCE_OR_PREFLIGHT_BLOCKED");
    assert.equal(blocked.preflightBlocked, 1);
    assert.equal(blocked.workItemsRequired, 0);
    assert.equal(blocked.pending, 0);
    assert.equal(derive({ current: 3, preflightBlocked: 1 }), "DEGRADED");

    const admin = read(
      "apps/web/src/features/administration/components/AdminLanguagesSection.tsx",
    );
    assert.match(admin, /Active work=/);
    assert.match(admin, /preflightBlocked > 0 \? ` · Not actionable=/);
    assert.equal(admin.includes("pending > 0 ? ` · Not actionable="), false);
  });

  it("16 — persisted reading uses the same distinction", () => {
    const base = {
      ...emptyPwaCivicCoverageScalars(),
      current: 4,
      measuredKindCount: 1,
      unmeasuredKindCount: 0,
      coverageMeasurement: "complete" as const,
    };
    const shared = {
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
    };
    assert.equal(
      derivePwaCivicReadinessState({
        ...shared,
        coverage: { ...base, activeWork: 2 },
      }),
      "BACKFILL_IN_PROGRESS",
    );
    assert.equal(
      derivePwaCivicReadinessState({
        ...shared,
        coverage: { ...base, current: 0, missing: 1, workItemsRequired: 1 },
      }),
      "BACKFILL_REQUIRED",
    );
    assert.equal(
      derivePwaCivicReadinessState({
        ...shared,
        coverage: { ...base, missing: 1, workItemsRequired: 1 },
      }),
      "DEGRADED",
    );
    assert.equal(
      derivePwaCivicReadinessState({
        ...shared,
        coverage: { ...base, preflightBlocked: 2 },
      }),
      "DEGRADED",
    );
    assert.equal(
      derivePwaCivicReadinessState({
        ...shared,
        coverage: base,
        revisionInventoryReady: false,
      }),
      "DEGRADED",
    );
    assert.equal(
      derivePwaCivicReadinessState({
        ...shared,
        coverage: base,
        revisionInventoryReady: true,
      }),
      "READY",
    );
  });

  it("19/20/21/22 — eligible failed activation completes once without a new generation", async () => {
    const job = failedJob(`lang-act-es11-${Date.now()}`);
    await saveLanguageActivationJob(job);
    const readiness = readyReport();
    assert.equal(isEligibleFailedActivationConvergence(job, readiness, "es"), true);
    const completed = await convergeFailedActivationWhenAuthoritativeReady("es", readiness);
    assert.ok(completed);
    assert.equal(completed.status, "completed");
    assert.equal(completed.generation, 1);
    assert.equal(completed.jobId, job.jobId);
    assert.equal(completed.lastError, ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL);
    assert.match(completed.diagnosticSummary ?? "", /converged_from=failed/);
    const again = await convergeFailedActivationWhenAuthoritativeReady("es", readiness);
    assert.equal(again?.status, "completed");
    assert.equal(again?.updatedAt, completed.updatedAt);
    const stored = await getLanguageActivationJobById(job.jobId);
    assert.equal(stored?.status, "completed");
    assert.equal(stored?.generation, 1);
  });

  it("21 — a failed job that was not automatic exhaustion stays failed", async () => {
    const job = {
      ...failedJob(`lang-act-es11-other-${Date.now()}`),
      lastError: "Brand provider failed.",
    };
    await saveLanguageActivationJob(job);
    const result = await convergeFailedActivationWhenAuthoritativeReady("es", readyReport());
    assert.equal(result, null);
    const stored = await getLanguageActivationJobById(job.jobId);
    assert.equal(stored?.status, "failed");
    assert.equal(stored?.generation, job.generation);
  });

  it("23 — no new polling timer and no Spanish-only branch", () => {
    const materialize = read(
      "apps/api/src/modules/initiative-version-revision/materialize-canonical-initial-revisions.ts",
    );
    const index = read("apps/api/src/index.ts");
    assert.equal(materialize.includes("setInterval"), false);
    assert.equal(materialize.includes("setTimeout"), false);
    assert.equal(/locale\s*===\s*["']es["']/.test(materialize), false);
    assert.match(index, /materializeCanonicalInitialInitiativeRevisions/);
    assert.equal(index.includes("setInterval"), false);
    const consumer = read("apps/api/src/modules/language/content-translation-warm-consumer.ts");
    assert.match(consumer, /wakeReadinessAfterContentTranslationPublish/);
    const driver = read("apps/api/src/modules/language/localization-reconciliation-driver.ts");
    assert.match(driver, /convergeFailedActivationWhenAuthoritativeReady/);
    const service = read(
      "apps/api/src/modules/language/language-localization-activation/language-activation-job.service.ts",
    );
    const start = service.indexOf("export async function convergeFailedActivationWhenAuthoritativeReady");
    const end = service.indexOf("export async function syncRunningActivationAfterPlpPublish");
    const converge = service.slice(start, end);
    assert.equal(/gemini|enqueueContentTranslation|setInterval|setTimeout/.test(converge), false);
  });
});
