/**
 * Explicit activation resume reconciles newly actionable residual work.
 * Status refresh does not. No provider calls and no Georgian-specific branches.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import { LANGUAGE_ACTIVATION_CT_OWNED_KINDS, type Initiative } from "@hu/types";

import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import {
  buildPublicLocalizationRetryPreflight,
  createLanguageRegistryRecord,
  encodeContentTranslationFailureMetadata,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  loadTranslatableSource,
  markContentTranslationWarmMemoryFailedForTests,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  getLanguageActivationAdminView,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startAndProcessLanguageActivationJobForTests,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { resetWebUiControlledLabelCacheForTests } from "../../../src/modules/language/controlled-lifecycle-web-ui-labels.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");
const createdInitiativeIds: string[] = [];

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-activation-resume-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-activation-resume",
    createdAt: now,
    updatedAt: now,
    title: `Activation resume ${suffix}`,
    description: `Canonical English prose for activation resume ${suffix}.`,
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

async function liveInitiative(suffix: string) {
  const initiative = sampleInitiative(suffix);
  createInitiative(initiative);
  createdInitiativeIds.push(initiative.initiativeId);
  const source = await loadTranslatableSource({
    sourceKind: "initiative",
    sourceRecordId: initiative.initiativeId,
  });
  assert.ok(source);
  return { initiative, source };
}

describe("activation resume residual reconciliation", () => {
  const enqueuedIds: string[] = [];
  let residualCalls = 0;
  let plpCalls = 0;
  let scannedIds: string[] = [];

  beforeEach(async () => {
    enqueuedIds.length = 0;
    residualCalls = 0;
    plpCalls = 0;
    scannedIds = [];
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
    resetWebUiControlledLabelCacheForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-test",
    }));
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      skipWebUiPreparation: true,
      evaluateReadiness: async (input) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const { emptyLanguageLocalizationCountBucket } = await import("@hu/types");
        return evaluateLanguageLocalizationReadiness({
          ...input,
          skipCorpusPlan: true,
          // Keep historical residual work visible so READY no-op does not short-circuit resumes.
          ctCounts: {
            ...emptyLanguageLocalizationCountBucket(),
            missing: 1,
            workItemsRequired: 1,
          },
          plpCounts: emptyLanguageLocalizationCountBucket(),
        });
      },
      plannerDeps: {
        auditCorpus: async () => ({ byLocale: [] }) as never,
        classifyMediaEditorial: async () => "CURRENT_PUBLISHED_COMPLETE",
        assessCarouselPlp: async () => ({ byKind: [] }) as never,
      },
      enqueuePlpMediaConsumer: async () => {
        plpCalls += 1;
      },
      activate: async (input) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const { emptyLanguageLocalizationCountBucket } = await import("@hu/types");
        const runResidual = async () => {
          residualCalls += 1;
          let presentationsScheduled = 0;
          let presentationsDeduped = 0;
          for (const sourceRecordId of scannedIds) {
            const source = await loadTranslatableSource({
              sourceKind: "initiative",
              sourceRecordId,
            });
            const preflight = await buildPublicLocalizationRetryPreflight({
              workItem: {
                sourceKind: "initiative",
                sourceRecordId,
                sourceVersion: source?.sourceVersion ?? "unloaded",
                targetLanguage: "eo",
                state: "MISSING",
                autoNodeCount: 1,
                missingOrStaleNodeCount: 1,
                fallbackPaths: ["title"],
              },
            });
            if (!preflight.ready) {
              continue;
            }
            const result = await enqueueContentTranslationWarmRequested({
              sourceKind: "initiative",
              sourceRecordId,
              reason: "operator_residual_retry",
              targetLocales: ["eo"],
              ...(source?.sourceVersion && source.sourceVersion !== "unloaded"
                ? { sourceVersion: source.sourceVersion }
                : {}),
            });
            if (result.enqueued) {
              presentationsScheduled += 1;
              enqueuedIds.push(sourceRecordId);
            } else if (result.deduped) {
              presentationsDeduped += 1;
            }
          }
          return { presentationsScheduled, presentationsDeduped } as never;
        };
        await runResidual();
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: input.locale,
          skipCorpusPlan: true,
          ctCounts: {
            ...emptyLanguageLocalizationCountBucket(),
            missing: 1,
            workItemsRequired: 1,
          },
          plpCounts: emptyLanguageLocalizationCountBucket(),
        });
        return {
          pack: "closure07" as const,
          locale: input.locale,
          mode: "execute" as const,
          readiness,
          plan: {
            pack: "closure07" as const,
            locale: input.locale,
            mode: "execute" as const,
            registryEligible: true,
            items: [],
            excluded: [],
            summary: { ctWorkItems: 1, plpWorkItems: 0, skippedCurrent: 0 },
            PROVIDER_CALLS: 0 as const,
            WRITES_PERFORMED: 0 as const,
          },
          execute: {
            attempted: true,
            ctKindsEnqueued: 0,
            plpEditorialEnqueued: false,
            notes: ["test residual activate"],
          },
          PROVIDER_CALLS: 0 as const,
          WRITES_PERFORMED: 0 as const,
          seoIndexingEnabledUnchanged: true as const,
        };
      },
    });
  });

  afterEach(() => {
    for (const id of createdInitiativeIds.splice(0)) {
      try {
        deleteInitiative(id);
      } catch {
        // ignore
      }
    }
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
  });

  async function createEligibleLocale() {
    return createLanguageRegistryRecord({
      locale: "eo",
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
  }

  it("1–3, 10–12. explicit resume discovers new retry-ready work; status refresh does not", async () => {
    const record = await createEligibleLocale();
    const { loadBundledEnglishWebUiMessagePack } = await import(
      "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js"
    );
    const { upsertWebUiMessagePack } = await import(
      "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js"
    );
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "published",
      messages: loadBundledEnglishWebUiMessagePack() as never,
      sourceNote: "15d91 ready WEB_UI before residual",
    });
    const ready = await liveInitiative("timeout");
    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: ready.initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["eo"],
      sourceVersion: ready.source.sourceVersion,
    }).then(async (enqueued) => {
      assert.ok(enqueued.eventId);
      markContentTranslationWarmMemoryFailedForTests(
        enqueued.eventId,
        encodeContentTranslationFailureMetadata({
          schema: "content_translation_failure_meta_v1",
          validationContractVersion: "v1",
          failureClass: "PROVIDER_TIMEOUT",
          failureReasonCode: "UNKNOWN_LEGACY",
          sourceKind: "initiative",
          sourceRecordId: ready.initiative.initiativeId,
          sourceVersion: ready.source.sourceVersion,
          targetLocale: "eo",
          failedAt: new Date().toISOString(),
          retryabilityHint: "retryable",
        }),
      );
    });

    const first = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(residualCalls, 1);
    assert.equal(plpCalls, 0);
    assert.equal(first.job?.domains.ct.enqueueAttempted, true);
    assert.equal(first.job?.domains.plp.enqueueAttempted, true);
    assert.ok(
      first.job?.status === "waiting_for_data" ||
        first.job?.status === "running" ||
        first.job?.status === "completed",
    );
    assert.equal(enqueuedIds.length, 0);

    scannedIds = [ready.initiative.initiativeId];
    const status = await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
      refreshJob: true,
    });
    assert.equal(status.job?.jobId, first.job?.jobId);
    assert.equal(residualCalls, 1);
    assert.equal(enqueuedIds.length, 0);

    const resumed = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(resumed.job?.jobId, first.job?.jobId);
    assert.ok(
      resumed.job?.status === "waiting_for_data" ||
        resumed.job?.status === "running" ||
        resumed.job?.status === "completed",
    );
    assert.equal(resumed.job?.domains.ct.enqueuedAt, first.job?.domains.ct.enqueuedAt);
    assert.equal(residualCalls, 2);
    assert.equal(plpCalls, 0);
    assert.deepEqual(enqueuedIds, [ready.initiative.initiativeId]);

    const again = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(again.job?.jobId, first.job?.jobId);
    assert.equal(residualCalls, 3);
    assert.equal(enqueuedIds.length, 1);
  });

  it("4–7. CURRENT, active work, and terminal failures are not enqueued", async () => {
    const record = await createEligibleLocale();
    const { loadBundledEnglishWebUiMessagePack } = await import(
      "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js"
    );
    const { upsertWebUiMessagePack } = await import(
      "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js"
    );
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "published",
      messages: loadBundledEnglishWebUiMessagePack() as never,
      sourceNote: "15d91 ready WEB_UI before residual",
    });
    const current = await liveInitiative("current");
    const active = await liveInitiative("active");
    const terminal = await liveInitiative("terminal");
    const now = new Date().toISOString();
    await upsertContentTranslation({
      translationId: `tr-current-${current.initiative.initiativeId}`,
      sourceKind: "initiative",
      sourceRecordId: current.initiative.initiativeId,
      sourceVersion: current.source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "eo",
      translatedContent: { title: "[eo] title", description: "[eo] body" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: now,
      stale: false,
      freshness: "current",
    });
    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: active.initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["eo"],
      sourceVersion: active.source.sourceVersion,
    });
    const failed = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: terminal.initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["eo"],
      sourceVersion: terminal.source.sourceVersion,
    });
    assert.ok(failed.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      failed.eventId,
      encodeContentTranslationFailureMetadata({
        schema: "content_translation_failure_meta_v1",
        validationContractVersion: "v1",
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "UNCHANGED_CIVIC_TITLE",
        sourceKind: "initiative",
        sourceRecordId: terminal.initiative.initiativeId,
        sourceVersion: terminal.source.sourceVersion,
        targetLocale: "eo",
        failedAt: now,
        retryabilityHint: "non_retryable_until_code_or_content_change",
      }),
    );

    scannedIds = [
      current.initiative.initiativeId,
      active.initiative.initiativeId,
      terminal.initiative.initiativeId,
    ];
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.job?.domains.ct.enqueueAttempted, true);
    assert.equal(residualCalls, 1);
    assert.equal(enqueuedIds.length, 0);

    await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(residualCalls, 2);
    assert.equal(enqueuedIds.length, 0);
  });

  it("8–9. Public News stays excluded and Civic Media PLP scope is unchanged", () => {
    assert.equal(LANGUAGE_ACTIVATION_CT_OWNED_KINDS.includes("public_news" as never), false);
    const activation = readFileSync(
      path.join(
        apiSrc,
        "modules/language/published-localized-presentation/universal/media-consumer-plp-activation-enqueue.ts",
      ),
      "utf8",
    );
    assert.match(activation, /NEWS_EXCLUDED_FROM_LANGUAGE_ACTIVATION/);
    assert.doesNotMatch(activation, /enqueueConsumerVisibleNewsPlpBuilds/);
    assert.match(activation, /civic_media_editorial/);
    assert.match(activation, /civic_media_principle/);
    assert.match(activation, /civic_media_trusted/);
    assert.match(activation, /civic_media_fact_check/);
    assert.match(activation, /civic_media_propaganda/);
    const service = readFileSync(
      path.join(
        apiSrc,
        "modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    assert.match(service, /reconcileResiduals/);
    assert.doesNotMatch(service, /["']ka["']/);
    const orchestrator = readFileSync(
      path.join(
        apiSrc,
        "modules/language/language-localization-activation/language-activation-orchestrator.ts",
      ),
      "utf8",
    );
    assert.match(orchestrator, /runPublicLocalizationResidualRetry/);
    assert.match(orchestrator, /item.owner === "PLP" && item.workItemsRequired > 0/);
  });
});
