/**
 * Step 15C — Durable server-side WEB_UI activation (one batch per tick).
 * Deterministic provider only. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { BrandLocalizationRecord } from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
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
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startAndProcessLanguageActivationJobForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  getBrandLocalizationByLocale,
  resetBrandLocalizationStoreForTests,
  setBrandLocalizationForceMemoryForTests,
} from "../../../src/modules/brand-localization/brand-localization.repository.js";
import {
  resetLegalLocalizationStoreForTests,
  setLegalLocalizationForceMemoryForTests,
} from "../../../src/modules/legal-localization/legal-localization.repository.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import { loadBundledEnglishWebUiMessagePack } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import { runLanguageOwnerPreparation } from "../../../src/modules/language-preparation/language-owner-preparation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");

const INCLUDE_PATHS = [
  "common.language",
  "common.save",
  "common.cancel",
  "common.loading",
  "common.error",
  "common.retry",
  "common.backToHome",
  "common.show",
] as const;

function translateFlat(request: TranslationProviderRequest): TranslationProviderResult {
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

describe("Step 15C — durable WEB_UI activation", () => {
  let providerCalls = 0;
  let lastTerminologyContext = "";
  const brands = new Map<string, BrandLocalizationRecord>();

  beforeEach(async () => {
    providerCalls = 0;
    lastTerminologyContext = "";
    brands.clear();
    resetContentTranslationWorkerConcurrencyForTests();
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setTerminologyGlossaryForceMemoryForTests(true);
    resetTerminologyGlossaryStoreForTests();
    await ensureTerminologyGlossarySeeded();
    setBrandLocalizationForceMemoryForTests(true);
    resetBrandLocalizationStoreForTests();
    setLegalLocalizationForceMemoryForTests(true);
    resetLegalLocalizationStoreForTests();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-15c",
    }));
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
  });

  async function createEligibleLocale(locale: string) {
    return createLanguageRegistryRecord({
      locale,
      englishName: `Test ${locale}`,
      nativeName: locale,
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

  function installDeps(input?: {
    readonly translator?: (
      request: TranslationProviderRequest,
    ) => Promise<TranslationProviderResult>;
    readonly skipOwner?: boolean;
    readonly identityTranslator?: boolean;
  }) {
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: input?.skipOwner !== false,
      activate: async (activateInput) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: activateInput.locale,
          skipCorpusPlan: true,
        });
        return {
          pack: "closure07" as const,
          locale: activateInput.locale,
          mode: "execute" as const,
          readiness,
          plan: {
            pack: "closure07" as const,
            locale: activateInput.locale,
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
            notes: ["15c test activate no-op"],
          },
          PROVIDER_CALLS: 0 as const,
          WRITES_PERFORMED: 0 as const,
          seoIndexingEnabledUnchanged: true,
        };
      },
      webUiPreparationDeps: {
        includePaths: INCLUDE_PATHS,
        loadLiveTerminology: async () => {
          lastTerminologyContext = "LIVE_GLOSSARY_FOR_TEST";
          return lastTerminologyContext;
        },
        translator: async (request) => {
          providerCalls += 1;
          assert.match(request.terminologyContext ?? "", /LIVE_GLOSSARY_FOR_TEST/);
          if (input?.identityTranslator) {
            return {
              translatedText: request.text,
              providerId: "identity",
              isPlaceholder: false,
            };
          }
          if (input?.translator) {
            return input.translator(request);
          }
          return translateFlat(request);
        },
        env: { TRANSLATION_PROVIDER: "gemini" },
      },
    });
  }

  it("1 — skip generation when effective public catalog already dataReady", async () => {
    const record = await createEligibleLocale("vo");
    await upsertWebUiMessagePack({
      locale: "vo",
      status: "published",
      messages: loadBundledEnglishWebUiMessagePack() as never,
      sourceNote: "preexisting",
    });
    installDeps();
    const before = providerCalls;
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(providerCalls, before);
    assert.equal(view.job?.domains.webUi.dataReady, true);
    assert.equal(view.job?.domains.webUi.status, "ready");
    assert.equal(await getWebUiActivationCheckpointByJobId(view.job!.jobId), null);
  });

  it("2 — live terminology flag (never english-seed) on activation path", async () => {
    const record = await createEligibleLocale("eo");
    installDeps();
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.ok(providerCalls > 0);
    assert.equal(lastTerminologyContext, "LIVE_GLOSSARY_FOR_TEST");
    const checkpoint = await getWebUiActivationCheckpointByJobId(view.job!.jobId);
    assert.equal(checkpoint?.terminologyMode, "live");
    const pack = await getPublishedWebUiMessagePackByLocale("eo");
    assert.ok(pack);
    assert.match(pack.sourceNote ?? "", /live terminology/i);
  });

  it("3 — provider concurrency stays 1 across WEB_UI ticks", async () => {
    const record = await createEligibleLocale("sw");
    installDeps({
      translator: async (request) => {
        assert.equal(getContentTranslationWorkerPeakConcurrencyForTests(), 1);
        return translateFlat(request);
      },
    });
    await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.ok(providerCalls >= 2);
    assert.equal(getContentTranslationWorkerPeakConcurrencyForTests(), 1);
  });

  it("4 — resume after simulated restart via persisted batch docs", async () => {
    const record = await createEligibleLocale("jv");
    installDeps();
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    // One tick only — partial checkpoint.
    let job = await processLanguageActivationJob(started.job!.jobId, {
      reconcileResiduals: true,
    });
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.status, "in_progress");
    const checkpointId = job.domains.webUi.checkpointId;
    assert.ok(checkpointId);
    const batchesAfterFirst = await listWebUiActivationBatches(checkpointId, "primary");
    assert.ok(batchesAfterFirst.some((b) => b.status === "ok"));
    const callsAfterFirst = providerCalls;

    // Simulate restart: clear in-memory scheduler, resume via boot + tick drain.
    resetLanguageActivationJobSchedulerForTests();
    const resumed = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(resumed.scheduled >= 1);
    // Drain synchronously instead of waiting for setImmediate.
    let guard = 0;
    while (
      job.status === "running" &&
      job.domains.webUi.status === "in_progress" &&
      guard < 100
    ) {
      guard += 1;
      job = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    }
    assert.ok(providerCalls > callsAfterFirst);
    const pack = await getPublishedWebUiMessagePackByLocale("jv");
    assert.ok(pack);
    assert.equal(pack.status, "published");
  });

  it("5 — sourceHash mismatch fails WEB_UI domain safely", async () => {
    const record = await createEligibleLocale("ia");
    installDeps();
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    let job = await processLanguageActivationJob(started.job!.jobId, {
      reconcileResiduals: true,
    });
    const checkpoint = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.ok(checkpoint);
    await upsertWebUiActivationCheckpoint({
      ...checkpoint,
      sourceHash: "stale-hash-does-not-match",
    });
    job = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    assert.equal(job.status, "failed");
    assert.equal(job.domains.webUi.status, "failed");
    assert.match(job.domains.webUi.detail ?? "", /source catalog changed/i);
  });

  it("6 — structure protection round-trip (placeholders survive restore)", async () => {
    const { protectWebUiMessageForProvider, restoreWebUiMessageFromProvider } =
      await import(
        "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js"
      );
    const english = "Hello {name}, visit https://example.com";
    const protectedMsg = protectWebUiMessageForProvider(english);
    const restored = restoreWebUiMessageFromProvider(
      `[xx] ${protectedMsg.text}`,
      english,
    );
    assert.match(restored, /\{name\}/);
    assert.match(restored, /https:\/\/example\.com/);
  });

  it("7 — quality phase runs for suspicious English-identical paths only", async () => {
    const record = await createEligibleLocale("ie");
    let qualitySeen = false;
    installDeps({
      translator: async (request) => {
        providerCalls += 1;
        // First passes: leave English identical so quality retries.
        if (providerCalls <= 2) {
          return {
            translatedText: request.text,
            providerId: "identity",
            isPlaceholder: false,
          };
        }
        qualitySeen = true;
        return translateFlat(request);
      },
    });
    await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(qualitySeen, true);
    const pack = await getPublishedWebUiMessagePackByLocale("ie");
    assert.ok(pack);
  });

  it("8 — validate-before-publish; no publish on validation failure", async () => {
    const record = await createEligibleLocale("io");
    installDeps({
      translator: async (request) => {
        providerCalls += 1;
        // Omit a key → structure/complete validation fails after primary.
        const parsed = JSON.parse(request.text) as Record<string, string>;
        const keys = Object.keys(parsed);
        if (keys.length > 0) {
          delete parsed[keys[0]!];
        }
        return {
          translatedText: JSON.stringify(parsed),
          providerId: "broken",
          isPlaceholder: false,
        };
      },
    });
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.job?.status, "failed");
    assert.equal(await getPublishedWebUiMessagePackByLocale("io"), null);
  });

  it("9 — successful path publishes via upsertWebUiMessagePack", async () => {
    const record = await createEligibleLocale("yi");
    installDeps();
    await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    const pack = await getPublishedWebUiMessagePackByLocale("yi");
    assert.ok(pack);
    assert.equal(pack.status, "published");
    assert.match(pack.sourceNote ?? "", /Language activation/);
    assert.equal((pack.messages as { common?: { save?: string } }).common?.save?.startsWith("[xx]"), true);
  });

  it("10 — Brand remains draft/advisory (no auto-publish)", async () => {
    const record = await createEligibleLocale("cy");
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: false,
      skipWebUiPreparation: true,
      activate: async (activateInput) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: activateInput.locale,
          skipCorpusPlan: true,
        });
        return {
          pack: "closure07" as const,
          locale: activateInput.locale,
          mode: "execute" as const,
          readiness,
          plan: {
            pack: "closure07" as const,
            locale: activateInput.locale,
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
      },
      runOwnerPreparation: async (input) =>
        runLanguageOwnerPreparation({
          ...input,
          translator: async (request) => {
            providerCalls += 1;
            return translateFlat(request);
          },
          env: { TRANSLATION_PROVIDER: "gemini" },
          saveBrand: async (brand) => {
            brands.set(brand.locale, brand);
            return brand;
          },
          loadBrand: async (locale) => brands.get(locale) ?? null,
        }),
    });
    await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    const brand = brands.get("cy") ?? (await getBrandLocalizationByLocale("cy"));
    assert.ok(brand);
    assert.equal(brand.status, "draft");
  });

  it("11 — status refresh never calls the translator", async () => {
    const record = await createEligibleLocale("gd");
    installDeps();
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    await processLanguageActivationJob(started.job!.jobId, {
      reconcileResiduals: true,
    });
    const callsAfterTick = providerCalls;
    await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
      refreshJob: true,
    });
    assert.equal(providerCalls, callsAfterTick);
  });

  it("12 — arbitrary locale; no ka/he production branches in activation modules", () => {
    const files = [
      "language-activation-job.service.ts",
      "language-activation-job.domains.ts",
      path.join(apiSrc, "modules/web-ui-message-packs/web-ui-activation-preparation.ts"),
    ];
    for (const file of files) {
      const full = file.startsWith("/")
        ? file
        : path.join(
            apiSrc,
            "modules/language/language-localization-activation",
            file,
          );
      const source = readFileSync(full, "utf8");
      assert.doesNotMatch(source, /locale\s*===\s*["']ka["']/);
      assert.doesNotMatch(source, /locale\s*===\s*["']he["']/);
    }
  });

  it("13 — Search/SEO flags untouched by WEB_UI activation", async () => {
    const record = await createEligibleLocale("gl");
    assert.equal(record.searchEnabled, false);
    assert.equal(record.seoIndexingEnabled, false);
    installDeps();
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.searchEnabled, false);
    assert.equal(view.seoIndexingEnabled, false);
    assert.equal(view.job?.searchEnabledSnapshot, false);
    assert.equal(view.job?.seoIndexingEnabledSnapshot, false);
  });

  it("14 — incomplete catalog is never published mid-primary", async () => {
    const record = await createEligibleLocale("rm");
    installDeps();
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    await processLanguageActivationJob(started.job!.jobId, {
      reconcileResiduals: true,
    });
    assert.equal(await getPublishedWebUiMessagePackByLocale("rm"), null);
  });

  it("15 — checkpoint terminologyMode is live", async () => {
    const record = await createEligibleLocale("qu");
    installDeps();
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    await processLanguageActivationJob(started.job!.jobId, {
      reconcileResiduals: true,
    });
    const checkpoint = await getWebUiActivationCheckpointByJobId(started.job!.jobId);
    assert.equal(checkpoint?.terminologyMode, "live");
  });
});
