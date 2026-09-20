/**
 * Step 15B — Brand + Terminology automatic preparation inside LanguageActivationJob.
 * Deterministic provider only. No Gemini. No WEB_UI generation. No staging writes.
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
  listTerminologyConcepts,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";
import {
  resetBrandLocalizationStoreForTests,
  setBrandLocalizationForceMemoryForTests,
} from "../../../src/modules/brand-localization/brand-localization.repository.js";
import {
  resetLegalLocalizationStoreForTests,
  setLegalLocalizationForceMemoryForTests,
} from "../../../src/modules/legal-localization/legal-localization.repository.js";
import {
  getLanguageActivationAdminView,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startAndProcessLanguageActivationJobForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { runLanguageOwnerPreparation } from "../../../src/modules/language-preparation/language-owner-preparation.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");
const executeEnv = { TRANSLATION_PROVIDER: "gemini" };

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

describe("Step 15B — activation Brand + Terminology preparation", () => {
  const brands = new Map<string, BrandLocalizationRecord>();
  let providerCalls = 0;
  let brandSaveCount = 0;

  function installOwnerPrepDeps(input?: {
    readonly translator?: (
      request: TranslationProviderRequest,
    ) => Promise<TranslationProviderResult>;
    readonly failOwnerPreparation?: string;
  }) {
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
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
            notes: ["15b test activate no-op"],
          },
          PROVIDER_CALLS: 0 as const,
          WRITES_PERFORMED: 0 as const,
          seoIndexingEnabledUnchanged: true,
        };
      },
      runOwnerPreparation: input?.failOwnerPreparation
        ? async () => {
            throw new Error(input.failOwnerPreparation);
          }
        : async (prepInput) =>
            runLanguageOwnerPreparation({
              ...prepInput,
              env: executeEnv,
              resolveRegistryLocale: async (locale) => ({
                locale,
                englishName: `Test ${locale}`,
                nativeName: locale,
                textDirection: "ltr",
              }),
              getBrand: async (locale) => brands.get(locale) ?? null,
              getEnglishBrand: async () => brands.get("en") ?? null,
              saveBrand: async (record) => {
                brandSaveCount += 1;
                brands.set(record.locale, record);
                return record;
              },
              // Terminology uses the real Glossary repository (seed + updates).
              translator: async (request) => {
                providerCalls += 1;
                if (input?.translator) {
                  return input.translator(request);
                }
                return translateFlat(request);
              },
              log: () => undefined,
            }),
    });
  }

  beforeEach(async () => {
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
      participantId: "participant-admin-15b",
    }));

    brands.clear();
    brandSaveCount = 0;
    providerCalls = 0;
    brands.set("en", {
      brandId: "brand-en",
      locale: "en",
      siteName: "Humanity Union",
      slogan: "WORLD SOLIDARITY",
      heroUnityQuote: "quote",
      seoSiteName: "Humanity Union",
      defaultMetaDescription: "desc",
      shortName: "Humanity",
      status: "published",
      createdAt: "t0",
      updatedAt: "t0",
    });
    installOwnerPrepDeps();
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetTerminologyGlossaryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    resetBrandLocalizationStoreForTests();
    setBrandLocalizationForceMemoryForTests(false);
    resetLegalLocalizationStoreForTests();
    setLegalLocalizationForceMemoryForTests(false);
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

  it("1–3 Brand preserve / generate / draft status", async () => {
    brands.set("eo", {
      brandId: "brand-eo",
      locale: "eo",
      siteName: "Existing Site",
      slogan: "",
      heroUnityQuote: "",
      seoSiteName: "",
      defaultMetaDescription: "",
      status: "draft",
      createdAt: "t0",
      updatedAt: "t0",
    });
    const record = await createEligibleLocale("eo");
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(brands.get("eo")?.siteName, "Existing Site");
    assert.match(brands.get("eo")?.slogan ?? "", /^\[xx] /);
    assert.equal(brands.get("eo")?.status, "draft");
    assert.equal(view.job?.domains.brand.status, "ready");
    assert.equal(view.job?.domains.brand.reviewRequired, true);
    assert.match(view.job?.domains.brand.detail ?? "", /review available/i);
  });

  it("4–5 Terminology preserve / generate preferredTerm", async () => {
    const record = await createEligibleLocale("eo");
    await updateTerminologyConcept("assistant", {
      translations: { eo: { preferredTerm: "Asistanto", aliases: [] } },
    });
    await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    const listed = await listTerminologyConcepts();
    assert.equal(
      listed.find((row) => row.conceptId === "assistant")?.translations.eo?.preferredTerm,
      "Asistanto",
    );
    assert.match(
      listed.find((row) => row.conceptId === "helpful")?.translations.eo?.preferredTerm ?? "",
      /^\[xx] /,
    );
  });

  it("6 helpful / not_helpful are Terminology seed concepts", async () => {
    const ids = TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.map((row) => row.conceptId);
    assert.ok(ids.includes("helpful"));
    assert.ok(ids.includes("not_helpful"));
    const listed = await listTerminologyConcepts();
    assert.ok(listed.some((row) => row.conceptId === "helpful"));
    assert.ok(listed.some((row) => row.conceptId === "not_helpful"));
  });

  it("7 partial provider failure preserves successful Brand values", async () => {
    let calls = 0;
    installOwnerPrepDeps({
      translator: async (request) => {
        calls += 1;
        if (calls === 1) {
          return translateFlat(request);
        }
        throw new TranslationProviderError("timeout", "timed out");
      },
    });
    const record = await createEligibleLocale("eo");
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.ok(brands.get("eo")?.siteName);
    assert.equal(view.job?.domains.brand.status, "ready");
    assert.equal(view.job?.domains.terminology.status, "failed");
    assert.equal(view.job?.status, "failed");
    assert.equal(view.job?.domains.terminology.providerFailure, true);
  });

  it("8 provider config failure is owner failure, not waiting_for_data", async () => {
    installOwnerPrepDeps({
      failOwnerPreparation: "REFUSED: --execute requires TRANSLATION_PROVIDER=gemini.",
    });
    const record = await createEligibleLocale("eo");
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.job?.status, "failed");
    assert.notEqual(view.job?.status, "waiting_for_data");
    assert.equal(view.job?.domains.brand.providerFailure, true);
  });

  it("9–10 retry / re-click only fills remaining gaps and does not duplicate Brand", async () => {
    const record = await createEligibleLocale("eo");
    const first = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    const brandId = brands.get("eo")?.brandId;
    const callsAfterFirst = providerCalls;
    const savesAfterFirst = brandSaveCount;
    assert.ok(brandId);
    assert.equal(first.job?.domains.brand.status, "ready");

    await updateTerminologyConcept("helpful", {
      removeTranslationLocales: ["eo"],
    });

    const second = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(brands.get("eo")?.brandId, brandId);
    assert.equal(brandSaveCount, savesAfterFirst);
    assert.ok(providerCalls > callsAfterFirst);
    assert.ok((second.job?.domains.terminology.conceptsGenerated ?? 0) >= 1);
    const listed = await listTerminologyConcepts();
    assert.match(
      listed.find((row) => row.conceptId === "helpful")?.translations.eo?.preferredTerm ?? "",
      /^\[xx] /,
    );
  });

  it("11 no provider on HTTP start / status refresh path", async () => {
    const record = await createEligibleLocale("eo");
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(providerCalls, 0);
    assert.equal(started.job?.status, "queued");

    await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
      refreshJob: true,
    });
    assert.equal(providerCalls, 0);
  });

  it("12 WEB_UI remains measurement-only; waiting_for_data when catalog missing", async () => {
    const record = await createEligibleLocale("eo");
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.job?.domains.webUi.dataReady, false);
    assert.equal(view.job?.domains.webUi.status, "waiting_for_data");
    assert.equal(view.job?.status, "waiting_for_data");
    assert.equal(view.job?.domains.terminology.status, "ready");
    assert.equal(view.job?.domains.controlledVocabulary.presentationReady, true);
  });

  it("13–15 CT/PLP path unchanged; arbitrary locale; no ka/he special case", async () => {
    const record = await createEligibleLocale("gl");
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.job?.locale, "gl");
    assert.ok(view.job?.domains.ct);
    assert.ok(view.job?.domains.plp);

    const service = readFileSync(
      path.join(
        apiSrc,
        "modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(service, /\bka\b|\bhe\b/);
    assert.match(service, /runLanguageOwnerPreparation|runOwnerPreparation/);
    assert.match(service, /owners: \["brand"\]/);
    assert.match(service, /owners: \["terminology"\]/);
  });
});
