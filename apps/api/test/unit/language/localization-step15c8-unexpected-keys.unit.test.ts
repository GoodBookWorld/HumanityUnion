/**
 * Step 15C.8 — unexpected WEB_UI provider keys are discarded, never remapped.
 * Deterministic provider only. No Gemini.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  getContentTranslationWorkerPeakConcurrencyForTests,
  resetContentTranslationWorkerConcurrencyForTests,
} from "../../../src/modules/language/content-translation-worker-concurrency.js";
import {
  getLanguageActivationAdminView,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  getLanguageActivationJobById,
  saveLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  getWebUiActivationBatch,
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationBatch,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
  sanitizeWebUiActivationFailureDetail,
  translateWebUiProviderBatch,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../../../../web/src");

const INCLUDE_PATHS = loadPublicWebUiEnglishCorpus().requiredPaths.slice(0, 24);
const TWO_BATCH_PATHS = INCLUDE_PATHS.slice(0, 12);

function translateAll(request: TranslationProviderRequest): TranslationProviderResult {
  const parsed = JSON.parse(request.text) as Record<string, string>;
  return {
    translatedText: JSON.stringify(
      Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, `[xx] ${value}`])),
    ),
    providerId: "deterministic",
    isPlaceholder: false,
  };
}

function activateNoOp() {
  return async (input: { locale: string }) => {
    const { evaluateLanguageLocalizationReadiness } = await import(
      "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
    );
    const readiness = await evaluateLanguageLocalizationReadiness({
      locale: input.locale,
      skipCorpusPlan: true,
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
        summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
        PROVIDER_CALLS: 0 as const,
        WRITES_PERFORMED: 0 as const,
      },
      execute: {
        attempted: true,
        ctKindsEnqueued: 0,
        plpEditorialEnqueued: false,
        notes: [],
      },
      PROVIDER_CALLS: 0 as const,
      WRITES_PERFORMED: 0 as const,
      seoIndexingEnabledUnchanged: true,
    };
  };
}

describe("Step 15C.8 — safe unexpected WEB_UI provider keys", () => {
  beforeEach(async () => {
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
    resetContentTranslationWorkerConcurrencyForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-15c8",
    }));
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
    resetContentTranslationWorkerConcurrencyForTests();
  });

  it("1–11 unexpected key discarded; exact recovery; no fuzzy remap; mixed responses", async () => {
    const expected = "blogPublic.readMore";
    const unexpected = "blogPublic.reactions.readMore";
    const englishFlat = {
      [expected]: "Read more",
      "blogPublic.other": "Other",
    };
    let calls = 0;
    const requested: string[][] = [];
    const result = await translateWebUiProviderBatch({
      locale: "ka",
      englishFlat,
      keys: [expected, "blogPublic.other"],
      terminologyContext: "LIVE",
      translator: async (request) => {
        calls += 1;
        const parsed = JSON.parse(request.text) as Record<string, string>;
        requested.push(Object.keys(parsed).sort());
        if (calls === 1) {
          return {
            translatedText: JSON.stringify({
              "blogPublic.other": `[xx] ${parsed["blogPublic.other"]}`,
              [unexpected]: "SHOULD_NOT_PERSIST",
            }),
            providerId: "deterministic",
            isPlaceholder: false,
          };
        }
        assert.deepEqual(Object.keys(parsed), [expected]);
        return {
          translatedText: JSON.stringify({
            [expected]: `[xx] ${parsed[expected]}`,
          }),
          providerId: "deterministic",
          isPlaceholder: false,
        };
      },
    });
    assert.equal(calls, 2);
    assert.deepEqual(requested[1], [expected]);
    assert.deepEqual(result.discardedUnexpectedKeys, [unexpected]);
    assert.equal(result.values[expected], "[xx] Read more");
    assert.equal(result.values["blogPublic.other"], "[xx] Other");
    assert.equal(Object.hasOwn(result.values, unexpected), false);
    assert.equal(result.missingKeyRecoveryAttempted, true);

    let failCalls = 0;
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "ka",
          englishFlat: { [expected]: "Read more" },
          keys: [expected],
          terminologyContext: "LIVE",
          translator: async () => {
            failCalls += 1;
            return {
              translatedText: JSON.stringify({ [unexpected]: "wrong path" }),
              providerId: "deterministic",
              isPlaceholder: false,
            };
          },
        }),
      /omitted keys after recovery/,
    );
    assert.equal(failCalls, 2);
    assert.match(
      sanitizeWebUiActivationFailureDetail(
        `Provider omitted keys after recovery: ${expected} (discarded unexpected: ${unexpected})`,
      ),
      /did not return the required catalog keys/,
    );
  });

  it("12–17 structural validation and concurrency remain unchanged", async () => {
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { "x.a": "Hello {name}" },
          keys: ["x.a"],
          terminologyContext: "LIVE",
          translator: async () => ({
            translatedText: JSON.stringify({ "x.a": "Hello" }),
            providerId: "deterministic",
            isPlaceholder: false,
          }),
        }),
      /Placeholder|sentinel|Protection/i,
    );
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { "x.b": "Click <b>here</b>" },
          keys: ["x.b"],
          terminologyContext: "LIVE",
          translator: async () => ({
            translatedText: JSON.stringify({ "x.b": "Click here" }),
            providerId: "deterministic",
            isPlaceholder: false,
          }),
        }),
      /Rich-text|sentinel|Protection/i,
    );
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { "x.c": "{count, plural, one {# item} other {# items}}" },
          keys: ["x.c"],
          terminologyContext: "LIVE",
          translator: async () => ({
            translatedText: JSON.stringify({ "x.c": "items" }),
            providerId: "deterministic",
            isPlaceholder: false,
          }),
        }),
      /sentinel|Placeholder|Protection|unbalanced/i,
    );
    assert.ok(getContentTranslationWorkerPeakConcurrencyForTests() <= 1);
  });

  it("18–23 failed checkpoint resumes; unexpected recovery persists ok; Admin failure once", async () => {
    const record = await createLanguageRegistryRecord({
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
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    const job = started.job;
    const corpus = loadPublicWebUiEnglishCorpus(TWO_BATCH_PATHS);
    const plans = planWebUiDraftBatches(corpus.flat);
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => translateAll(request),
      },
    });
    await processLanguageActivationJob(job.jobId, { webUiTick: true });
    const checkpoint = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.ok(checkpoint);
    const first = plans[0]!;
    const second = plans[1]!;
    await upsertWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: second.id,
      phase: "primary",
      namespace: second.namespace,
      keys: second.keys,
      values: {},
      status: "failed",
      attempts: 2,
      reason: "Provider returned unexpected keys: blogPublic.reactions.readMore",
      updatedAt: new Date().toISOString(),
    });
    await upsertWebUiActivationCheckpoint({
      ...checkpoint,
      phase: "failed",
      completedBatchCount: 1,
      failedBatchCount: 1,
      sourceHash,
      detail: sanitizeWebUiActivationFailureDetail(
        "Provider omitted keys after recovery: blogPublic.readMore (discarded unexpected: blogPublic.reactions.readMore)",
      ),
      updatedAt: new Date().toISOString(),
    });
    await saveLanguageActivationJob({
      ...(await getLanguageActivationJobById(job.jobId))!,
      status: "failed",
      domains: {
        ...(await getLanguageActivationJobById(job.jobId))!.domains,
        webUi: {
          ...(await getLanguageActivationJobById(job.jobId))!.domains.webUi,
          status: "failed",
          preparationPhase: "failed",
          checkpointId: checkpoint.checkpointId,
          sourceHash,
          completedBatches: 1,
          totalBatches: checkpoint.batchCount,
          providerFailure: true,
          detail: sanitizeWebUiActivationFailureDetail(
            "Provider omitted keys after recovery: blogPublic.readMore (discarded unexpected: blogPublic.reactions.readMore)",
          ),
        },
      },
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    let providerCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => {
          providerCalls += 1;
          const parsed = JSON.parse(request.text) as Record<string, string>;
          const keys = Object.keys(parsed);
          if (keys.length > 1) {
            const wrong = Object.fromEntries(
              Object.entries(parsed)
                .slice(0, -1)
                .map(([key, value]) => [key, `[xx] ${value}`]),
            );
            const missing = keys[keys.length - 1]!;
            return {
              translatedText: JSON.stringify({
                ...wrong,
                [`${missing}.alias`]: "SHOULD_NOT_PERSIST",
              }),
              providerId: "deterministic",
              isPlaceholder: false,
            };
          }
          return translateAll(request);
        },
      },
    });

    const resumed = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(resumed.job?.jobId, job.jobId);
    assert.equal(resumed.job?.status, "running");
    const ticked = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    assert.equal(ticked.status, "running");
    assert.ok(providerCalls >= 2);
    const firstAfter = await getWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: first.id,
      phase: "primary",
    });
    assert.equal(firstAfter?.status, "ok");
    assert.equal(firstAfter?.attempts, 1);
    const secondAfter = await getWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: second.id,
      phase: "primary",
    });
    assert.equal(secondAfter?.status, "ok");
    assert.match(secondAfter?.reason ?? "", /discarded unexpected/);
    assert.equal(Object.keys(secondAfter?.values ?? {}).includes(`${second.keys[0]}.alias`), false);
    assert.equal(await getPublishedWebUiMessagePackByLocale("eo"), null);

    const status = await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    const callsAfter = providerCalls;
    await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(providerCalls, callsAfter);
    assert.ok(status);

    const section = readFileSync(
      path.join(webSrc, "features/administration/components/AdminLanguagesSection.tsx"),
      "utf8",
    );
    const owner = section.slice(
      section.indexOf("function formatOwnerPreparationProgress"),
      section.indexOf("function formatActivationWaitingGaps"),
    );
    assert.match(owner, /Detailed WEB_UI failure is shown once/);
    assert.match(
      owner,
      /if \(webUi\.status === "failed" \|\| webUi\.providerFailure\) \{\s*\/\/ Detailed WEB_UI failure is shown once/,
    );
    const readiness = section.slice(
      section.indexOf("function LanguageReadinessDetails"),
      section.indexOf("export function AdminLanguagesSection"),
    );
    assert.match(readiness, /admin-languages__readiness-failure/);
    assert.equal(
      (readiness.match(/webUi\.detail \?\? "Public interface translation failed/g) ?? []).length,
      1,
    );

    const batches = await listWebUiActivationBatches(checkpoint.checkpointId, "primary");
    assert.ok(batches.filter((batch) => batch.status === "ok").length >= 2);
    assert.ok(getContentTranslationWorkerPeakConcurrencyForTests() <= 1);
  });
});
