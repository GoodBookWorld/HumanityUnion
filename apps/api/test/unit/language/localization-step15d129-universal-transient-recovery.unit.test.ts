/**
 * Step 15D.12.9 — universal durable transient recovery for Activate Localization.
 * Deterministic provider only. No Gemini. No staging/production writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { BrandLocalizationRecord } from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  listTerminologyConcepts,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";
import {
  activationProviderCooldownSeconds,
  ACTIVATION_TRANSIENT_COOLDOWN_MAX_SECONDS,
  classifyActivationProviderTransientFailure,
  isActivationProviderTransientError,
} from "../../../src/modules/language/activation-provider-transient-recovery.js";
import {
  getContentTranslationWorkerPeakConcurrencyForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resolveContentTranslationWorkerConcurrency,
} from "../../../src/modules/language/content-translation-worker-concurrency.js";
import {
  brandDomainFromPreparationResult,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
  terminologyDomainFromPreparationResult,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getLanguageActivationJobById } from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  toLanguageActivationJobMongoDocument,
  fromLanguageActivationJobMongoDocument,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.mongo-document.js";
import {
  runLanguageOwnerPreparation,
  type LanguageOwnerFieldOutcome,
} from "../../../src/modules/language-preparation/language-owner-preparation.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import {
  resetBrandLocalizationStoreForTests,
  setBrandLocalizationForceMemoryForTests,
} from "../../../src/modules/brand-localization/brand-localization.repository.js";
import {
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  isWebUiTransientCooldownBudgetExhausted,
  webUiProviderCooldownSeconds,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-cooldown.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { loadPublicWebUiEnglishCorpus } from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";

const executeEnv = { TRANSLATION_PROVIDER: "gemini" };

function translate(request: TranslationProviderRequest): TranslationProviderResult {
  const parsed = JSON.parse(request.text) as Record<string, string>;
  return {
    translatedText: JSON.stringify(
      Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, `[xx] ${value}`]),
      ),
    ),
    providerId: "deterministic",
    isPlaceholder: false,
  };
}

const TWO_BATCH_PATHS = (() => {
  const { flat } = loadPublicWebUiEnglishCorpus();
  return Object.keys(flat).slice(0, 12);
})();

describe("Step 15D.12.9 — universal durable transient recovery", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setTerminologyGlossaryForceMemoryForTests(true);
    resetTerminologyGlossaryStoreForTests();
    await ensureTerminologyGlossarySeeded();
    setBrandLocalizationForceMemoryForTests(true);
    resetBrandLocalizationStoreForTests();
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
      participantId: "participant-admin-15d129",
    }));
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
    resetContentTranslationWorkerConcurrencyForTests();
  });

  it("A1–A2 transient beyond old budget stays cooldown; delay grows and caps", () => {
    assert.equal(isWebUiTransientCooldownBudgetExhausted(5), false);
    assert.equal(activationProviderCooldownSeconds(1), 60);
    assert.equal(activationProviderCooldownSeconds(2), 120);
    assert.equal(activationProviderCooldownSeconds(3), 300);
    assert.equal(activationProviderCooldownSeconds(4), 600);
    assert.equal(activationProviderCooldownSeconds(5), 900);
    assert.equal(activationProviderCooldownSeconds(99), ACTIVATION_TRANSIENT_COOLDOWN_MAX_SECONDS);
    assert.equal(webUiProviderCooldownSeconds(99), 900);
    assert.equal(
      isActivationProviderTransientError(
        new TranslationProviderError("rate_limited", "Gemini HTTP 429"),
      ),
      true,
    );
    assert.equal(
      classifyActivationProviderTransientFailure(
        new TranslationProviderError("network_failure", "down"),
      ),
      "unavailable",
    );
  });

  it("A3–A6 WEB_UI wake resumes unfinished; success resets streak; ok preserved; permanent fails", async () => {
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
    let providerCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async (input) => {
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
        };
      },
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-25T12:00:00.000Z",
        translator: async (request) => {
          providerCalls += 1;
          if (providerCalls === 1) {
            return translate(request);
          }
          if (providerCalls <= 7) {
            throw new TranslationProviderError("rate_limited", "Gemini HTTP 429");
          }
          return translate(request);
        },
        loadLiveTerminology: async () => "",
      },
    });

    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    const jobId = started.job!.jobId;

    // First batch ok
    let job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.domains.webUi.completedBatches, 1);

    // Transient → cooldown (not failed even after many)
    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
    assert.equal(job.domains.webUi.transientFailureCount, 1);

    for (let streak = 2; streak <= 6; streak += 1) {
      const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
      await upsertWebUiActivationCheckpoint({
        ...checkpoint!,
        phase: "primary",
        nextAttemptAt: null,
        transientFailureCount: streak - 1,
      });
      job = await processLanguageActivationJob(jobId, { webUiTick: true });
      assert.equal(job.status, "running");
      assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
      assert.equal(job.domains.webUi.transientFailureCount, streak);
    }

    const checkpointId = job.domains.webUi.checkpointId!;
    const okBefore = (await listWebUiActivationBatches(checkpointId, "primary")).filter(
      (b) => b.status === "ok",
    ).length;
    assert.equal(okBefore, 1);

    // Wake and succeed — streak resets; prior ok preserved
    const cp = await getWebUiActivationCheckpointByJobId(jobId);
    await upsertWebUiActivationCheckpoint({
      ...cp!,
      phase: "primary",
      nextAttemptAt: null,
      transientFailureCount: 6,
    });
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async (input) => {
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
        };
      },
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-25T12:20:00.000Z",
        translator: async (request) => translate(request),
        loadLiveTerminology: async () => "",
      },
    });
    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.status, "running");
    assert.notEqual(job.domains.webUi.preparationPhase, "provider_cooldown");
    assert.equal(job.domains.webUi.transientFailureCount ?? 0, 0);
    assert.ok((job.domains.webUi.completedBatches ?? 0) >= 2);
    const okAfter = (await listWebUiActivationBatches(checkpointId, "primary")).filter(
      (b) => b.status === "ok",
    ).length;
    assert.ok(okAfter >= 2);

    // Permanent error still terminal
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async (input) => {
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
        };
      },
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-25T12:21:00.000Z",
        translator: async () => {
          throw new TranslationProviderError("not_configured", "missing key");
        },
        loadLiveTerminology: async () => "",
      },
    });
    // Force incomplete primary again if already past
    const latest = await getWebUiActivationCheckpointByJobId(jobId);
    if (latest && latest.phase !== "failed" && latest.completedBatchCount < latest.batchCount) {
      job = await processLanguageActivationJob(jobId, { webUiTick: true });
      assert.equal(job.status, "failed");
      assert.equal(job.domains.webUi.providerFailure, true);
    }
  });

  it("B7–B13 Terminology: stop after first transient; cooldown; preserve; sanitized diagnostic; permanent fails", async () => {
    const concepts = (await listTerminologyConcepts()).filter((c) => c.status === "published");
    assert.ok(concepts.length >= 3);
    const record = await createLanguageRegistryRecord({
      locale: "io",
      englishName: "Ido",
      nativeName: "Ido",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
    const locale = record.locale;
    // Seed one preferredTerm so we can prove preservation across transient
    await updateTerminologyConcept(concepts[0]!.conceptId, {
      translations: {
        [locale]: { preferredTerm: "Already There", aliases: [] },
      },
    });

    let providerCalls = 0;
    const result = await runLanguageOwnerPreparation({
      locale,
      execute: true,
      owners: ["terminology"],
      englishName: record.englishName,
      nativeName: record.nativeName,
      textDirection: "ltr",
      env: executeEnv,
      translator: async () => {
        providerCalls += 1;
        throw new TranslationProviderError("rate_limited", "Gemini HTTP 429");
      },
    });

    assert.equal(providerCalls, 1);
    assert.ok(result.transientFailure);
    assert.equal(result.transientFailure!.kind, "rate_limited");
    const preserved = result.terminology.outcomes.filter((o) => o.outcome === "preserved");
    assert.ok(preserved.length >= 1);
    const gaps = result.terminology.outcomes.filter((o) => o.outcome === "gap");
    assert.ok(gaps.length >= 1);
    assert.equal(
      result.terminology.outcomes.filter((o) => o.outcome === "failed").length,
      0,
    );

    const domain = terminologyDomainFromPreparationResult(result, {
      previous: null,
      nowIso: "2026-09-25T12:00:00.000Z",
    });
    assert.equal(domain.status, "in_progress");
    assert.equal(domain.providerFailure, false);
    assert.ok(domain.nextAttemptAt);
    assert.equal(domain.lastTransientFailure, "rate_limited");
    assert.match(domain.detail ?? "", /rate limit/i);
    assert.ok(domain.providerDiagnostic?.failureCodes.some((c) => c.code === "rate_limited"));
    assert.equal(
      JSON.stringify(domain.providerDiagnostic).includes("AIza"),
      false,
    );

    // Permanent failure still terminal
    const permanentRecord = await createLanguageRegistryRecord({
      locale: "ie",
      englishName: "Occidental",
      nativeName: "Occidental",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
    const permanent = await runLanguageOwnerPreparation({
      locale: permanentRecord.locale,
      execute: true,
      owners: ["terminology"],
      englishName: permanentRecord.englishName,
      nativeName: permanentRecord.nativeName,
      textDirection: "ltr",
      env: executeEnv,
      translator: async () => {
        throw new TranslationProviderError("not_configured", "missing key");
      },
    });
    assert.equal(permanent.transientFailure ?? null, null);
    const failedDomain = terminologyDomainFromPreparationResult(permanent);
    assert.equal(failedDomain.status, "failed");
    assert.equal(failedDomain.providerFailure, true);
  });

  it("B10–B11 wake retries only gaps; success continues; C14–C17 Brand cooldown/preserve/permanent", async () => {
    const brands = new Map<string, BrandLocalizationRecord>();
    let brandProviderCalls = 0;
    const brandResult = await runLanguageOwnerPreparation({
      locale: "vo",
      execute: true,
      owners: ["brand"],
      englishName: "Volapük",
      nativeName: "Volapük",
      textDirection: "ltr",
      env: executeEnv,
      getBrand: async (locale) => brands.get(locale) ?? null,
      getEnglishBrand: async () => null,
      saveBrand: async (record) => {
        brands.set(record.locale, record);
        return record;
      },
      translator: async () => {
        brandProviderCalls += 1;
        throw new TranslationProviderError("timeout", "Gemini translation timed out");
      },
    });
    assert.equal(brandProviderCalls, 1);
    assert.ok(brandResult.transientFailure);
    assert.equal(
      brandResult.brand.outcomes.filter((o) => o.outcome === "failed").length,
      0,
    );
    const brandDomain = brandDomainFromPreparationResult(brandResult, {
      nowIso: "2026-09-25T12:00:00.000Z",
    });
    assert.equal(brandDomain.status, "in_progress");
    assert.equal(brandDomain.providerFailure, false);
    assert.ok(brandDomain.nextAttemptAt);

    // Permanent brand still fails
    const permanentBrand = await runLanguageOwnerPreparation({
      locale: "jbo",
      execute: true,
      owners: ["brand"],
      englishName: "Lojban",
      nativeName: "Lojban",
      textDirection: "ltr",
      env: executeEnv,
      getBrand: async () => null,
      getEnglishBrand: async () => null,
      saveBrand: async (record) => record,
      translator: async () => {
        throw new TranslationProviderError("safety_rejected", "blocked");
      },
    }).catch((error: unknown) => error);
    assert.ok(permanentBrand instanceof TranslationProviderError);
  });

  it("D18–D22 cooldown serializes; boot resumes; worker slot concurrency stays 1; no locale branch", async () => {
    assert.equal(resolveContentTranslationWorkerConcurrency(), 1);
    const outcomes: LanguageOwnerFieldOutcome[] = [
      { field: "c1", outcome: "preserved" },
      { field: "c2", outcome: "gap", reason: "missing-preferred-term" },
    ];
    const domain = terminologyDomainFromPreparationResult(
      {
        mode: "execute",
        locale: "xx",
        metadata: {
          locale: "xx",
          englishName: "X",
          nativeName: "X",
          textDirection: "ltr",
          source: "cli",
        },
        brand: { existed: false, status: null, outcomes: [], persisted: false },
        terminology: {
          publishedConcepts: 2,
          outcomes,
          persistedCount: 0,
        },
        providerCalls: 1,
        transientFailure: { kind: "rate_limited", reason: "Gemini HTTP 429" },
      },
      { nowIso: "2026-09-25T12:00:00.000Z" },
    );
    const { emptyPendingDomains } = await import(
      "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js"
    );
    const job = {
      jobId: "lang-act-xx-1-test",
      locale: "xx",
      languageId: "lang-xx",
      generation: 1,
      status: "running" as const,
      domains: {
        ...emptyPendingDomains(),
        terminology: domain,
      },
      lastError: null,
      diagnosticSummary: domain.detail,
      createdAt: "2026-09-25T12:00:00.000Z",
      updatedAt: "2026-09-25T12:00:00.000Z",
      startedAt: "2026-09-25T12:00:00.000Z",
      completedAt: null,
      createdByParticipantId: "admin",
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    };
    const doc = toLanguageActivationJobMongoDocument(job);
    const reloaded = fromLanguageActivationJobMongoDocument(doc);
    assert.equal(reloaded.domains.terminology.status, "in_progress");
    assert.equal(reloaded.domains.terminology.nextAttemptAt, domain.nextAttemptAt);
    assert.equal(reloaded.domains.terminology.lastTransientFailure, "rate_limited");

    // Boot schedules owner cooldown (claimed running job)
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
    const { saveLanguageActivationJob } = await import(
      "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js"
    );
    await saveLanguageActivationJob(job);
    resetLanguageActivationJobSchedulerForTests();
    const boot = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(boot.scheduled >= 1);
    assert.equal(getContentTranslationWorkerPeakConcurrencyForTests() <= 1, true);

    // No locale allowlist in recovery module source
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const recoverySrc = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/activation-provider-transient-recovery.ts",
      ),
      "utf8",
    );
    assert.equal(/zh-Hant|zh-hant|\bka\b|georgian/i.test(recoverySrc), false);
  });
});
