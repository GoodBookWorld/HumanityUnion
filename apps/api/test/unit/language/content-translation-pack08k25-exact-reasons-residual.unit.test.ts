/**
 * Pack 08K.2.5 — exact validation reason propagation + true residual selection.
 * Deterministic only — no live Gemini / no staging Mongo mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";

import {
  ContentTranslationValidationError,
  assertCivicTitleFieldsTranslatedFromSource,
  assertTranslatedProseChangedFromSource,
  classifyContentTranslationMaterializationFailure,
  encodeContentTranslationFailureMetadata,
  ensureLanguageRegistrySeeded,
  enqueueContentTranslationWarmRequested,
  explainResidualsOnly,
  isExplicitlyRetryableModernFailure,
  markContentTranslationWarmMemoryFailedForTests,
  normalizeExactValidationReasonCode,
  parseContentTranslationFailureMetadata,
  parseResidualIdentityArg,
  parseResidualIdentityArgs,
  peekContentTranslationWarmOutboxFailure,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetResidualDiagnosticCountersForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { DeterministicTranslationProvider } from "../../../src/modules/language/providers/deterministic-translation-provider.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import type {
  TranslationProvider,
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");

function readApi(rel: string): string {
  return readFileSync(join(apiRoot, rel), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08k25-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08k25",
    createdAt: now,
    updatedAt: now,
    title: `Pack08K25 Initiative ${suffix}`,
    description: `Canonical English prose for exact reason pack ${suffix}.`,
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

/** Returns caller-controlled structured JSON — never calls Gemini. */
class ScriptedStructuredTranslationProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  private readonly script: (request: TranslationProviderRequest) => Record<string, string> | string;

  constructor(
    script: (request: TranslationProviderRequest) => Record<string, string> | string,
  ) {
    this.script = script;
  }

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
      );
    }
    const payload = this.script(request);
    return {
      translatedText: typeof payload === "string" ? payload : JSON.stringify(payload),
      providerId: this.providerId,
      isPlaceholder: false,
    };
  }
}

async function warmAndCaptureMeta(input: {
  readonly initiative: Initiative;
  readonly targetLocale: "uk" | "ar" | "zh-Hant";
  readonly script: (request: TranslationProviderRequest) => Record<string, string> | string;
}): Promise<{
  readonly meta: NonNullable<ReturnType<typeof parseContentTranslationFailureMetadata>>;
  readonly eventId: string;
}> {
  setTranslationProviderForTests(new ScriptedStructuredTranslationProvider(input.script));
  const enqueued = await enqueueContentTranslationWarmRequested({
    sourceKind: "initiative",
    sourceRecordId: input.initiative.initiativeId,
    reason: "operator_residual_retry",
    targetLocales: [input.targetLocale],
  });
  assert.ok(enqueued.eventId);
  let thrown: unknown;
  try {
    await processContentTranslationWarmRequested(enqueued.command);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof Error);
  const meta = parseContentTranslationFailureMetadata(thrown.message);
  assert.ok(meta, "expected CT_FAIL_META_V1 on warm failure");
  markContentTranslationWarmMemoryFailedForTests(enqueued.eventId, thrown.message);
  return { meta, eventId: enqueued.eventId };
}

describe("Pack 08K.2.5 — exact reasons + true residual selection", () => {
  const createdInitiativeIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    resetResidualDiagnosticCountersForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    await ensureLanguageRegistrySeeded();
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      await updateLanguageRegistryRecord(`lang-${locale}`, {
        enabled: true,
        contentTranslationEnabled: true,
      });
    }
  });

  afterEach(() => {
    for (const id of createdInitiativeIds.splice(0)) {
      try {
        deleteInitiative(id);
      } catch {
        // ignore
      }
    }
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    resetTranslationProviderForTests();
  });

  it("A. UNCHANGED_SOURCE_PROSE survives validator → CT_FAIL_META_V1 → diagnostic", async () => {
    const initiative = sampleInitiative("unchanged-prose");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const { meta } = await warmAndCaptureMeta({
      initiative,
      targetLocale: "uk",
      script: () => ({
        title: initiative.title,
        description: initiative.description,
      }),
    });
    assert.equal(meta.failureReasonCode, "UNCHANGED_SOURCE_PROSE");
    assert.notEqual(meta.failureReasonCode, "VALIDATION_FAILED");
    assert.equal(meta.failureClass, "VALIDATION_FAILED");

    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(explained.residuals[0]?.failureReasonCode, "UNCHANGED_SOURCE_PROSE");
    assert.equal(explained.RETRY_READY_IDENTITIES, 0);
  });

  it("B. UNCHANGED_CIVIC_TITLE survives end-to-end", async () => {
    const initiative = sampleInitiative("civic-title");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const { meta } = await warmAndCaptureMeta({
      initiative,
      targetLocale: "uk",
      script: () => ({
        title: initiative.title,
        description: "Учасники відновлюють місцеву річку з доказовими кроками.",
      }),
    });
    assert.equal(meta.failureReasonCode, "UNCHANGED_CIVIC_TITLE");

    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(explained.residuals[0]?.failureReasonCode, "UNCHANGED_CIVIC_TITLE");
  });

  it("C. EMPTY_TRANSLATION survives end-to-end", async () => {
    const initiative = sampleInitiative("empty");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const { meta } = await warmAndCaptureMeta({
      initiative,
      targetLocale: "ar",
      script: () => ({}),
    });
    assert.equal(meta.failureReasonCode, "EMPTY_TRANSLATION");

    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "ar",
        },
      ],
    });
    assert.equal(explained.residuals[0]?.failureReasonCode, "EMPTY_TRANSLATION");
  });

  it("D. MISSING_REQUIRED_PATH survives end-to-end", async () => {
    const initiative = sampleInitiative("missing-path");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    // Prose changes via description, but civic title omitted → MISSING_REQUIRED_PATH.
    const { meta } = await warmAndCaptureMeta({
      initiative,
      targetLocale: "uk",
      script: () => ({
        description: "Учасники відновлюють місцеву річку з доказовими кроками.",
      }),
    });
    assert.equal(meta.failureReasonCode, "MISSING_REQUIRED_PATH");

    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(explained.residuals[0]?.failureReasonCode, "MISSING_REQUIRED_PATH");
  });

  it("E. INVALID_RICH_TEXT_STRUCTURE survives classify → meta → diagnostic", async () => {
    const error = new ContentTranslationValidationError(
      "INVALID_RICH_TEXT_STRUCTURE",
      "Rich text structure invalid.",
      "malformed_response",
    );
    const classified = classifyContentTranslationMaterializationFailure(error);
    assert.equal(classified.failureReasonCode, "INVALID_RICH_TEXT_STRUCTURE");
    const encoded = encodeContentTranslationFailureMetadata({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: classified.failureClass,
      failureReasonCode: classified.failureReasonCode!,
      sourceKind: "blog_post",
      sourceRecordId: "blog-rich-text",
      sourceVersion: "v1",
      targetLocale: "uk",
      failedAt: new Date().toISOString(),
      retryabilityHint: "non_retryable_until_code_or_content_change",
    });
    const parsed = parseContentTranslationFailureMetadata(encoded);
    assert.equal(parsed?.failureReasonCode, "INVALID_RICH_TEXT_STRUCTURE");
  });

  it("F. unknown validator exception => OTHER_VALIDATION_FAILURE", () => {
    const classified = classifyContentTranslationMaterializationFailure(
      new Error("unexpected validator boom"),
    );
    assert.equal(classified.failureReasonCode, "OTHER_VALIDATION_FAILURE");
    assert.equal(classified.failureClass, "VALIDATION_FAILED");
    const encoded = encodeContentTranslationFailureMetadata({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: classified.failureClass,
      failureReasonCode: classified.failureReasonCode!,
      sourceKind: "initiative",
      sourceRecordId: "x",
      sourceVersion: "v1",
      targetLocale: "uk",
      failedAt: new Date().toISOString(),
      retryabilityHint: "non_retryable_until_code_or_content_change",
    });
    assert.equal(
      parseContentTranslationFailureMetadata(encoded)?.failureReasonCode,
      "OTHER_VALIDATION_FAILURE",
    );
  });

  it("G. no new CT_FAIL_META_V1 may contain reasonCode=VALIDATION_FAILED", () => {
    const encoded = encodeContentTranslationFailureMetadata({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: "VALIDATION_FAILED",
      failureReasonCode: "VALIDATION_FAILED",
      sourceKind: "initiative",
      sourceRecordId: "x",
      sourceVersion: "v1",
      targetLocale: "uk",
      failedAt: new Date().toISOString(),
      retryabilityHint: "non_retryable_until_code_or_content_change",
    });
    const parsed = parseContentTranslationFailureMetadata(encoded);
    assert.ok(parsed);
    assert.notEqual(parsed.failureReasonCode, "VALIDATION_FAILED");
    assert.equal(parsed.failureReasonCode, "OTHER_VALIDATION_FAILURE");
    assert.equal(normalizeExactValidationReasonCode("VALIDATION_FAILED"), "OTHER_VALIDATION_FAILURE");
  });

  it("H. historical generic VALIDATION_FAILED remains readable and blocked", async () => {
    const initiative = sampleInitiative("hist-generic");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["zh-Hant"],
    });
    assert.ok(enqueued.eventId);
    // Simulate historical persisted meta with collapsed reason (pre-08K.2.5).
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      `CT_FAIL_META_V1:${JSON.stringify({
        schema: "content_translation_failure_meta_v1",
        validationContractVersion: "v1",
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "VALIDATION_FAILED",
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: "v1",
        targetLocale: "zh-Hant",
        failedAt: "2026-09-04T00:00:00.000Z",
        retryabilityHint: "non_retryable_until_code_or_content_change",
      })}`,
    );

    const peek = await peekContentTranslationWarmOutboxFailure({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "zh-Hant",
    });
    assert.equal(peek.failureMetadata?.failureReasonCode, "VALIDATION_FAILED");
    assert.equal(
      isExplicitlyRetryableModernFailure({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "VALIDATION_FAILED",
      }),
      false,
    );

    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "zh-Hant",
        },
      ],
    });
    assert.equal(explained.residuals[0]?.failureReasonCode, "VALIDATION_FAILED");
    assert.equal(explained.residuals[0]?.retryPreflight.ready, false);
    assert.equal(explained.RETRY_READY_IDENTITIES, 0);
  });

  it("I. historical FAILED + CURRENT live translation => filtered from residuals", async () => {
    const initiative = sampleInitiative("current-filter");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    await upsertContentTranslation({
      translationId: "tr-current-08k25",
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { title: "[uk] OK", description: "[uk] OK" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      stale: false,
      freshness: "current",
    });
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_backfill",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      encodeContentTranslationFailureMetadata({
        schema: "content_translation_failure_meta_v1",
        validationContractVersion: "v1",
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "UNCHANGED_CIVIC_TITLE",
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLocale: "uk",
        failedAt: new Date().toISOString(),
        retryabilityHint: "non_retryable_until_code_or_content_change",
      }),
    );

    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(explained.residuals.length, 0);
    assert.equal(explained.memory.CURRENT_IDENTITIES_FILTERED, 1);
    assert.equal(explained.memory.CANDIDATE_IDENTITIES_INSPECTED, 1);
    assert.equal(explained.RETRY_READY_IDENTITIES, 0);
    assert.equal(explained.RETRY_BLOCKED_IDENTITIES, 0);
  });

  it("J. actual terminal current-source failure => included", async () => {
    const initiative = sampleInitiative("terminal");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const { meta } = await warmAndCaptureMeta({
      initiative,
      targetLocale: "uk",
      script: () => ({
        title: initiative.title,
        description: initiative.description,
      }),
    });
    assert.equal(meta.failureReasonCode, "UNCHANGED_SOURCE_PROSE");
    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(explained.residuals.length, 1);
    assert.equal(explained.residuals[0]?.translationState, "TERMINAL_FAILED");
  });

  it("K. missing current-source translation => included", async () => {
    const initiative = sampleInitiative("missing");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(explained.residuals.length, 1);
    assert.equal(explained.residuals[0]?.translationState, "MISSING");
    assert.equal(explained.RETRY_READY_IDENTITIES, 1);
  });

  it("L. stale current-source translation => included", async () => {
    const initiative = sampleInitiative("stale");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    await upsertContentTranslation({
      translationId: "tr-stale-08k25",
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "ar",
      translatedContent: { title: "[ar] old", description: "[ar] old" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      stale: true,
      freshness: "stale",
    });
    const explained = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "ar",
        },
      ],
    });
    assert.equal(explained.residuals.length, 1);
    assert.equal(explained.residuals[0]?.translationState, "STALE");
  });

  it("M. explicit identity filter diagnoses only requested identities", async () => {
    const a = sampleInitiative("explicit-a");
    const b = sampleInitiative("explicit-b");
    createInitiative(a);
    createInitiative(b);
    createdInitiativeIds.push(a.initiativeId, b.initiativeId);

    const parsed = parseResidualIdentityArgs([
      "--residual",
      `initiative:${a.initiativeId}:uk`,
      "--residual",
      `initiative:${b.initiativeId}:ar`,
    ]);
    assert.equal(parsed.length, 2);

    const explained = await explainResidualsOnly({
      explicitIdentities: parsed,
    });
    assert.equal(explained.RESIDUAL_DISCOVERY, "EXPLICIT_IDENTITIES");
    assert.equal(explained.memory.OUTBOX_ROWS_INSPECTED, 0);
    assert.equal(explained.memory.SOURCE_RECORDS_LOADED, 2);
    assert.equal(explained.residuals.length, 2);
  });

  it("N. huge unrelated failed history does not affect explicit mode", async () => {
    const target = sampleInitiative("explicit-noise");
    createInitiative(target);
    createdInitiativeIds.push(target.initiativeId);

    const explained = await explainResidualsOnly({
      explicitIdentities: [
        {
          sourceKind: "initiative",
          sourceRecordId: target.initiativeId,
          targetLocale: "uk",
        },
      ],
      // Must be ignored when explicitIdentities is set.
      failedOutboxRowsForTests: Array.from({ length: 200 }, (_, i) => ({
        aggregateId: `initiative::noise-${i}`,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastError: "noise",
        payload: { targetLocales: ["uk"] },
      })),
    });
    assert.equal(explained.RESIDUAL_DISCOVERY, "EXPLICIT_IDENTITIES");
    assert.equal(explained.memory.OUTBOX_ROWS_INSPECTED, 0);
    assert.equal(explained.memory.SOURCE_RECORDS_LOADED, 1);
    assert.equal(explained.residuals.length, 1);
  });

  it("O/P/Q. no full bootstrap / no provider calls / no writes in residual diagnostic", () => {
    const script = readApi(
      "src/modules/language/public-localization-residual-only-diagnostic.ts",
    );
    assert.doesNotMatch(script, /getOrCreateContentTranslation\(/);
    assert.doesNotMatch(script, /enqueueContentTranslationWarmRequested\(/);
    assert.doesNotMatch(script, /discoverPublicLocalizationCorpus\(/);
    assert.doesNotMatch(script, /auditPublicLocalizationCorpus\(/);
    assert.match(script, /zero provider calls, zero writes/);

    const reconcile = readApi("src/scripts/reconcile-public-localization.ts");
    assert.match(reconcile, /--residual/);
    assert.match(reconcile, /parseResidualIdentityArgs/);
  });

  it("R. bounded discovery labelled BOUNDED_CANDIDATES (not complete corpus)", async () => {
    const explained = await explainResidualsOnly({
      failedOutboxRowsForTests: [],
    });
    assert.equal(explained.RESIDUAL_DISCOVERY, "BOUNDED_CANDIDATES");
    assert.equal(explained.memory.FULL_CORPUS_HYDRATED, false);
    assert.match(explained.note, /completeness not proven/i);
  });

  it("parseResidualIdentityArg rejects prose-looking malformed args", () => {
    assert.equal(parseResidualIdentityArg("initiative"), null);
    assert.equal(parseResidualIdentityArg("initiative:only-two"), null);
    assert.ok(parseResidualIdentityArg("blog_post:blog-abc:zh-Hant"));
  });

  it("validators still throw exact codes (08K.2.1 contract)", () => {
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "discussion_comment",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { body: "Hello" },
          translatedFields: { body: "Hello" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_SOURCE_PROSE",
    );
    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "blog_post",
          sourceLanguage: "en",
          targetLanguage: "ar",
          sourceFields: { title: "Title" },
          translatedFields: { title: "Title" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_CIVIC_TITLE",
    );
  });

  it("INVALID_PROVIDER_PAYLOAD remains explicitly retryable; generic VALIDATION_FAILED not", () => {
    assert.equal(
      isExplicitlyRetryableModernFailure({
        failureClass: "PROVIDER_INVALID_RESPONSE",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
      }),
      true,
    );
    assert.equal(
      isExplicitlyRetryableModernFailure({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "VALIDATION_FAILED",
      }),
      false,
    );
  });
});
