/**
 * STEP F.3.22 — reuse valid WEB_UI leaves and repair only residuals.
 * No live provider. No locale-specific repair.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { LanguageActivationJobRecord, WebUiMessageTree } from "@hu/types";
import { WEB_UI_PARTIAL_REUSE_CONTRACT } from "../../../src/modules/web-ui-message-packs/web-ui-leaf-reuse.js";

import { LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT } from "../../../src/modules/language/localization-provider-governor.js";
import { emptyPendingDomains, isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  getWebUiActivationBatch,
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  fingerprintWebUiEnglishLeaf,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
  unflattenWebUiMessageMap,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { classifyWebUiLeafForReuse } from "../../../src/modules/web-ui-message-packs/web-ui-leaf-reuse.js";
import { processWebUiActivationTick } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import type { WebUiActivationPreparationDeps } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { WEB_UI_PROVIDER_SHAPE_VERSION } from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALE = "eo";
const SAVE = "common.save";
const CANCEL = "common.cancel";
const SHOWING = "blogPublic.pagination.showingCount";
const PREFS = "preferences.title";
const SHARED = "auth.currentPassword";

function tree(flat: Record<string, string>): WebUiMessageTree {
  return unflattenWebUiMessageMap(flat);
}

async function publishProven(localized: Record<string, string>): Promise<void> {
  const corpus = loadPublicWebUiEnglishCorpus(Object.keys(localized));
  const sourceFingerprintsByPath: Record<string, string> = {};
  for (const pathKey of Object.keys(localized)) {
    const english = corpus.flat[pathKey];
    if (typeof english === "string") {
      sourceFingerprintsByPath[pathKey] = fingerprintWebUiEnglishLeaf(english);
    }
  }
  await upsertWebUiMessagePack({
    locale: LOCALE,
    messages: tree(localized),
    status: "published",
    sourceNote: `sourceHash=${hashWebUiEnglishFlatMap(corpus.flat)}`,
    sourceFingerprintsByPath,
  });
}

function jobRecord(checkpointId?: string): LanguageActivationJobRecord {
  const now = "2026-09-29T00:00:00.000Z";
  const domains = emptyPendingDomains();
  return {
    jobId: `lang-act-${LOCALE}-9-f322`,
    locale: LOCALE,
    languageId: `lang-${LOCALE}`,
    generation: 9,
    status: "running",
    domains: checkpointId
      ? {
          ...domains,
          webUi: { ...domains.webUi, checkpointId },
        }
      : domains,
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

function recordingTranslator(sent: string[][]) {
  return async (request: TranslationProviderRequest) => {
    const parsed = JSON.parse(request.text) as Record<string, string[]>;
    sent.push(Object.keys(parsed).sort());
    const translated: Record<string, string[]> = {};
    for (const [key, spans] of Object.entries(parsed)) {
      translated[key] = spans.map((span, index) => `ل${index}:${span.length}`);
    }
    return {
      translatedText: JSON.stringify(translated),
      providerId: "deterministic" as const,
      isPlaceholder: false as const,
    };
  };
}

async function drain(input: {
  readonly paths: readonly string[];
  readonly packaged?: WebUiMessageTree | null;
  readonly bundled?: WebUiMessageTree | null;
  readonly translator: WebUiActivationPreparationDeps["translator"];
  readonly checkpointId?: string;
}) {
  const sent: string[][] = [];
  const deps: WebUiActivationPreparationDeps = {
    includePaths: input.paths,
    loadLiveTerminology: async () => "",
    loadPackagedWebUiCatalog: () => input.packaged ?? null,
    loadBundledWebUiCatalog: () => input.bundled ?? null,
    readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
    translator: input.translator ?? recordingTranslator(sent),
  };
  let result = await processWebUiActivationTick({
    job: jobRecord(input.checkpointId),
    checkpointId: input.checkpointId,
    deps,
  });
  for (let step = 0; step < 8 && result.needsAnotherTick && !result.published; step += 1) {
    result = await processWebUiActivationTick({
      job: jobRecord(result.checkpoint?.checkpointId),
      checkpointId: result.checkpoint?.checkpointId,
      deps,
    });
  }
  return { result, sent, deps };
}

describe("STEP F.3.22 partial WEB_UI reuse", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setWebUiActivationCheckpointForceMemoryForTests(true);
    setWebUiMessagePackForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    resetWebUiMessagePackStoreForTests();
    await ensureLanguageRegistrySeeded();
    await createLanguageRegistryRecord({
      locale: LOCALE,
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
  });

  afterEach(() => {
    setLanguageRegistryForceMemoryForTests(false);
    setWebUiActivationCheckpointForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
  });

  it("classifies structural, placeholder, ICU, brand, and stale leaves as not reusable", () => {
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "Save",
        candidates: [{ source: "MONGO_PUBLISHED", value: "حفظ", provenCurrent: true }],
      }).classification,
      "REUSE_CURRENT",
    );
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "Save",
        candidates: [{ source: "PACKAGED", value: "حفظ", provenCurrent: false }],
      }).classification,
      "STALE_SOURCE",
    );
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "Showing {count} article",
        candidates: [{ source: "PACKAGED", value: "عرض", provenCurrent: false }],
      }).classification,
      "STRUCTURE_INCOMPATIBLE",
    );
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "Try again",
        candidates: [{ source: "BUNDLED", value: "حاول {count}", provenCurrent: false }],
      }).classification,
      "STRUCTURE_INCOMPATIBLE",
    );
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "{count, plural, one {# article} other {# articles}}",
        candidates: [
          {
            source: "PACKAGED",
            value: "{count, plural, one {# article}",
            provenCurrent: true,
          },
        ],
      }).classification,
      "STRUCTURE_INCOMPATIBLE",
    );
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "Save",
        candidates: [
          {
            source: "PACKAGED",
            value: "حفظ __HU_BRAND_SITE_NAME__",
            provenCurrent: true,
          },
        ],
      }).classification,
      "INVALID_TRANSLATION",
    );
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "Save",
        candidates: [{ source: "MONGO_PUBLISHED", value: "حفظ", provenCurrent: false }],
      }).classification,
      "STALE_SOURCE",
    );
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "Save",
        candidates: [{ source: "PACKAGED", value: "   ", provenCurrent: true }],
      }).classification,
      "INVALID_TRANSLATION",
    );
    assert.equal(
      classifyWebUiLeafForReuse({
        english: "Save",
        candidates: [],
      }).classification,
      "MISSING",
    );
  });

  it("A/M/O/Q/R. one invalid published leaf is the only provider work, then the full candidate publishes", async () => {
    const sent: string[][] = [];
    await publishProven({ [SAVE]: "حفظ" });
    const { result } = await drain({
      paths: [SAVE, SHOWING],
      translator: recordingTranslator(sent),
    });
    assert.equal(result.published, true);
    assert.deepEqual(sent, [[SHOWING]]);
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobRecord().jobId);
    assert.equal(checkpoint?.preparationContract, WEB_UI_PARTIAL_REUSE_CONTRACT);
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    const reused = batches.find((batch) => batch.preparationProvenance === "REUSED_EXISTING_VALID");
    assert.ok(reused);
    assert.equal(reused?.attempts, 0);
    assert.equal(reused?.reuseSource, "MONGO_PUBLISHED");
    assert.equal(reused?.values[SAVE], "حفظ");
    const pack = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.ok(pack);
    assert.equal(
      (pack?.messages as { common?: { save?: string } }).common?.save,
      "حفظ",
    );
    const showing = (pack?.messages as { blogPublic?: { pagination?: { showingCount?: string } } })
      .blogPublic?.pagination?.showingCount;
    assert.equal(typeof showing, "string");
    assert.match(showing ?? "", /\{count\}/);
  });

  it("B/E. multiple residuals are sent and valid participant leaves are not", async () => {
    const sent: string[][] = [];
    await publishProven({ [CANCEL]: "", [PREFS]: "تفضيلات" });
    await drain({
      paths: [SAVE, CANCEL, PREFS],
      translator: recordingTranslator(sent),
    });
    const flatSent = sent.flat().sort();
    assert.deepEqual(flatSent, [CANCEL, SAVE].sort());
    assert.equal(flatSent.includes(PREFS), false);
  });

  it("C/F/G. missing public leaf is repaired and valid participant plus shared leaves are reused once", async () => {
    const sent: string[][] = [];
    await publishProven({
      [PREFS]: "تفضيلات",
      [SHARED]: "كلمة المرور",
    });
    await drain({
      paths: [SHOWING, PREFS, SHARED],
      translator: recordingTranslator(sent),
    });
    assert.deepEqual(sent.flat(), [SHOWING]);
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobRecord().jobId);
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    const shared = batches.find((batch) => batch.keys.includes(SHARED));
    assert.equal(shared?.values[SHARED], "كلمة المرور");
    assert.equal(shared?.attempts, 0);
    const prefs = batches.find((batch) => batch.keys.includes(PREFS));
    assert.equal(prefs?.values[PREFS], "تفضيلات");
    assert.equal(prefs?.attempts, 0);
  });

  it("D. an empty required leaf is repaired and the valid sibling is reused", async () => {
    const sent: string[][] = [];
    await publishProven({ [SAVE]: "حفظ", [CANCEL]: "  " });
    await drain({
      paths: [SAVE, CANCEL],
      translator: recordingTranslator(sent),
    });
    assert.deepEqual(sent.flat(), [CANCEL]);
  });

  it("L. a fingerprint-matched Mongo pack preserves its valid values", async () => {
    await publishProven({ [SAVE]: "منشور" });
    const sent: string[][] = [];
    await drain({
      paths: [SAVE, SHOWING],
      packaged: null,
      translator: recordingTranslator(sent),
    });
    assert.deepEqual(sent.flat(), [SHOWING]);
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobRecord().jobId);
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    const reused = batches.find((batch) => batch.keys.includes(SAVE));
    assert.equal(reused?.reuseSource, "MONGO_PUBLISHED");
    assert.equal(reused?.values[SAVE], "منشور");
    assert.equal(reused?.attempts, 0);
  });

  it("N. bundled leaves without leaf-source proof are not reused", async () => {
    const sent: string[][] = [];
    await drain({
      paths: [SAVE, SHOWING],
      packaged: null,
      bundled: tree({ [SAVE]: "حفظ", [SHOWING]: "عرض" }),
      translator: recordingTranslator(sent),
    });
    assert.deepEqual(sent.flat().sort(), [SAVE, SHOWING].sort());
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobRecord().jobId);
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    const reused = batches.find((batch) => batch.reuseSource === "BUNDLED");
    assert.equal(reused, undefined);
  });

  it("P. incomplete residual repair does not publish a partial pack", async () => {
    await publishProven({ [SAVE]: "حفظ" });
    await drain({
      paths: [SAVE, SHOWING],
      translator: async () => {
        throw new Error("provider unavailable for test");
      },
    });
    const pack = await getPublishedWebUiMessagePackByLocale(LOCALE);
    assert.equal(pack?.revision, 1);
    assert.equal(
      (pack?.messages as { blogPublic?: { pagination?: { showingCount?: string } } }).blogPublic
        ?.pagination?.showingCount,
      undefined,
    );
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobRecord().jobId);
    const reused = await getWebUiActivationBatch({
      checkpointId: checkpoint!.checkpointId,
      batchId: planWebUiDraftBatches(loadPublicWebUiEnglishCorpus([SAVE]).flat)[0]!.id,
      phase: "primary",
    });
    assert.equal(reused?.status, "ok");
    assert.equal(reused?.attempts, 0);
  });

  it("S/T. a later tick does not resend reused or repaired leaves", async () => {
    const sent: string[][] = [];
    const translator = recordingTranslator(sent);
    await publishProven({ [SAVE]: "حفظ" });
    const deps: WebUiActivationPreparationDeps = {
      includePaths: [SAVE, SHOWING],
      loadLiveTerminology: async () => "",
      loadPackagedWebUiCatalog: () => null,
      loadBundledWebUiCatalog: () => null,
      readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
      translator,
    };
    const first = await processWebUiActivationTick({ job: jobRecord(), deps });
    const second = await processWebUiActivationTick({
      job: jobRecord(first.checkpoint?.checkpointId),
      checkpointId: first.checkpoint?.checkpointId,
      deps,
    });
    assert.deepEqual(sent, [[SHOWING]]);
    assert.equal(second.published || second.needsAnotherTick || second.providerCalls === 0, true);
    const batches = await listWebUiActivationBatches(first.checkpoint!.checkpointId, "primary");
    const reused = batches.find((batch) => batch.preparationProvenance === "REUSED_EXISTING_VALID");
    assert.equal(reused?.attempts, 0);
    assert.equal(reused?.values[SAVE], "حفظ");
  });

  it("U. an older shape-v3 checkpoint still sends its full batch", async () => {
    const corpus = loadPublicWebUiEnglishCorpus([SAVE, CANCEL]);
    const plan = planWebUiDraftBatches(corpus.flat);
    const checkpointId = "webui-act-old-shape";
    const now = "2026-09-29T00:00:00.000Z";
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId: jobRecord().jobId,
      locale: LOCALE,
      generation: 9,
      sourceHash: hashWebUiEnglishFlatMap(corpus.flat),
      terminologyMode: "live",
      phase: "primary",
      leafCount: corpus.requiredPaths.length,
      batchCount: plan.length,
      completedBatchCount: 0,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: "Preparing public interface…",
      createdAt: now,
      updatedAt: now,
      providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
    });
    const sent: string[][] = [];
    await processWebUiActivationTick({
      job: jobRecord(checkpointId),
      checkpointId,
      deps: {
        includePaths: [SAVE, CANCEL],
        loadLiveTerminology: async () => "",
        loadPackagedWebUiCatalog: () => tree({ [SAVE]: "حفظ", [CANCEL]: "إلغاء" }),
        loadBundledWebUiCatalog: () => null,
        readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
        translator: recordingTranslator(sent),
      },
    });
    assert.deepEqual(sent.flat().sort(), [CANCEL, SAVE].sort());
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobRecord().jobId);
    assert.equal(checkpoint?.checkpointId, checkpointId);
    assert.equal(checkpoint?.generation, 9);
    assert.equal(checkpoint?.preparationContract ?? null, null);
  });

  it("W/X/Y/Z. gate, pacing, shape version, and 99 percent stay in place", () => {
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: emptyPendingDomains().webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: true,
      }),
      false,
    );
    assert.equal(LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT, 10_000);
    assert.equal(WEB_UI_PROVIDER_SHAPE_VERSION, 4);
    const progress = readFileSync(
      path.resolve(
        here,
        "../../../../web/src/features/administration/admin-languages-localization-progress.ts",
      ),
      "utf8",
    );
    assert.match(progress, /readinessState === "READY" \? 100 : Math\.min\(99, rounded\)/);
  });
});
