/**
 * F.3.33.1 — terminology-only history does not exhaust the missing-translation
 * budget. Genuine presentation/provider failures still do.
 * Deterministic. The translation double is in-memory and is not an external provider.
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

import type { Initiative } from "@hu/types";

import {
  SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
  countGenuineMissingTranslationFailures,
  countTerminologyAttemptsForCurrentIdentity,
  decideSameVersionWarmFailureRetry,
  encodeContentTranslationFailureMetadata,
  selectTerminologyMissingTranslationRetry,
} from "../../../src/modules/language/content-translation-failure-metadata.js";
import {
  buildLocalizationInputVersionFromConcepts,
  collectSourceTextLeaves,
} from "../../../src/modules/language/localization-input-contract.js";
import { findContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { selectCurrentlyRetryEligibleResiduals } from "../../../src/modules/language/public-localization-residual-retry.js";
import { loadPublishedTerminologyConcepts } from "../../../src/modules/language/terminology-protection-contract.js";
import {
  buildPublicLocalizationRetryPreflight,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  listLanguageRegistry,
  loadTranslatableSource,
  markContentTranslationWarmMemoryFailedForTests,
  processContentTranslationWarmMemoryQueueForTests,
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
    initiativeId: `initiative-f3331-${suffix}`,
    stewardId: "member-f3331",
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
}): string {
  return encodeContentTranslationFailureMetadata({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: input.failureClass ?? "VALIDATION_FAILED",
    failureReasonCode: input.reason ?? "TERMINOLOGY_PROTECTION_VIOLATION",
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    targetLocale: "uk",
    failedAt: "2026-10-02T14:26:59.598Z",
    retryabilityHint: "deferred_semantic_retry",
    ...(input.localizationInputVersion
      ? { localizationInputVersion: input.localizationInputVersion }
      : {}),
    ...(input.retryEligibleAt ? { retryEligibleAt: input.retryEligibleAt } : {}),
    localeFailures: [
      {
        targetLocale: "uk",
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

async function recordFailures(input: {
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly localizationInputVersion: string;
  readonly count: number;
  readonly reason?: string;
  readonly failureClass?: string;
  readonly retryEligibleAt?: string;
}): Promise<void> {
  for (let index = 0; index < input.count; index += 1) {
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: input.sourceRecordId,
      sourceVersion: input.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceRecordId: input.sourceRecordId,
        sourceVersion: input.sourceVersion,
        localizationInputVersion: input.localizationInputVersion,
        reason: input.reason,
        failureClass: input.failureClass,
        retryEligibleAt: input.retryEligibleAt,
      }),
    );
  }
}

describe("F.3.33.1 terminology diagnostics do not exhaust missing translations", () => {
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
      async translate(request) {
        providerCalls += 1;
        const source = JSON.parse(request.text) as Record<string, string>;
        const translated = Object.fromEntries(
          Object.entries(source).map(([key, value]) => [key, `Переклад ${key} ${value}`]),
        );
        return {
          translatedText: JSON.stringify(translated),
          providerId: "gemini",
          isPlaceholder: false,
        };
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

  it("A. a terminology-only streak above the cap stays selectable", async () => {
    const row = initiative("historical");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const liveInput = await liveInputFor(source);
    await recordFailures({
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      localizationInputVersion: liveInput,
      count: SEMANTIC_RESIDUAL_DEFER_STREAK_CAP + 4,
      retryEligibleAt: DUE_AT,
    });
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.semanticRetryDeferred, false);
    assert.equal(selectedCount(row.initiativeId, preflight), 1);
    assert.equal(providerCalls, 0);
  });

  it("B. structurally eligible output persists when terminology is inexact", async () => {
    const row = initiative("persist");
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
    const processed = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(processed[0]?.outcome, "completed");
    const stored = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.ok(stored);
    assert.equal(stored.freshness, "current");
    assert.notEqual(stored.stale, true);
    assert.equal(typeof stored.localizationInputVersion, "string");
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.readyState, "CURRENT");
    assert.equal(preflight.currentTranslationAbsent, false);
    assert.equal(selectedCount(row.initiativeId, preflight), 0);
  });

  it("C. an existing presentation-eligible row is not retried for terminology metadata", async () => {
    const row = initiative("usable");
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
    await processContentTranslationWarmMemoryQueueForTests();
    const callsAfterPersist = providerCalls;
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, false);
    assert.equal(preflight.readyState, "CURRENT");
    assert.equal(selectedCount(row.initiativeId, preflight), 0);
    assert.equal(providerCalls, callsAfterPersist);
  });

  it("D. genuine provider failures still exhaust at the streak cap", async () => {
    const row = initiative("genuine");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const liveInput = await liveInputFor(source);
    await recordFailures({
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      localizationInputVersion: liveInput,
      count: SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
      reason: "PROVIDER_TIMEOUT",
      failureClass: "PROVIDER_TIMEOUT",
      retryEligibleAt: DUE_AT,
    });
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
        genuineFailureCount: SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
      }),
      "exhausted",
    );
    assert.equal(providerCalls, 0);
  });

  it("E. a changed sourceVersion is fresh work", async () => {
    const row = initiative("source");
    createInitiative(row);
    created.push(row.initiativeId);
    const before = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(before);
    await recordFailures({
      sourceRecordId: row.initiativeId,
      sourceVersion: before.sourceVersion,
      localizationInputVersion: await liveInputFor(before),
      count: SEMANTIC_RESIDUAL_DEFER_STREAK_CAP + 4,
      retryEligibleAt: WAITING_AT,
    });
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
    assert.equal(providerCalls, 0);
  });

  it("F. a changed localization input is fresh work", async () => {
    const row = initiative("input");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const beforeInput = await liveInputFor(source);
    await recordFailures({
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      localizationInputVersion: beforeInput,
      count: SEMANTIC_RESIDUAL_DEFER_STREAK_CAP + 4,
      retryEligibleAt: WAITING_AT,
    });
    upsertTerminologyGlossaryMemory({
      conceptId: "humanity_union",
      canonicalEnglishTerm: "Humanity Union",
      category: "brand",
      status: "published",
      translations: {
        uk: { preferredTerm: "Союз людства", aliases: [] },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
      updatedByParticipantId: null,
    });
    const afterInput = await liveInputFor(source);
    assert.notEqual(afterInput, beforeInput);
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.semanticRetryDeferred, false);
    assert.equal(selectedCount(row.initiativeId, preflight), 1);
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
        liveSourceVersion: source.sourceVersion,
        failedSourceVersion: source.sourceVersion,
        liveLocalizationInputVersion: afterInput,
        failedLocalizationInputVersion: beforeInput,
      }),
      "retryable",
    );
    assert.equal(providerCalls, 0);
  });

  it("G. the rule has no locale or sourceKind branch", () => {
    const metadata = readFileSync(
      path.join(here, "../../../src/modules/language/content-translation-failure-metadata.ts"),
      "utf8",
    );
    const start = metadata.indexOf("function attemptMatchesCurrentTranslationIdentity");
    const end = metadata.indexOf("const WARM_RETRYABLE_INFRASTRUCTURE_CLASSES");
    const body = metadata.slice(start, end);
    assert.equal(body.includes('locale === "he"'), false);
    assert.equal(body.includes('locale === "uk"'), false);
    assert.equal(body.includes("civic_media"), false);
    assert.equal(body.includes("civic-media-center"), false);
    assert.equal(body.includes("sourceKind"), false);
    assert.equal(
      countGenuineMissingTranslationFailures(
        [
          {
            failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
            sourceVersion: "v-current",
            localizationInputVersion: "input-current",
            targetLocale: "ar",
          },
          {
            failureReasonCode: "PROVIDER_TIMEOUT",
            failureClass: "PROVIDER_TIMEOUT",
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
    assert.equal(
      countTerminologyAttemptsForCurrentIdentity(
        [
          {
            failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
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

  it("H. terminology diagnostics do not form an immediate or post-persist retry loop", async () => {
    const row = initiative("loop");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const liveInput = await liveInputFor(source);
    await recordFailures({
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      localizationInputVersion: liveInput,
      count: SEMANTIC_RESIDUAL_DEFER_STREAK_CAP + 4,
      retryEligibleAt: WAITING_AT,
    });
    const waiting = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(waiting.ready, true);
    assert.equal(waiting.semanticRetryDeferred, true);
    assert.equal(selectedCount(row.initiativeId, waiting), 0);
    assert.equal(
      selectTerminologyMissingTranslationRetry({
        currentSourcePresentationEligible: false,
        liveSourceVersion: source.sourceVersion,
        failedSourceVersion: source.sourceVersion,
        liveLocalizationInputVersion: liveInput,
        failedLocalizationInputVersion: liveInput,
        retryEligibleAt: WAITING_AT,
        genuineFailureCount: 0,
      }),
      "waiting",
    );

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    const processed = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(processed[0]?.outcome, "completed");
    const after = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(after.readyState, "CURRENT");
    assert.equal(selectedCount(row.initiativeId, after), 0);
    assert.equal(providerCalls, 1);
  });
});
