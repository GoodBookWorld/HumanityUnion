/**
 * Empty trusted explanations are not a canonical version.
 * A false same-version stale row reopens once. Real A→B still replaces the work.
 * No provider is called for an unusable source.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  emptyLanguageLocalizationCountBucket,
  MEDIA_PLP_ENTITY_TYPE,
  plpBuildWorkKey,
  type LanguageLocalizationReadinessReport,
  type MediaResource,
} from "@hu/types";

import {
  ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL,
  classifyActivationAutomaticProgress,
  deriveActivationJobStatus,
  emptyPendingDomains,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  ensureLanguageRegistrySeeded,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/language-registry/language-registry.repository.js";
import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { resetMediaResourcesMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import {
  setMediaResourceForceMemoryForTests,
  upsertMediaResource,
} from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import {
  fingerprintMediaPlpCanonicalVersion,
  isUsablePlpCanonicalPresentation,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import {
  findCurrentPublishedPresentation,
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/persistence/repository.js";
import {
  resolveTrustedMediaEditorialCanonical,
  trustedExplanationCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/trusted-editorial-source.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalTrustedPresentation,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import {
  kickPlpAutoBuildDrain,
  resetPlpBuildRequestQueueForTests,
  setPlpBuildRequestProcessor,
  settlePlpAutoBuildDrainForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/build-request-queue.js";
import { processPlpBuildRequest } from "../../../src/modules/language/published-localized-presentation/universal/process-plp-build-request.js";
import {
  usePlpSchedulerManualTimersForTests,
  plpSafetySweepArmedForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-scheduler.js";
import {
  listPlpAutoBuildWorkForTests,
  PLP_CANONICAL_SOURCE_UNUSABLE_REASON,
  PLP_SAME_VERSION_STALE_RECOVERY_GENERATION,
  PLP_UNUSABLE_CANONICAL_DEFER_MS,
  putPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildNowMsForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
  type PlpAutoBuildWorkRecord,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import { continueTrustedMediaPlpIfCanonicalChanged } from "../../../src/modules/language/published-localized-presentation/universal/trusted-canonical-plp-continuation.js";

const NOW = Date.parse("2026-10-06T20:00:00.000Z");
const EMPTY_FINGERPRINT = "v-4f53cda18c2baa0c";
const EXPLANATION_A = "Civic explanation alpha for the empty canonical regression.";
const EXPLANATION_B = "Civic explanation beta after the canonical source changed.";
const FIXTURE_ID = "plp-empty-canonical-fixture";
const NEIGHBOR_ID = "plp-empty-canonical-neighbor";
const MISSING_ID = "plp-empty-canonical-missing";

let providerCalls = 0;

function trustedRow(id: string, description: string | null): MediaResource {
  const now = "2026-10-06T18:51:15.000Z";
  return {
    id,
    resourceType: "TRUSTED_MEDIA",
    scopeType: "WORLD",
    countryCode: null,
    name: id,
    logoLabel: "T",
    logoUrl: null,
    websiteUrl: `https://example.com/${id}`,
    rssUrl: null,
    categoryId: "international-wire-service",
    description,
    secondaryText: null,
    language: null,
    providerId: null,
    active: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function workFor(input: {
  entityId: string;
  version: string;
  status?: PlpAutoBuildWorkRecord["status"];
  attempts?: number;
  failureCode?: PlpAutoBuildWorkRecord["failureCode"];
  retryable?: boolean | null;
  recoveryGeneration?: string | null;
  lastError?: string | null;
}): PlpAutoBuildWorkRecord {
  const now = new Date(NOW).toISOString();
  return {
    workKey: plpBuildWorkKey({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: input.entityId,
      locale: "uk",
    }),
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
    entityId: input.entityId,
    locale: "uk",
    canonicalVersion: input.version,
    contentRevision: 1,
    trigger: "ADMIN_REBUILD",
    status: input.status ?? "pending",
    attempts: input.attempts ?? 0,
    maxAttempts: 5,
    lastError: input.lastError ?? null,
    failureCode: input.failureCode ?? null,
    failureStage: input.failureCode ? "validate" : null,
    retryable: input.retryable ?? null,
    enqueuedAt: now,
    claimedAt: null,
    completedAt: null,
    updatedAt: now,
    lastFailureAt: input.failureCode ? now : null,
    nextAttemptAt: null,
    recoveryGeneration: input.recoveryGeneration ?? null,
    batchCheckpoint: null,
  };
}

function ownersReady() {
  const domains = emptyPendingDomains();
  return {
    ...domains,
    brand: { ...domains.brand, status: "ready" as const },
    terminology: { ...domains.terminology, status: "ready" as const },
    controlledVocabulary: { ...domains.controlledVocabulary, status: "ready" as const },
    webUi: {
      ...domains.webUi,
      status: "ready" as const,
      dataReady: true,
      preparationPhase: "ready" as const,
    },
  };
}

function readiness(plpWorkItems: number) {
  return {
    engineReady: true,
    languageDataReady: false,
    state: "BACKFILL_REQUIRED",
    ct: emptyLanguageLocalizationCountBucket(),
    plpMedia: {
      ...emptyLanguageLocalizationCountBucket(),
      missing: plpWorkItems,
      workItemsRequired: plpWorkItems,
    },
  } as LanguageLocalizationReadinessReport;
}

async function settle() {
  kickPlpAutoBuildDrain();
  await settlePlpAutoBuildDrainForTests();
}

beforeEach(async () => {
  providerCalls = 0;
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildNowMsForTests(NOW);
  usePlpSchedulerManualTimersForTests(true);
  setMediaResourceForceMemoryForTests(true);
  resetMediaResourcesMemoryForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setLanguageRegistryForceMemoryForTests(true);
  await ensureLanguageRegistrySeeded();
  await updateLanguageRegistryRecord("lang-uk", {
    enabled: true,
    contentTranslationEnabled: true,
  });
  setPlpBuildRequestProcessor((request) =>
    processPlpBuildRequest(request, {
      importProvider: async () => {
        providerCalls += 1;
        return {
          provider: new FakeLocalMediaPlpTransport({ maxRequests: 4 }),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        };
      },
      verifyDurability: async () => ({ ok: true }),
    }),
  );
});

afterEach(() => {
  resetPlpBuildRequestQueueForTests();
  usePlpSchedulerManualTimersForTests(false);
  setPlpAutoBuildNowMsForTests(null);
  setPlpAutoBuildWorkForceMemoryForTests(false);
  setMediaResourceForceMemoryForTests(false);
  resetMediaResourcesMemoryForTests();
  setLanguageRegistryForceMemoryForTests(false);
});

describe("PLP empty canonical and same-version recovery", () => {
  it("1. an empty trusted explanation does not become a stale version", async () => {
    const version = trustedExplanationCanonicalVersion(EXPLANATION_A);
    assert.ok(version);
    assert.notEqual(version, EMPTY_FINGERPRINT);
    await upsertMediaResource(trustedRow(FIXTURE_ID, EXPLANATION_A));
    putPlpAutoBuildWorkForTests(workFor({ entityId: FIXTURE_ID, version }));
    await upsertMediaResource(trustedRow(FIXTURE_ID, "   "));

    const editorial = await resolveTrustedMediaEditorialCanonical(FIXTURE_ID);
    assert.equal(editorial.sourceFound, true);
    assert.equal(editorial.canonicalUsable, false);
    assert.equal(editorial.canonicalVersion, null);
    const emptyTree = asMediaPlpPresentationNode(
      buildCanonicalTrustedPresentation({
        ...trustedRow(FIXTURE_ID, ""),
        explanation: "",
      }),
    );
    assert.equal(isUsablePlpCanonicalPresentation(emptyTree), false);
    assert.equal(fingerprintMediaPlpCanonicalVersion(emptyTree), EMPTY_FINGERPRINT);

    await settle();
    const row = listPlpAutoBuildWorkForTests().find((item) => item.entityId === FIXTURE_ID);
    assert.ok(row);
    assert.equal(row.status, "pending");
    assert.equal(row.failureCode, null);
    assert.equal(row.lastError, PLP_CANONICAL_SOURCE_UNUSABLE_REASON);
    assert.equal(row.canonicalVersion, version);
    assert.equal(row.attempts, 0);
    assert.equal(providerCalls, 0);
    assert.equal(
      Date.parse(row.nextAttemptAt ?? ""),
      NOW + PLP_UNUSABLE_CANONICAL_DEFER_MS,
    );
    assert.equal(
      await findCurrentPublishedPresentation({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId: FIXTURE_ID,
        locale: "uk",
      }),
      null,
    );

    await settle();
    assert.equal(providerCalls, 0);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((item) => item.entityId === FIXTURE_ID)?.status,
      "pending",
    );
  });

  it("2. a restored explanation publishes once without a manual enqueue", async () => {
    const version = trustedExplanationCanonicalVersion(EXPLANATION_A);
    assert.ok(version);
    await upsertMediaResource(trustedRow(FIXTURE_ID, " "));
    putPlpAutoBuildWorkForTests(
      workFor({
        entityId: FIXTURE_ID,
        version,
        lastError: PLP_CANONICAL_SOURCE_UNUSABLE_REASON,
        attempts: 0,
      }),
    );
    const deferred = listPlpAutoBuildWorkForTests()[0];
    assert.ok(deferred);
    putPlpAutoBuildWorkForTests({
      ...deferred,
      nextAttemptAt: new Date(NOW + PLP_UNUSABLE_CANONICAL_DEFER_MS).toISOString(),
    });
    await upsertMediaResource(trustedRow(FIXTURE_ID, EXPLANATION_A));
    await continueTrustedMediaPlpIfCanonicalChanged({
      entityId: FIXTURE_ID,
      beforeVersion: null,
      afterVersion: version,
    });
    await settlePlpAutoBuildDrainForTests();

    const row = listPlpAutoBuildWorkForTests().find((item) => item.entityId === FIXTURE_ID);
    assert.equal(row?.status, "completed");
    assert.equal(row?.canonicalVersion, version);
    assert.equal(providerCalls, 1);
    const current = await findCurrentPublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: FIXTURE_ID,
      locale: "uk",
    });
    assert.equal(current?.identity.canonicalVersion, version);
    assert.equal(plpSafetySweepArmedForTests(), false);
  });

  it("3. a real canonical change publishes only version B", async () => {
    const versionA = trustedExplanationCanonicalVersion(EXPLANATION_A);
    const versionB = trustedExplanationCanonicalVersion(EXPLANATION_B);
    assert.ok(versionA && versionB);
    assert.notEqual(versionA, versionB);
    await upsertMediaResource(trustedRow(FIXTURE_ID, EXPLANATION_B));
    putPlpAutoBuildWorkForTests(workFor({ entityId: FIXTURE_ID, version: versionA }));
    await settle();

    const row = listPlpAutoBuildWorkForTests().find((item) => item.entityId === FIXTURE_ID);
    assert.equal(row?.status, "completed");
    assert.equal(row?.canonicalVersion, versionB);
    assert.equal(row?.attempts, 1);
    assert.equal(row?.maxAttempts, 5);
    assert.equal(providerCalls, 1);
    const current = await findCurrentPublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: FIXTURE_ID,
      locale: "uk",
    });
    assert.equal(current?.identity.canonicalVersion, versionB);
    assert.notEqual(current?.identity.canonicalVersion, versionA);
  });

  it("4. a failed same-version stale row reopens once and stays completed", async () => {
    const version = trustedExplanationCanonicalVersion(EXPLANATION_A);
    assert.ok(version);
    await upsertMediaResource(trustedRow(FIXTURE_ID, EXPLANATION_A));
    putPlpAutoBuildWorkForTests(
      workFor({
        entityId: FIXTURE_ID,
        version,
        status: "failed",
        attempts: 1,
        failureCode: "STALE_CANONICAL_VERSION",
        retryable: false,
        lastError: "STALE_CANONICAL_VERSION",
      }),
    );
    const reopened = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: FIXTURE_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "CANONICAL_CONTENT_UPDATED",
      reopenFailedSameVersion: true,
    });
    assert.equal(reopened.accepted, true);
    assert.equal(reopened.record.status, "pending");
    assert.equal(reopened.record.attempts, 0);
    assert.equal(reopened.record.maxAttempts, 5);
    assert.equal(
      reopened.record.recoveryGeneration,
      PLP_SAME_VERSION_STALE_RECOVERY_GENERATION,
    );

    await settle();
    assert.equal(providerCalls, 1);
    const completed = listPlpAutoBuildWorkForTests().find((item) => item.entityId === FIXTURE_ID);
    assert.equal(completed?.status, "completed");

    await continueTrustedMediaPlpIfCanonicalChanged({
      entityId: FIXTURE_ID,
      beforeVersion: null,
      afterVersion: version,
    });
    await settlePlpAutoBuildDrainForTests();
    assert.equal(providerCalls, 1);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((item) => item.entityId === FIXTURE_ID)?.status,
      "completed",
    );
  });

  it("5. a non-stale terminal failure is not reopened", async () => {
    const version = trustedExplanationCanonicalVersion(EXPLANATION_A);
    assert.ok(version);
    await upsertMediaResource(trustedRow(FIXTURE_ID, EXPLANATION_A));
    putPlpAutoBuildWorkForTests(
      workFor({
        entityId: FIXTURE_ID,
        version,
        status: "failed",
        attempts: 1,
        failureCode: "PROVIDER_INTEGRITY",
        retryable: false,
        lastError: "PROVIDER_INTEGRITY",
      }),
    );
    const kept = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: FIXTURE_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "CANONICAL_CONTENT_UPDATED",
      reopenFailedSameVersion: true,
    });
    assert.equal(kept.deduped, true);
    assert.equal(kept.record.status, "failed");
    assert.equal(kept.record.failureCode, "PROVIDER_INTEGRITY");
    await settle();
    assert.equal(providerCalls, 0);
  });

  it("6. a missing trusted entity stays source-not-found", async () => {
    const editorial = await resolveTrustedMediaEditorialCanonical(MISSING_ID);
    assert.equal(editorial.sourceFound, false);
    assert.equal(editorial.canonicalVersion, null);
    const result = await processPlpBuildRequest(
      {
        workKey: plpBuildWorkKey({
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          entityId: MISSING_ID,
          locale: "uk",
        }),
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId: MISSING_ID,
        locale: "uk",
        canonicalVersion: "v-stored",
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        enqueuedAt: new Date(NOW).toISOString(),
        status: "RUNNING",
      },
      {
        importProvider: async () => {
          providerCalls += 1;
          throw new Error("provider must not run");
        },
      },
    );
    assert.equal(result.status, "FAILED");
    if (result.status === "FAILED") {
      assert.equal(result.failure.failureCode, "SOURCE_NOT_FOUND");
    }
    assert.equal(providerCalls, 0);
    assert.equal(
      listPlpAutoBuildWorkForTests().some((row) => row.canonicalVersion === EMPTY_FINGERPRINT),
      false,
    );
  });

  it("7. a completed neighbor is not replayed", async () => {
    const fixtureVersion = trustedExplanationCanonicalVersion(EXPLANATION_A);
    const neighborVersion = trustedExplanationCanonicalVersion(EXPLANATION_B);
    assert.ok(fixtureVersion && neighborVersion);
    await upsertMediaResource(trustedRow(NEIGHBOR_ID, EXPLANATION_B));
    putPlpAutoBuildWorkForTests(workFor({ entityId: NEIGHBOR_ID, version: neighborVersion }));
    await settle();
    assert.equal(providerCalls, 1);
    const neighborBefore = listPlpAutoBuildWorkForTests().find(
      (item) => item.entityId === NEIGHBOR_ID,
    );
    assert.equal(neighborBefore?.status, "completed");

    await upsertMediaResource(trustedRow(FIXTURE_ID, EXPLANATION_A));
    putPlpAutoBuildWorkForTests(
      workFor({
        entityId: FIXTURE_ID,
        version: fixtureVersion,
        status: "failed",
        attempts: 1,
        failureCode: "STALE_CANONICAL_VERSION",
        retryable: false,
      }),
    );
    await continueTrustedMediaPlpIfCanonicalChanged({
      entityId: FIXTURE_ID,
      beforeVersion: null,
      afterVersion: fixtureVersion,
    });
    await settlePlpAutoBuildDrainForTests();

    assert.equal(providerCalls, 2);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((item) => item.entityId === NEIGHBOR_ID)?.status,
      "completed",
    );
    assert.equal(
      listPlpAutoBuildWorkForTests().find((item) => item.entityId === FIXTURE_ID)?.status,
      "completed",
    );
    const neighborCurrent = await findCurrentPublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: NEIGHBOR_ID,
      locale: "uk",
    });
    assert.equal(neighborCurrent?.identity.canonicalVersion, neighborVersion);
  });

  it("8. event-driven continuation wakes recovered work without the safety sweep", async () => {
    const version = trustedExplanationCanonicalVersion(EXPLANATION_A);
    assert.ok(version);
    await upsertMediaResource(trustedRow(FIXTURE_ID, EXPLANATION_A));
    putPlpAutoBuildWorkForTests(
      workFor({
        entityId: FIXTURE_ID,
        version,
        lastError: PLP_CANONICAL_SOURCE_UNUSABLE_REASON,
      }),
    );
    const existing = listPlpAutoBuildWorkForTests()[0];
    assert.ok(existing);
    putPlpAutoBuildWorkForTests({
      ...existing,
      nextAttemptAt: new Date(NOW + PLP_UNUSABLE_CANONICAL_DEFER_MS).toISOString(),
    });
    assert.equal(plpSafetySweepArmedForTests(), false);
    await continueTrustedMediaPlpIfCanonicalChanged({
      entityId: FIXTURE_ID,
      beforeVersion: null,
      afterVersion: version,
    });
    await settlePlpAutoBuildDrainForTests();
    assert.equal(plpSafetySweepArmedForTests(), false);
    assert.equal(providerCalls, 1);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((item) => item.entityId === FIXTURE_ID)?.status,
      "completed",
    );
  });

  it("recoverable PLP work does not exhaust activation, and a real terminal failure still does", () => {
    const domains = ownersReady();
    const open = readiness(1);
    const recoverable = classifyActivationAutomaticProgress({
      readiness: open,
      plpWork: [
        {
          status: "pending",
          attempts: 0,
          maxAttempts: 5,
          retryable: null,
          recoveryGeneration: null,
          nextAttemptAt: new Date(NOW + PLP_UNUSABLE_CANONICAL_DEFER_MS).toISOString(),
          failureCode: null,
          lastError: PLP_CANONICAL_SOURCE_UNUSABLE_REASON,
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        },
      ],
    });
    assert.equal(recoverable, "progress");
    const recoverableStatus = deriveActivationJobStatus({
      readiness: open,
      domains,
      ctEnqueueAttempted: true,
      plpEnqueueAttempted: true,
      automaticProgress: recoverable,
    });
    assert.equal(recoverableStatus, "running");
    assert.notEqual(recoverableStatus, "failed");

    const terminal = classifyActivationAutomaticProgress({
      readiness: open,
      plpWork: [
        {
          status: "failed",
          attempts: 1,
          maxAttempts: 5,
          retryable: false,
          recoveryGeneration: null,
          nextAttemptAt: null,
          failureCode: "PROVIDER_INTEGRITY",
          lastError: "PROVIDER_INTEGRITY",
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        },
      ],
    });
    assert.equal(terminal, "exhausted");
    assert.equal(
      deriveActivationJobStatus({
        readiness: open,
        domains,
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
        automaticProgress: terminal,
      }),
      "failed",
    );
    assert.equal(
      ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL,
      "Automatic localization cannot progress.",
    );
  });
});
