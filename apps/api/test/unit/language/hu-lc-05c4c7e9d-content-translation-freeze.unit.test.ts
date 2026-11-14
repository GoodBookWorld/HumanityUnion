/**
 * HU-LC-05C.4C.7E.9D — automatic Content Translation of user-authored content
 * is frozen. Interface (WEB_UI) localization, readiness, Search/SEO predicates
 * and stored translations keep working. Mocks only; no provider, no Mongo.
 */
import "./hu-lc-05c4c7e9d-content-translation-freeze-env.ts";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  Initiative,
  LanguageActivationJobRecord,
  LanguageRegistryRecord,
  WebUiMessageTree,
} from "@hu/types";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  DeterministicTranslationProvider,
  TranslationProviderError,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  getOrCreateContentTranslation,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
} from "../../../src/modules/language/index.js";
import { isContentTranslationFrozen } from "../../../src/modules/language/translation.config.js";
import { translateDraft } from "../../../src/modules/language/translate-draft.js";
import {
  enqueueContentTranslationWarmRequested,
  listContentTranslationWarmMemoryPendingForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import {
  handleContentTranslationWarmRequestedEvent,
  processContentTranslationWarmRequested,
} from "../../../src/modules/language/content-translation-warm-consumer.js";
import {
  assertAutomaticContentTranslationTargetLocale,
  listAutomaticContentTranslationTargetLocales,
} from "../../../src/modules/language/content-translation-warm-targets.js";
import {
  assertSearchDiscoveryTargetLocale,
  listSearchDiscoveryContentTranslationTargetLocales,
} from "../../../src/modules/language/content-translation-search-discovery-targets.js";
import { enqueueSearchDiscoveryForLocale } from "../../../src/modules/language/content-translation-search-discovery-enqueue.js";
import {
  assessLocalizationReconciliationEligibility,
  resumeLocalizationReconciliationOnBoot,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import { registerPlpAutoBuildProcessor } from "../../../src/modules/language/published-localized-presentation/universal/register-plp-auto-build-processor.js";
import { resolvePublicTranslatedContent } from "../../../src/modules/language/content-translation.service.js";
import { listContentTranslationsForSource } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { evaluateLanguageLocalizationReadiness } from "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js";
import {
  deriveActivationJobStatus,
  emptyPendingDomains,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  fingerprintWebUiEnglishLeaf,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  unflattenWebUiMessageMap,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { loadPackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  processWebUiActivationTick,
  type WebUiActivationPreparationDeps,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";

const RUN = randomBytes(4).toString("hex");
const CT_LOCALE = "xx-c7e9d";
const UI_LOCALE = "eo";
const PATHS = ["common.save", "common.cancel"] as const;
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const readApi = (relative: string) => readFileSync(path.join(apiRoot, relative), "utf8");

const providerTexts: string[] = [];
const initiativeIds = { Public: "", Private: "" };

function initiative(name: "Public" | "Private"): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-7e9d-${name.toLowerCase()}-${RUN}`,
    stewardId: `member-7e9d-${RUN}`,
    createdAt: now,
    updatedAt: now,
    title: `Original ${name} title ${RUN}`,
    description: `Original ${name} description.`,
    status: "proposal",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: name === "Public" ? "public" : "steward_only" },
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
  } as unknown as Initiative;
}

function warmCommand(sourceRecordId: string) {
  return {
    commandName: "ContentTranslationWarmRequested" as const,
    sourceKind: "initiative" as const,
    sourceRecordId,
    requestedAt: new Date().toISOString(),
    reason: "public_mutation" as const,
  };
}

function jobRecord(checkpointId?: string): LanguageActivationJobRecord {
  const now = new Date().toISOString();
  const domains = emptyPendingDomains();
  return {
    jobId: `lang-act-${UI_LOCALE}-1-7e9d-${RUN}`,
    locale: UI_LOCALE,
    languageId: `lang-${UI_LOCALE}`,
    generation: 1,
    status: "running",
    domains: checkpointId ? { ...domains, webUi: { ...domains.webUi, checkpointId } } : domains,
    lastError: null,
    diagnosticSummary: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    createdByParticipantId: null,
    searchEnabledSnapshot: false,
    seoIndexingEnabledSnapshot: false,
  };
}

/** Drives the real WEB_UI activation tick with a recording fake translator. */
async function prepareWebUi(packaged: WebUiMessageTree | null) {
  const sent: string[] = [];
  const deps: WebUiActivationPreparationDeps = {
    includePaths: PATHS,
    loadLiveTerminology: async () => "",
    loadPackagedWebUiCatalog: () => packaged,
    loadBundledWebUiCatalog: () => null,
    readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
    translator: async (request: TranslationProviderRequest) => {
      sent.push(request.text);
      const parsed = JSON.parse(request.text) as Record<string, string[]>;
      const translated: Record<string, string[]> = {};
      for (const [key, spans] of Object.entries(parsed)) {
        translated[key] = spans.map((span, index) => `eo${index}:${span.length}`);
      }
      return {
        translatedText: JSON.stringify(translated),
        providerId: "deterministic" as const,
        isPlaceholder: false as const,
      };
    },
  };
  let result = await processWebUiActivationTick({ job: jobRecord(), deps });
  for (let step = 0; step < 8 && result.needsAnotherTick && !result.published; step += 1) {
    result = await processWebUiActivationTick({
      job: jobRecord(result.checkpoint?.checkpointId),
      checkpointId: result.checkpoint?.checkpointId,
      deps,
    });
  }
  const pack = await getPublishedWebUiMessagePackByLocale(UI_LOCALE);
  const flat = (pack?.messages ?? {}) as { common?: Record<string, string> };
  return { sent, common: flat.common ?? {} };
}

function registryRecord(overrides: Partial<LanguageRegistryRecord>): LanguageRegistryRecord {
  return {
    languageId: "lang-ready-7e9d",
    locale: "uk",
    englishName: "Ukrainian",
    nativeName: "Українська",
    textDirection: "ltr",
    enabled: true,
    contentTranslationEnabled: true,
    searchEnabled: true,
    seoIndexingEnabled: true,
    pwaPersistedReadingEnabled: false,
    ...overrides,
  } as LanguageRegistryRecord;
}

const webUiSlice = (dataReady: boolean) => async () => ({
  engineReady: true as const,
  dataReady,
  requiredKeyCount: 10,
  missingKeyCount: dataReady ? 0 : 3,
  emptyKeyCount: 0,
  englishFallbackKeyCount: 0,
  sampleMissingPaths: dataReady ? [] : ["common.save"],
});

function evaluate(record: LanguageRegistryRecord, webUiReady = true) {
  return evaluateLanguageLocalizationReadiness({
    locale: record.locale,
    registryRecord: record,
    skipCorpusPlan: true,
    revisionInventoryReady: true,
    assessWebUi: webUiSlice(webUiReady),
    assessControlledVocabulary: async () => ({
      presentationReady: true,
      conceptsChecked: 1,
      conceptsWithTerminologyPreferredTerm: 1,
      conceptsWithWebUiFallbackOnly: 0,
      conceptsMissingLocalizedLabel: 0,
      missingLocalizedLabelConceptIds: [],
      missingPreferredTermGaps: [],
    }),
    assessHigherAuthority: async () => ({ brandPublished: true, legalPublished: true, note: null }),
  } as never);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith(".ts") ? [full] : [];
  });
}

describe("HU-LC-05C.4C.7E.9D — Content Translation freeze", () => {
  before(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    setWebUiActivationCheckpointForceMemoryForTests(true);
    setWebUiMessagePackForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    resetWebUiMessagePackStoreForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();

    const deterministic = new DeterministicTranslationProvider();
    setTranslationProviderForTests({
      providerId: "gemini",
      translate: async (request) => {
        providerTexts.push(request.text);
        const result = await deterministic.translate(request);
        return {
          ...result,
          providerId: "gemini",
          isPlaceholder: false,
          translatedText: result.translatedText.split(`[${request.targetLanguage}] `).join("Localized "),
        };
      },
    });

    for (const [locale, contentTranslationEnabled] of [
      [CT_LOCALE, true],
      [UI_LOCALE, false],
    ] as const) {
      await createLanguageRegistryRecord({
        languageId: `lang-${locale}`,
        locale,
        englishName: `Synthetic ${locale}`,
        nativeName: `Synthetic ${locale}`,
        textDirection: "ltr",
        fallbackLocale: "en",
        enabled: true,
        contentTranslationEnabled,
        searchEnabled: true,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
        uiTranslationStatus: "none",
      });
    }
    initiativeIds.Public = createInitiative(initiative("Public")).initiativeId;
    initiativeIds.Private = createInitiative(initiative("Private")).initiativeId;
  });

  after(() => {
    process.env.CONTENT_TRANSLATION_FROZEN = "true";
    deleteInitiative(initiativeIds.Public);
    deleteInitiative(initiativeIds.Private);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    setWebUiActivationCheckpointForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
  });

  it("defaults to frozen unless explicitly disabled", () => {
    const saved = process.env.CONTENT_TRANSLATION_FROZEN;
    try {
      delete process.env.CONTENT_TRANSLATION_FROZEN;
      assert.equal(isContentTranslationFrozen(), true);
      for (const value of ["true", "1", "yes", ""]) {
        process.env.CONTENT_TRANSLATION_FROZEN = value;
        assert.equal(isContentTranslationFrozen(), true, value);
      }
      for (const value of ["false", "0", "no", "off", " FALSE "]) {
        process.env.CONTENT_TRANSLATION_FROZEN = value;
        assert.equal(isContentTranslationFrozen(), false, value);
      }
    } finally {
      process.env.CONTENT_TRANSLATION_FROZEN = saved;
    }
  });

  it("A. no CT provider calls: on-demand generation and Translate Draft are refused", async () => {
    const result = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiativeIds.Public,
      targetLanguage: CT_LOCALE,
      generateIfMissing: true,
      intent: "on_demand",
    });
    assert.equal(result.generated, false);
    assert.equal(result.translation, null);
    await assert.rejects(
      translateDraft({
        sourceRecordId: initiativeIds.Public,
        sourceVersion: "draft",
        sourceLanguage: "en",
        targetLanguage: CT_LOCALE,
        draftContent: "Draft text",
      } as never),
      (error: unknown) => error instanceof TranslationProviderError && error.code === "forbidden",
    );
    const routes = readApi("src/modules/language/language.routes.ts");
    assert.match(routes, /if \(isContentTranslationFrozen\(\)\) \{\s*res\s*\.status\(410\)/);
    assert.deepEqual(providerTexts, []);
  });

  it("B. no new CT warm outbox events", async () => {
    const result = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiativeIds.Public,
      reason: "public_mutation",
    });
    assert.equal(result.enqueued, false);
    assert.equal(result.mode, "skipped");
    assert.equal(result.eventId, null);
    assert.deepEqual(listContentTranslationWarmMemoryPendingForTests(), []);
  });

  it("C. already queued CT events complete as no-ops without retries or provider calls", async () => {
    const processed = await processContentTranslationWarmRequested(warmCommand(initiativeIds.Public));
    assert.equal(processed.outcome, "completed");
    assert.deepEqual(processed.locales, []);
    const missing = await processContentTranslationWarmRequested(warmCommand(`initiative-missing-${RUN}`));
    assert.equal(missing.outcome, "completed", "missing sources must not become retryable");
    await handleContentTranslationWarmRequestedEvent({
      eventId: `event-7e9d-${RUN}`,
      eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
      payload: warmCommand(initiativeIds.Public),
    } as never);
    assert.deepEqual(
      await listContentTranslationsForSource({ sourceKind: "initiative", sourceRecordId: initiativeIds.Public }),
      [],
    );
    assert.deepEqual(providerTexts, []);
  });

  it("D. no CT reconciliation, target selection or CT-triggered PLP work", async () => {
    assert.deepEqual(await listAutomaticContentTranslationTargetLocales(), []);
    await assert.rejects(assertAutomaticContentTranslationTargetLocale(CT_LOCALE), TranslationProviderError);
    const eligibility = await assessLocalizationReconciliationEligibility(CT_LOCALE);
    assert.equal(eligibility.eligible, false);
    assert.equal(eligibility.reason, "content_translation_frozen");
    assert.deepEqual(await resumeLocalizationReconciliationOnBoot(), { scheduled: 0 });
    const plp = await registerPlpAutoBuildProcessor();
    assert.equal(plp.registered, false);
    assert.equal(plp.localesCount, 0);
  });

  it("E. no search-discovery CT enqueue", async () => {
    assert.deepEqual(await listSearchDiscoveryContentTranslationTargetLocales(), []);
    await assert.rejects(assertSearchDiscoveryTargetLocale(CT_LOCALE), TranslationProviderError);
    const enqueue = await enqueueSearchDiscoveryForLocale({
      targetLanguage: CT_LOCALE,
      targets: [{ sourceKind: "initiative", sourceRecordId: initiativeIds.Public }],
    });
    assert.deepEqual(enqueue, { attempted: 0, enqueued: 0, deduped: 0, byKind: {} });
    const service = readApi("src/modules/language/language-registry/language-registry.service.ts");
    assert.match(service, /becameSearchDiscoveryEligible &&\s*!isContentTranslationFrozen\(\)/);
    assert.match(service, /becameCtEligible &&\s*!isContentTranslationFrozen\(\)/);
  });

  it("F/L. original content stays readable, stored translations stay readable, private stays hidden", async () => {
    const original = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiativeIds.Public,
      preferredReadingLanguage: CT_LOCALE,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(original.content.title, `Original Public title ${RUN}`);

    process.env.CONTENT_TRANSLATION_FROZEN = "false";
    try {
      const warmed = await processContentTranslationWarmRequested(warmCommand(initiativeIds.Public));
      assert.equal(warmed.outcome, "completed");
    } finally {
      process.env.CONTENT_TRANSLATION_FROZEN = "true";
    }
    const stored = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiativeIds.Public,
      preferredReadingLanguage: CT_LOCALE,
      translationPreference: "preferred",
      generateIfMissing: true,
    });
    assert.notEqual(stored.presentationMode, "original", "stored translation remains readable");
    assert.equal(stored.originalContent.title, `Original Public title ${RUN}`);

    for (const id of [initiativeIds.Private, `initiative-unknown-${RUN}`]) {
      await assert.rejects(
        resolvePublicTranslatedContent({
          sourceKind: "initiative",
          sourceRecordId: id,
          preferredReadingLanguage: CT_LOCALE,
          generateIfMissing: true,
        }),
        (error: unknown) => error instanceof TranslationProviderError && /not found/i.test(error.message),
      );
    }
    assert.equal(providerTexts.some((text) => text.includes("Original Private")), false);
  });

  it("G. bundled/packaged WEB_UI catalogs are adopted with zero provider calls while frozen", async () => {
    resetWebUiMessagePackStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    const packaged = unflattenWebUiMessageMap({ "common.save": "Konservi", "common.cancel": "Nuligi" });
    const { sent, common } = await prepareWebUi(packaged);
    assert.deepEqual(sent, []);
    assert.equal(common.save, "Konservi");
    assert.equal(common.cancel, "Nuligi");
  });

  it("H. new-language WEB_UI generation stays available for an interface-only locale", async () => {
    resetWebUiMessagePackStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    const { sent, common } = await prepareWebUi(null);
    assert.ok(sent.length > 0, "the WEB_UI translator must still be called");
    assert.equal(typeof common.save, "string");
    assert.equal(typeof common.cancel, "string");
    const job = readApi("src/modules/language/language-localization-activation/language-activation-job.service.ts");
    const eligible = /function assertActivationEligible[\s\S]*?\n}\n/.exec(job)?.[0] ?? "";
    assert.doesNotMatch(eligible, /contentTranslationEnabled/);
    assert.match(job, /shouldReconcileResiduals && webUiReadyForHistorical && contentTranslationActive/);
  });

  it("I. a completed published (Admin-managed) WEB_UI pack is not overwritten", async () => {
    resetWebUiMessagePackStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    const corpus = loadPublicWebUiEnglishCorpus([...PATHS]);
    const complete = structuredClone(loadPackagedWebUiCatalog("uk")) as {
      common: Record<string, string>;
    };
    complete.common.save = "Admin Konservi";
    complete.common.cancel = "Admin Nuligi";
    await upsertWebUiMessagePack({
      locale: UI_LOCALE,
      messages: complete as never,
      status: "published",
      sourceNote: `sourceHash=${hashWebUiEnglishFlatMap(corpus.flat)}`,
      sourceFingerprintsByPath: Object.fromEntries(
        PATHS.map((pathKey) => [pathKey, fingerprintWebUiEnglishLeaf(corpus.flat[pathKey]!)]),
      ),
    });
    const { sent, common } = await prepareWebUi(
      unflattenWebUiMessageMap({ "common.save": "Packaged", "common.cancel": "Packaged" }),
    );
    assert.deepEqual(sent, []);
    assert.equal(common.save, "Admin Konservi");
    assert.equal(common.cancel, "Admin Nuligi");
  });

  it("readiness: interface-only READY, preparation required, and CT intentionally frozen", async () => {
    const ready = await evaluate(registryRecord({}));
    assert.equal(ready.contentTranslationFrozen, true);
    assert.equal(ready.engineReady, false);
    assert.equal(ready.state, "READY");
    assert.equal(ready.languageDataReady, true);
    assert.ok(ready.gaps.includes("Content Translation intentionally frozen (interface-only localization)"));
    assert.equal(ready.ct.workItemsRequired, 0);

    const preparing = await evaluate(registryRecord({}), false);
    assert.equal(preparing.state, "DATA_NOT_READY");
    assert.equal(preparing.languageDataReady, false);

    const disabled = await evaluate(registryRecord({ enabled: false }));
    assert.equal(disabled.state, "DISABLED");

    const domains = emptyPendingDomains();
    const readyDomains = {
      ...domains,
      brand: { ...domains.brand, status: "ready" as const },
      terminology: { ...domains.terminology, status: "ready" as const },
      webUi: { ...domains.webUi, status: "ready" as const, dataReady: true, preparationPhase: "ready" as const },
      controlledVocabulary: { ...domains.controlledVocabulary, status: "ready" as const },
    };
    const status = (readiness: typeof ready) =>
      deriveActivationJobStatus({
        readiness,
        domains: readyDomains as never,
        ctEnqueueAttempted: false,
        plpEnqueueAttempted: false,
      });
    assert.equal(status(ready), "completed", "an interface-only ready locale is not failed");
    assert.equal(status(disabled), "failed");
  });

  it("J. Search and SEO readiness still follow Registry flags without translated content", async () => {
    const report = await evaluate(registryRecord({ searchEnabled: true, seoIndexingEnabled: true }));
    assert.equal(report.searchLocalizationReady, true);
    assert.equal(report.seoReady, true);
    const noSeo = await evaluate(registryRecord({ seoIndexingEnabled: false }));
    assert.equal(noSeo.seoReady, false);
  });

  it("K. the shared outbox and its other consumers are untouched by the freeze", async () => {
    const infrastructure = sourceFiles(path.join(apiRoot, "src/infrastructure"));
    for (const file of infrastructure) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /isContentTranslationFrozen|CONTENT_TRANSLATION_FROZEN/, file);
    }
    await handleContentTranslationWarmRequestedEvent({
      eventId: `event-other-${RUN}`,
      eventName: "PetitionSigned",
      payload: {},
    } as never);
    assert.deepEqual(providerTexts.filter((text) => !text.includes("Original Public")), []);
  });
});
