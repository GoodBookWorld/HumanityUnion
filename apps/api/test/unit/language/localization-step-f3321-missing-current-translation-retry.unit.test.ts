/**
 * F.3.32.1 — a terminology-only failure does not permanently suppress a
 * current source that still has no presentation-eligible translation.
 * The existing semantic residual streak cap bounds those retries.
 * Deterministic. No provider calls.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";

import type { Initiative, TranslatedContentRecord } from "@hu/types";

import {
  SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
  countTerminologyAttemptsForCurrentIdentity,
  decideSameVersionWarmFailureRetry,
  encodeContentTranslationFailureMetadata,
  selectTerminologyMissingTranslationRetry,
} from "../../../src/modules/language/content-translation-failure-metadata.js";
import {
  buildLocalizationInputVersionFromConcepts,
  collectSourceTextLeaves,
} from "../../../src/modules/language/localization-input-contract.js";
import { selectCurrentlyRetryEligibleResiduals } from "../../../src/modules/language/public-localization-residual-retry.js";
import { loadPublishedTerminologyConcepts } from "../../../src/modules/language/terminology-protection-contract.js";
import {
  upsertContentTranslation,
  findContentTranslation,
} from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  buildPublicLocalizationRetryPreflight,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  listLanguageRegistry,
  loadTranslatableSource,
  markContentTranslationWarmMemoryFailedForTests,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
  type PublicLocalizationResidualWithPreflight,
  type PublicLocalizationRetryPreflight,
} from "../../../src/modules/language/index.js";
import { upsertTerminologyGlossaryMemory } from "../../../src/modules/language/terminology-glossary/terminology-glossary.memory.store.js";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DUE_AT = "2020-01-01T00:00:00.000Z";
const WAITING_AT = "2999-01-01T00:00:00.000Z";

function initiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-f3321-${suffix}`,
    stewardId: "member-f3321",
    createdAt: now,
    updatedAt: now,
    title: "Humanity Union river plan",
    description: "Neighbors will restore a local river.",
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

function failureMessage(input: {
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly localizationInputVersion?: string;
  readonly reason?: string;
  readonly failureClass?: string;
  readonly retryEligibleAt?: string;
  readonly targetLocale?: string;
}): string {
  return encodeContentTranslationFailureMetadata({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: input.failureClass ?? "VALIDATION_FAILED",
    failureReasonCode: input.reason ?? "TERMINOLOGY_PROTECTION_VIOLATION",
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    targetLocale: input.targetLocale ?? "uk",
    failedAt: "2026-10-02T14:26:59.598Z",
    retryabilityHint: "deferred_semantic_retry",
    ...(input.localizationInputVersion
      ? { localizationInputVersion: input.localizationInputVersion }
      : {}),
    ...(input.retryEligibleAt ? { retryEligibleAt: input.retryEligibleAt } : {}),
    localeFailures: [
      {
        targetLocale: input.targetLocale ?? "uk",
        failureClass: input.failureClass ?? "VALIDATION_FAILED",
        failureReasonCode: input.reason ?? "TERMINOLOGY_PROTECTION_VIOLATION",
        retryabilityHint: "deferred_semantic_retry",
      },
    ],
  });
}

async function liveInputFor(source: {
  readonly sourceVersion: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<string> {
  const concepts = await loadPublishedTerminologyConcepts();
  return buildLocalizationInputVersionFromConcepts({
    sourceVersion: source.sourceVersion,
    targetLocale: "uk",
    concepts,
    sourceText: collectSourceTextLeaves(source.fields),
  }).localizationInputVersion;
}

async function preflightFor(sourceRecordId: string, sourceVersion: string) {
  return buildPublicLocalizationRetryPreflight({
    workItem: {
      sourceKind: "initiative",
      sourceRecordId,
      sourceVersion,
      targetLanguage: "uk",
      state: "MISSING",
      autoNodeCount: 1,
      missingOrStaleNodeCount: 1,
      fallbackPaths: ["title"],
    },
  });
}

function residualFrom(
  sourceRecordId: string,
  preflight: PublicLocalizationRetryPreflight,
): PublicLocalizationResidualWithPreflight {
  return {
    family: "initiative",
    presentationIdentity: { sourceKind: "initiative", sourceRecordId },
    targetLocale: "uk",
    translationState: "MISSING",
    sourceVersionMatch: "no_row",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: preflight.failureReasonCode,
    retryability: null,
    lastFailureAt: null,
    outboxDisposition: "failed",
    mayScheduleNewWarm: true,
    latestAttemptAt: null,
    latestAttemptReason: null,
    latestAttemptTargetLocale: null,
    failureMetadataVersion: null,
    retryPreflight: preflight,
  };
}

function selectedCount(sourceRecordId: string, preflight: PublicLocalizationRetryPreflight): number {
  return selectCurrentlyRetryEligibleResiduals(
    [residualFrom(sourceRecordId, preflight)].filter((row) => row.retryPreflight.ready),
  ).length;
}

describe("F.3.32.1 bounded retry when the current source has no usable translation", () => {
  const created: string[] = [];
  let providerCalls = 0;

  beforeEach(async () => {
    providerCalls = 0;
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    setTranslationProviderForTests({
      providerId: "gemini",
      async translate() {
        providerCalls += 1;
        throw new Error("provider must not be called");
      },
    });
    await ensureLanguageRegistrySeeded();
    for (const row of await listLanguageRegistry()) {
      await updateLanguageRegistryRecord(row.languageId, {
        enabled: row.locale === "en" || row.locale === "uk",
        contentTranslationEnabled: row.locale === "uk",
        searchEnabled: false,
      });
    }
    upsertTerminologyGlossaryMemory({
      conceptId: "humanity_union",
      canonicalEnglishTerm: "Humanity Union",
      category: "brand",
      status: "published",
      translations: {
        uk: { preferredTerm: "Союз Людства", aliases: [] },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedByParticipantId: null,
    });
  });

  afterEach(() => {
    resetTranslationProviderForTests();
    for (const id of created.splice(0)) {
      deleteInitiative(id);
    }
  });

  it("A. an old-source row with a due current-source terminology failure stays retryable", async () => {
    const row = initiative("missing");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const liveInput = await liveInputFor(source);
    const stored: TranslatedContentRecord = {
      translationId: "t-old",
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: "v-old-source",
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: Object.fromEntries(
        Object.keys(source.fields).map((key) => [key, `Збережений ${key}`]),
      ),
      translationProvider: "gemini",
      translationKind: "machine",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      stale: true,
      freshness: "stale",
    };
    await upsertContentTranslation(stored);
    assert.equal(
      await findContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLanguage: "uk",
      }),
      null,
    );

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        localizationInputVersion: liveInput,
        retryEligibleAt: WAITING_AT,
      }),
    );
    const waiting = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(waiting.ready, true);
    assert.equal(waiting.semanticRetryDeferred, true);
    assert.equal(selectedCount(row.initiativeId, waiting), 0);

    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        localizationInputVersion: liveInput,
        retryEligibleAt: DUE_AT,
      }),
    );
    const due = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(due.ready, true);
    assert.equal(due.readyState, "MISSING_READY_FOR_WARM");
    assert.equal(due.failureReasonCode, "TERMINOLOGY_PROTECTION_VIOLATION");
    assert.equal(due.semanticRetryDeferred, false);
    assert.equal(selectedCount(row.initiativeId, due), 1);
    assert.equal(providerCalls, 0);
  });

  it("B. a presentation-eligible current-source row stays suppressed", async () => {
    const row = initiative("usable");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const liveInput = await liveInputFor(source);
    await upsertContentTranslation({
      translationId: "t-current",
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: Object.fromEntries(
        Object.keys(source.fields).map((key) => [key, `Збережений поточний ${key}`]),
      ),
      translationProvider: "gemini",
      translationKind: "machine",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      stale: false,
      freshness: "current",
      localizationInputVersion: "stored-older-input",
    });
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        localizationInputVersion: liveInput,
        retryEligibleAt: DUE_AT,
      }),
    );
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, false);
    assert.equal(preflight.readyState, "CURRENT");
    assert.equal(preflight.currentTranslationAbsent, false);
    assert.equal(selectedCount(row.initiativeId, preflight), 0);
    assert.equal(
      selectTerminologyMissingTranslationRetry({
        currentSourcePresentationEligible: true,
        liveSourceVersion: source.sourceVersion,
        failedSourceVersion: source.sourceVersion,
        liveLocalizationInputVersion: liveInput,
        failedLocalizationInputVersion: liveInput,
        retryEligibleAt: DUE_AT,
        terminologyAttemptCount: 1,
      }),
      "suppressed_usable_translation",
    );
    assert.equal(providerCalls, 0);
  });

  it("C. terminology retries stop at the existing streak cap", async () => {
    const row = initiative("exhaust");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const liveInput = await liveInputFor(source);
    for (let index = 0; index < SEMANTIC_RESIDUAL_DEFER_STREAK_CAP; index += 1) {
      const enqueued = await enqueueContentTranslationWarmRequested({
        sourceKind: "initiative",
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        reason: "reconciliation",
        targetLocales: ["uk"],
      });
      assert.ok(enqueued.eventId);
      markContentTranslationWarmMemoryFailedForTests(
        enqueued.eventId,
        failureMessage({
          sourceRecordId: row.initiativeId,
          sourceVersion: source.sourceVersion,
          localizationInputVersion: liveInput,
          retryEligibleAt: DUE_AT,
        }),
      );
    }
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.semanticRetryDeferred, true);
    assert.equal(selectedCount(row.initiativeId, preflight), 0);
    assert.equal(
      selectTerminologyMissingTranslationRetry({
        currentSourcePresentationEligible: false,
        liveSourceVersion: source.sourceVersion,
        failedSourceVersion: source.sourceVersion,
        liveLocalizationInputVersion: liveInput,
        failedLocalizationInputVersion: liveInput,
        retryEligibleAt: DUE_AT,
        terminologyAttemptCount: SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
      }),
      "exhausted",
    );
    assert.equal(
      selectTerminologyMissingTranslationRetry({
        currentSourcePresentationEligible: false,
        liveSourceVersion: source.sourceVersion,
        failedSourceVersion: source.sourceVersion,
        liveLocalizationInputVersion: liveInput,
        failedLocalizationInputVersion: liveInput,
        retryEligibleAt: DUE_AT,
        terminologyAttemptCount: SEMANTIC_RESIDUAL_DEFER_STREAK_CAP - 1,
      }),
      "due",
    );
    assert.equal(providerCalls, 0);
  });

  it("D. a later source version is genuine work", async () => {
    const row = initiative("source-change");
    createInitiative(row);
    created.push(row.initiativeId);
    const before = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(before);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: before.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceRecordId: row.initiativeId,
        sourceVersion: before.sourceVersion,
        localizationInputVersion: await liveInputFor(before),
        retryEligibleAt: WAITING_AT,
      }),
    );
    updateInitiative(row.initiativeId, { title: "Neighborhood river plan" });
    const after = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(after);
    assert.notEqual(after.sourceVersion, before.sourceVersion);
    const preflight = await preflightFor(row.initiativeId, after.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.semanticRetryDeferred, false);
    assert.equal(selectedCount(row.initiativeId, preflight), 1);
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
        liveSourceVersion: after.sourceVersion,
        failedSourceVersion: before.sourceVersion,
        liveLocalizationInputVersion: "input-next",
        failedLocalizationInputVersion: "input-next",
      }),
      "retryable",
    );
    assert.equal(providerCalls, 0);
  });

  it("E. transient provider failures stay retryable", async () => {
    for (const failureClass of [
      "PROVIDER_TIMEOUT",
      "PROVIDER_INVALID_RESPONSE",
      "PERSISTENCE_FAILED",
      "MISSING_AFTER_DISPATCH",
      "SOURCE_UNAVAILABLE",
    ]) {
      assert.equal(
        decideSameVersionWarmFailureRetry({
          failureClass,
          failureReasonCode: null,
          liveSourceVersion: "v-current",
          failedSourceVersion: "v-current",
          liveLocalizationInputVersion: "input-current",
          failedLocalizationInputVersion: "input-current",
        }),
        "retryable",
      );
    }

    const row = initiative("transient");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        failureClass: "PROVIDER_TIMEOUT",
        reason: "PROVIDER_TIMEOUT",
      }),
    );
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.semanticRetryDeferred, false);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    assert.equal(selectedCount(row.initiativeId, preflight), 1);
    assert.equal(providerCalls, 0);
  });

  it("F. the rule has no locale or sourceKind branch", () => {
    const metadata = readFileSync(
      path.join(here, "../../../src/modules/language/content-translation-failure-metadata.ts"),
      "utf8",
    );
    const start = metadata.indexOf("export function countTerminologyAttemptsForCurrentIdentity");
    const end = metadata.indexOf("const WARM_RETRYABLE_INFRASTRUCTURE_CLASSES");
    const body = metadata.slice(start, end);
    assert.equal(body.includes('locale === "he"'), false);
    assert.equal(body.includes('locale === "uk"'), false);
    assert.equal(body.includes("civic_media"), false);
    assert.equal(body.includes("civic-media-center"), false);
    assert.equal(body.includes("sourceKind"), false);

    const preflight = readFileSync(
      path.join(here, "../../../src/modules/language/public-localization-retry-preflight.ts"),
      "utf8",
    );
    const gateStart = preflight.indexOf('sameVersionRetryDecision === "terminal"');
    const gate = preflight.slice(gateStart, gateStart + 1800);
    assert.equal(gate.includes('locale === "he"'), false);
    assert.equal(gate.includes('locale === "uk"'), false);
    assert.equal(gate.includes("civic_media"), false);
    assert.equal(gate.includes("civic-media-center"), false);

    assert.equal(
      countTerminologyAttemptsForCurrentIdentity(
        [
          {
            failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
            sourceVersion: "v-current",
            localizationInputVersion: "input-current",
            targetLocale: "ar",
          },
          {
            failureReasonCode: "PROVIDER_TIMEOUT",
            sourceVersion: "v-current",
            localizationInputVersion: "input-current",
            targetLocale: "ar",
          },
        ],
        {
          liveSourceVersion: "v-current",
          liveLocalizationInputVersion: "input-current",
          targetLocale: "ar",
        },
      ),
      1,
    );
  });
});
