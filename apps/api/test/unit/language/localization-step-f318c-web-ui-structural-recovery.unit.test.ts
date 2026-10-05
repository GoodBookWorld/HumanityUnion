/**
 * STEP F.3.18C — generic WEB_UI structural recovery.
 * Deterministic translator only. No Gemini.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { LanguageRegistryRecord, WebUiMessageTree } from "@hu/types";
import {
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
} from "@hu/types";

import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { emptyPendingDomains } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  getLanguageActivationJobById,
  saveLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  getWebUiActivationBatch,
  getWebUiActivationCheckpointByJobId,
  listIncompleteWebUiActivationCheckpoints,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationBatch,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import { repairRepresentableLocalizedWebUiMessage } from "../../../src/modules/web-ui-message-packs/web-ui-catalog-structure-repair.js";
import {
  assertStructureMatches,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
  translateWebUiProviderBatch,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  describeStructureMismatch,
  loadBundledEnglishWebUiMessagePack,
  validateWebUiMessageTreeAgainstEnglish,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import { loadPackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  reconstructWebUiMessageFromProviderSpans,
  segmentWebUiMessageForProvider,
  WebUiProviderPayloadShapeError,
  webUiProviderPayloadValue,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import {
  classifyWebUiStructureFailure,
  incompleteWebUiActivationCheckpointMongoFilter,
  isRecoverableWebUiActivationCheckpoint,
  WEB_UI_PROVIDER_SHAPE_VERSION,
  WEB_UI_STRUCTURE_BLOCKED_REASON,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

const PLURAL_SUBJECT =
  "{count, plural, one {# Candidate shares the subject “{subject}”.} other {# Candidates share the subject “{subject}”.}}";
const FLAT_SUBJECT = "{count} shared subject “{subject}”.";
const PLURAL_EXCERPT =
  "{count, plural, one {# section shares the same body text starting “{excerpt}”.} other {# sections share the same body text starting “{excerpt}”.}}";
const FLAT_EXCERPT = "{count} shared opening “{excerpt}”.";

function echoArrays(request: TranslationProviderRequest, corrupt: boolean) {
  const parsed = JSON.parse(request.text) as Record<string, unknown>;
  const translated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    assert.ok(Array.isArray(value), key);
    const spans = (value as unknown[]).map((span) => String(span));
    if (corrupt) {
      const index = spans.findIndex((span) => span.length > 0);
      if (index >= 0) {
        spans[index] = `${spans[index]} {renamed}`;
      }
    }
    translated[key] = spans;
  }
  return {
    translatedText: JSON.stringify(translated),
    providerId: "deterministic" as const,
    isPlaceholder: false as const,
  };
}

describe("F.3.18C provider span grammar", () => {
  it("uses one array response grammar for plain and multi-span leaves", async () => {
    const plain = webUiProviderPayloadValue("Back to Home");
    const spanned = webUiProviderPayloadValue("Last {count} days");
    assert.deepEqual(plain, ["Back to Home"]);
    assert.ok(Array.isArray(spanned));
    assert.equal(spanned.length, 2);
    assert.equal(JSON.stringify(spanned).includes("{count}"), false);

    const mixed = await translateWebUiProviderBatch({
      locale: "eo",
      englishFlat: {
        "civicActivity.backToHome": "Back to Home",
        "civicActivity.charts.lastNDays": "Last {count} days",
      },
      keys: ["civicActivity.backToHome", "civicActivity.charts.lastNDays"],
      terminologyContext: "",
      translator: async (request) => echoArrays(request, false),
    });
    assert.equal(mixed.values["civicActivity.backToHome"], "Back to Home");
    assert.match(mixed.values["civicActivity.charts.lastNDays"] ?? "", /\{count\}/);

    assert.throws(
      () => reconstructWebUiMessageFromProviderSpans("Back to Home", "Back to Home"),
      (error: unknown) => {
        assert.ok(error instanceof WebUiProviderPayloadShapeError);
        assert.equal(classifyWebUiStructureFailure(error).failureClass, "provider_payload_type_mismatch");
        return true;
      },
    );
    assert.throws(
      () => reconstructWebUiMessageFromProviderSpans("Last {count} days", ["only-one"]),
      (error: unknown) => {
        assert.equal(classifyWebUiStructureFailure(error).failureClass, "provider_span_count_mismatch");
        return true;
      },
    );
    const renamed = reconstructWebUiMessageFromProviderSpans("Last {count} days", [
      "Last {total} ",
      " days",
    ]);
    assert.match(renamed, /\{count\}/);
    assert.throws(
      () => assertStructureMatches("Last {count} days", renamed),
      /Placeholders do not match English\./,
    );
    assert.equal(
      classifyWebUiStructureFailure(new Error("Placeholders do not match English.")).failureClass,
      "placeholder_mismatch",
    );
    assert.equal(
      classifyWebUiStructureFailure(new Error("Message structure is unbalanced.")).failureClass,
      "icu_braces_mismatch",
    );
    assert.equal(
      classifyWebUiStructureFailure(new Error("Rich-text tags do not match English.")).failureClass,
      "tag_mismatch",
    );
    assert.equal(
      classifyWebUiStructureFailure(new Error("Protection sentinel count 1 does not match 2.")).failureClass,
      "protected_slot_mismatch",
    );
    assert.equal(
      classifyWebUiStructureFailure(new Error("Protection extraction did not cover the message.")).failureClass,
      "deterministic_reconstruction_mismatch",
    );
  });
});

describe("F.3.18C ICU catalog repair", () => {
  it("rebuilds flattened plural branches and still rejects the flat form", () => {
    for (const [english, flat, token] of [
      [PLURAL_SUBJECT, FLAT_SUBJECT, "subject"],
      [PLURAL_EXCERPT, FLAT_EXCERPT, "excerpt"],
    ] as const) {
      const plan = segmentWebUiMessageForProvider(english);
      assert.equal(plan.plain, false);
      assert.ok(plan.slots.some((slot) => slot.includes("plural")));
      assert.ok(plan.slots.includes("#"));
      assert.ok(plan.slots.includes(`{${token}}`));
      assert.equal(JSON.stringify(webUiProviderPayloadValue(english)).includes(`{${token}}`), false);
      assert.match(describeStructureMismatch(english, flat) ?? "", new RegExp(`unexpected \\{${token}\\}`));
      const repaired = repairRepresentableLocalizedWebUiMessage(english, flat);
      assert.equal(describeStructureMismatch(english, repaired), null);
      assert.match(repaired, /\{count, plural,/);
      assert.match(repaired, /#/);
      assert.match(repaired, new RegExp(`\\{${token}\\}`));
      assert.equal(repaired.includes(flat), false);
    }
  });

  it("packaged catalog leaves that were flattened now match English", () => {
    const packaged = loadPackagedWebUiCatalog("zh-Hant");
    assert.ok(packaged);
    const report = validateWebUiMessageTreeAgainstEnglish(packaged as WebUiMessageTree);
    assert.deepEqual(report.placeholderMismatchPaths, []);
  });
});

describe("F.3.18C readiness scope versus pack validity", () => {
  it("does not count an out-of-scope structural defect, and publication still rejects it", async () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const broken = structuredClone(english) as WebUiMessageTree;
    const advisories = (
      (
        ((broken as Record<string, unknown>).initiativeExperience as Record<string, unknown>)
          .author as Record<string, unknown>
      ).sidebar as Record<string, unknown>
    ).advisories as Record<string, unknown>;
    const official = advisories.officialResponse as Record<string, unknown>;
    const outOfScopePath =
      "initiativeExperience.author.sidebar.advisories.officialResponse.duplicateSubject";
    assert.equal(isPublicReaderWebUiRequiredPath(outOfScopePath), false);
    assert.equal(isParticipantWebUiRequiredPath(outOfScopePath), false);
    official.duplicateSubject = FLAT_SUBJECT;

    const publicReadiness = assessWebUiMessageTreeReadiness({
      messages: broken,
      scope: "public",
    });
    const participantReadiness = assessWebUiMessageTreeReadiness({
      messages: broken,
      scope: "participant",
    });
    assert.equal(publicReadiness.structuralInvalidCount, 0);
    assert.equal(participantReadiness.structuralInvalidCount, 0);

    const inScope = structuredClone(english) as Record<string, unknown>;
    const blog = inScope.blogPublic as Record<string, unknown>;
    const pagination = blog.pagination as Record<string, unknown>;
    pagination.showingCount = "count removed";
    const scoped = assessWebUiMessageTreeReadiness({
      messages: inScope as WebUiMessageTree,
      scope: "public",
    });
    assert.ok((scoped.structuralInvalidCount ?? 0) > 0);

    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    await assert.rejects(
      () =>
        upsertWebUiMessagePack({
          locale: "eo",
          messages: broken,
          status: "published",
          sourceNote: "f318c",
        }),
      /Placeholder or message structure mismatch/,
    );
  });
});

describe("F.3.18C version-aware checkpoint recovery", () => {
  let nowMs = Date.now();

  beforeEach(async () => {
    nowMs = Date.now();
    setLocalizationProviderClockForTests(() => nowMs);
    setLocalizationProviderPacingIntervalMsForTests(0);
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    setThinGeminiProviderStateForceMemoryForTests(true);
    resetThinGeminiProviderStateForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-f318c",
    }));
  });

  afterEach(() => {
    setLocalizationProviderClockForTests(null);
    setLocalizationProviderPacingIntervalMsForTests(null);
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
    resetThinGeminiProviderStateForTests();
    setThinGeminiProviderStateForceMemoryForTests(false);
  });

  function install(input: {
    readonly includePaths: readonly string[];
    readonly translator: (request: TranslationProviderRequest) => Promise<{
      readonly translatedText: string;
      readonly providerId: "deterministic";
      readonly isPlaceholder: false;
    }>;
  }) {
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async () => {
        throw new Error("CT/PLP activate must not run before WEB_UI is ready.");
      },
      webUiPreparationDeps: {
        includePaths: input.includePaths,
        now: () => new Date(nowMs).toISOString(),
        loadLiveTerminology: async () => "",
        translator: input.translator,
      },
    });
  }

  async function registryEo(): Promise<LanguageRegistryRecord> {
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

  it("keeps a same-version block closed and reopens an older one on boot", async () => {
    assert.equal(WEB_UI_PROVIDER_SHAPE_VERSION > 1, true);
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
      }),
      false,
    );
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION - 1,
      }),
      true,
    );
    const filter = incompleteWebUiActivationCheckpointMongoFilter();
    assert.match(JSON.stringify(filter), /structure_blocked/);
    assert.equal(
      JSON.stringify(filter).includes(`"$lt":${WEB_UI_PROVIDER_SHAPE_VERSION}`),
      true,
    );

    const corpus = loadPublicWebUiEnglishCorpus();
    const fullPlan = planWebUiDraftBatches(corpus.flat);
    const includePaths = [...(fullPlan[0]?.keys ?? []), ...(fullPlan[1]?.keys ?? [])];
    const subset = loadPublicWebUiEnglishCorpus(includePaths);
    const plan = planWebUiDraftBatches(subset.flat);
    assert.equal(plan.length, 2);
    const sourceHash = hashWebUiEnglishFlatMap(subset.flat);
    const record = await registryEo();
    const stamp = new Date(nowMs).toISOString();
    const jobId = "lang-act-eo-6-f318c";
    const checkpointId = "webui-act-lang-act-eo-6-f318c";
    const domains = emptyPendingDomains();
    const first = plan[0];
    const blocked = plan[1];
    assert.ok(first && blocked);
    const keptKey = first.keys[0] ?? "";
    const keptValue = `kept:${keptKey}`;

    async function seed(version: number) {
      resetWebUiActivationCheckpointStoreForTests();
      resetLanguageActivationJobStoreForTests();
      const values: Record<string, string> = {};
      for (const key of first!.keys) {
        values[key] = key === keptKey ? keptValue : "ok";
      }
      await upsertWebUiActivationBatch({
        checkpointId,
        batchId: first!.id,
        phase: "primary",
        namespace: first!.namespace,
        keys: first!.keys,
        values,
        status: "ok",
        attempts: 1,
        reason: null,
        updatedAt: stamp,
      });
      await upsertWebUiActivationBatch({
        checkpointId,
        batchId: blocked!.id,
        phase: "primary",
        namespace: blocked!.namespace,
        keys: blocked!.keys,
        values: {},
        status: "pending",
        attempts: 1,
        reason: WEB_UI_STRUCTURE_BLOCKED_REASON,
        updatedAt: stamp,
      });
      await upsertWebUiActivationCheckpoint({
        checkpointId,
        jobId,
        locale: record.locale,
        generation: 6,
        sourceHash,
        terminologyMode: "live",
        phase: "structure_blocked",
        leafCount: subset.requiredPaths.length,
        batchCount: plan.length,
        completedBatchCount: 1,
        failedBatchCount: 0,
        qualityBatchCount: 0,
        qualityCompletedBatchCount: 0,
        suspiciousPathCount: 0,
        englishName: record.englishName,
        nativeName: record.nativeName,
        textDirection: record.textDirection,
        detail: "Automatic translation is blocked by a structural defect.",
        createdAt: stamp,
        updatedAt: stamp,
        nextAttemptAt: null,
        structureRetryCount: 6,
        providerShapeVersion: version,
        providerShapeFailureCount: 6,
      });
      await saveLanguageActivationJob({
        jobId,
        locale: record.locale,
        languageId: record.languageId,
        generation: 6,
        status: "running",
        domains: {
          ...domains,
          webUi: {
            ...domains.webUi,
            status: "in_progress",
            dataReady: false,
            preparationPhase: "structure_blocked",
            checkpointId,
            sourceHash,
            totalBatches: plan.length,
            completedBatches: 1,
            totalLeaves: subset.requiredPaths.length,
            completedLeaves: 6,
            providerFailure: false,
            nextAttemptAt: null,
          },
        },
        lastError: null,
        diagnosticSummary: "running",
        createdAt: stamp,
        updatedAt: stamp,
        startedAt: stamp,
        completedAt: null,
        createdByParticipantId: "participant-admin-f318c",
        searchEnabledSnapshot: false,
        seoIndexingEnabledSnapshot: false,
      });
    }

    let calls = 0;
    install({
      includePaths,
      translator: async (request) => {
        calls += 1;
        const during = await getWebUiActivationCheckpointByJobId(jobId);
        assert.equal(during?.phase, "primary");
        assert.equal(during?.generation, 6);
        assert.equal(during?.checkpointId, checkpointId);
        assert.equal(during?.completedBatchCount, 1);
        assert.equal(during?.providerShapeVersion, WEB_UI_PROVIDER_SHAPE_VERSION);
        assert.equal(during?.providerShapeFailureCount, 0);
        assert.equal(during?.structureRetryCount, 0);
        return echoArrays(request, false);
      },
    });

    await seed(WEB_UI_PROVIDER_SHAPE_VERSION);
    const sameVersionListed = await listIncompleteWebUiActivationCheckpoints();
    assert.equal(sameVersionListed.length, 1);
    const sameJob = await processLanguageActivationJob(jobId, { webUiTick: true });
    resetLanguageActivationJobSchedulerForTests();
    assert.equal(calls, 0);
    assert.equal(sameJob.generation, 6);
    assert.equal(sameJob.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(sameJob.domains.webUi.completedBatches, 1);
    const adopted = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(adopted?.structureRecoveryCycleCount, 1);
    assert.ok(Date.parse(adopted?.nextAttemptAt ?? "") > nowMs);

    calls = 0;
    await seed(WEB_UI_PROVIDER_SHAPE_VERSION - 1);
    const oldListed = await listIncompleteWebUiActivationCheckpoints();
    assert.equal(oldListed.length, 1);
    assert.equal(oldListed[0]?.checkpointId, checkpointId);
    const oldBoot = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(oldBoot.scheduled, 1);
    for (let attempt = 0; attempt < 10 && calls < 1; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    resetLanguageActivationJobSchedulerForTests();
    const job = await getLanguageActivationJobById(jobId);
    assert.ok(job);
    assert.equal(calls, 1);
    assert.equal(job.jobId, jobId);
    assert.equal(job.generation, 6);
    assert.equal(job.domains.ct.enqueueAttempted, false);
    assert.equal(job.domains.plp.enqueueAttempted, false);
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint?.checkpointId, checkpointId);
    assert.equal(checkpoint?.generation, 6);
    assert.equal(checkpoint?.completedBatchCount, 2);
    assert.notEqual(checkpoint?.phase, "structure_blocked");
    const batches = await listWebUiActivationBatches(checkpointId, "primary");
    const kept = batches.find((row) => row.batchId === first.id);
    const opened = batches.find((row) => row.batchId === blocked.id);
    assert.equal(kept?.status, "ok");
    assert.equal(kept?.values[keptKey], keptValue);
    assert.equal(opened?.status, "ok");
    const openedRow = await getWebUiActivationBatch({
      checkpointId,
      batchId: blocked.id,
      phase: "primary",
    });
    assert.equal(openedRow?.status, "ok");
    assert.equal(openedRow?.values && Object.keys(openedRow.values).length > 0, true);
  });

  it("stores a durable structure class when the same shape version blocks", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const fullPlan = planWebUiDraftBatches(corpus.flat);
    const includePaths = [...(fullPlan[0]?.keys ?? [])];
    const record = await registryEo();
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    let calls = 0;
    install({
      includePaths,
      translator: async (request) => {
        calls += 1;
        return echoArrays(request, true);
      },
    });
    let job = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    resetLanguageActivationJobSchedulerForTests();
    let guard = 0;
    while (job.domains.webUi.preparationPhase !== "structure_blocked" && guard < 6) {
      guard += 1;
      const waiting = await getWebUiActivationCheckpointByJobId(started.job.jobId);
      nowMs = Date.parse(waiting?.nextAttemptAt ?? "") + 1_000;
      job = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
      resetLanguageActivationJobSchedulerForTests();
    }
    assert.equal(job.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(job.generation, started.job.generation);
    const checkpoint = await getWebUiActivationCheckpointByJobId(started.job.jobId);
    assert.equal(checkpoint?.providerShapeVersion, WEB_UI_PROVIDER_SHAPE_VERSION);
    assert.equal(checkpoint?.structureFailure?.failureClass, "placeholder_mismatch");
    assert.equal(checkpoint?.structureFailure?.code, "placeholder_mismatch");
    assert.equal(checkpoint?.structureRecoveryCycleCount, 1);
    assert.ok(Date.parse(checkpoint?.nextAttemptAt ?? "") > nowMs);
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    const blocked = batches.find((row) => row.status === "pending");
    assert.ok(blocked);
    assert.equal(blocked?.reason, WEB_UI_STRUCTURE_BLOCKED_REASON);
    assert.equal(blocked?.structureFailure?.failureClass, "placeholder_mismatch");
    assert.deepEqual(blocked?.values, {});
    assert.ok(calls >= 6);
    const again = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    assert.equal(again.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(calls >= 6, true);
    const callsAfterTerminal = calls;
    await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    assert.equal(calls, callsAfterTerminal);
  });
});
