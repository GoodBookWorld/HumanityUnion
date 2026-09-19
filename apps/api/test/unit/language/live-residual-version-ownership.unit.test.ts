/**
 * Live residual version ownership and readiness classification.
 * No provider calls, no activation enqueue, no Georgian-specific branches.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";

import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import { accumulateLiveResidualCounts } from "../../../src/modules/language/live-residual-ct-coverage.js";
import {
  classifyLiveResidualIdentity,
  isActionableLiveResidualBucket,
} from "../../../src/modules/language/live-residual-identity.js";
import {
  buildPublicLocalizationRetryPreflight,
  encodeContentTranslationFailureMetadata,
  ensureLanguageRegistrySeeded,
  enqueueContentTranslationWarmRequested,
  loadTranslatableSource,
  markContentTranslationWarmMemoryFailedForTests,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  selectReadyPresentationsForResidualRetry,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
  explainPublicLocalizationResidualsWithPreflight,
} from "../../../src/modules/language/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { failedAttemptSuppressesLiveSourceVersion } from "../../../src/modules/language/warm-attempt-version-ownership.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");
const createdInitiativeIds: string[] = [];

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-live-residual-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-live-residual",
    createdAt: now,
    updatedAt: now,
    title: `Live residual ${suffix}`,
    description: `Canonical English prose for live residual ${suffix}.`,
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

async function liveInitiative(suffix: string) {
  const initiative = sampleInitiative(suffix);
  createInitiative(initiative);
  createdInitiativeIds.push(initiative.initiativeId);
  const source = await loadTranslatableSource({
    sourceKind: "initiative",
    sourceRecordId: initiative.initiativeId,
  });
  assert.ok(source);
  return { initiative, source };
}

async function failAttempt(input: {
  readonly sourceRecordId: string;
  readonly sourceVersion: string | null;
  readonly reasonCode: string;
  readonly enqueueSourceVersion?: string;
}) {
  const enqueued = await enqueueContentTranslationWarmRequested({
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    reason: "operator_residual_retry",
    targetLocales: ["uk"],
    ...(input.enqueueSourceVersion ? { sourceVersion: input.enqueueSourceVersion } : {}),
  });
  assert.ok(enqueued.eventId);
  markContentTranslationWarmMemoryFailedForTests(
    enqueued.eventId,
    encodeContentTranslationFailureMetadata({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: "VALIDATION_FAILED",
      failureReasonCode: input.reasonCode,
      sourceKind: "initiative",
      sourceRecordId: input.sourceRecordId,
      sourceVersion: input.sourceVersion,
      targetLocale: "uk",
      failedAt: new Date().toISOString(),
      retryabilityHint: "non_retryable_until_code_or_content_change",
    }),
  );
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

function classifyPreflight(preflight: Awaited<ReturnType<typeof preflightFor>>) {
  return classifyLiveResidualIdentity({
    liveCurrent: preflight.readyState === "CURRENT",
    liveStale: preflight.liveTranslationStale === true,
    preflightReady: preflight.ready,
    readyState: preflight.readyState,
    terminalFailureForCurrentVersion: preflight.terminalFailureForCurrentVersion,
  });
}

describe("live residual version ownership and readiness", () => {
  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
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
  });

  it("1. same sourceVersion failure retains terminal retry protection", async () => {
    const { initiative, source } = await liveInitiative("same-version");
    await failAttempt({
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      reasonCode: "UNCHANGED_CIVIC_TITLE",
      enqueueSourceVersion: source.sourceVersion,
    });
    const preflight = await preflightFor(initiative.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, false);
    assert.equal(preflight.terminalFailureForCurrentVersion, true);
    assert.equal(preflight.attemptSourceVersion, source.sourceVersion);
    const bucket = classifyPreflight(preflight);
    assert.equal(bucket, "BLOCKED_FAILED_ATTEMPT");
    assert.equal(isActionableLiveResidualBucket(bucket), false);
    assert.equal(
      failedAttemptSuppressesLiveSourceVersion({
        disposition: "failed",
        attemptSourceVersion: source.sourceVersion,
        liveSourceVersion: source.sourceVersion,
      }),
      true,
    );
  });

  it("2. legacy failed attempt with no sourceVersion does not block the live version", async () => {
    const { initiative, source } = await liveInitiative("legacy-unversioned");
    await failAttempt({
      sourceRecordId: initiative.initiativeId,
      sourceVersion: null,
      reasonCode: "UNKNOWN_LEGACY",
    });
    const preflight = await preflightFor(initiative.initiativeId, source.sourceVersion);
    assert.equal(preflight.attemptSourceVersion, null);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    assert.equal(preflight.ready, true);
    assert.equal(classifyPreflight(preflight), "RETRY_READY_MISSING");
    assert.equal(
      failedAttemptSuppressesLiveSourceVersion({
        disposition: "failed",
        attemptSourceVersion: null,
        liveSourceVersion: source.sourceVersion,
      }),
      false,
    );
  });

  it("3. older sourceVersion failure does not block a newer live sourceVersion", async () => {
    const { initiative, source } = await liveInitiative("older-version");
    await failAttempt({
      sourceRecordId: initiative.initiativeId,
      sourceVersion: "historical-source-version",
      reasonCode: "UNCHANGED_CIVIC_TITLE",
      enqueueSourceVersion: "historical-source-version",
    });
    const preflight = await preflightFor(initiative.initiativeId, source.sourceVersion);
    assert.notEqual(preflight.attemptSourceVersion, source.sourceVersion);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    assert.equal(preflight.ready, true);
    assert.equal(classifyPreflight(preflight), "RETRY_READY_MISSING");
  });

  it("4–5. CURRENT exact live version is not actionable, including beside a historical stale row", async () => {
    const { initiative, source } = await liveInitiative("current");
    const now = new Date().toISOString();
    await upsertContentTranslation({
      translationId: `tr-current-${initiative.initiativeId}`,
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { title: "[uk] title", description: "[uk] body" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: now,
      stale: false,
      freshness: "current",
    });
    await upsertContentTranslation({
      translationId: `tr-historical-${initiative.initiativeId}`,
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: `${source.sourceVersion}-historical`,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { title: "[uk] old", description: "[uk] old body" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: now,
      stale: true,
      freshness: "stale",
    });

    const preflight = await preflightFor(initiative.initiativeId, source.sourceVersion);
    assert.equal(preflight.readyState, "CURRENT");
    assert.equal(preflight.ready, false);
    assert.equal(preflight.liveTranslationStale, false);
    const bucket = classifyPreflight(preflight);
    assert.equal(bucket, "CURRENT");
    const counts = accumulateLiveResidualCounts([bucket]);
    assert.equal(counts.current, 1);
    assert.equal(counts.stale, 0);
    assert.equal(counts.missing, 0);
    assert.equal(counts.workItemsRequired, 0);
  });

  it("6–8. missing is actionable, blocked is separate, and residual retry uses the same boundary", async () => {
    const missing = await liveInitiative("missing");
    const missingPreflight = await preflightFor(
      missing.initiative.initiativeId,
      missing.source.sourceVersion,
    );
    const missingBucket = classifyPreflight(missingPreflight);
    assert.equal(missingBucket, "RETRY_READY_MISSING");
    assert.equal(isActionableLiveResidualBucket(missingBucket), missingPreflight.ready);

    const blocked = await liveInitiative("blocked");
    await failAttempt({
      sourceRecordId: blocked.initiative.initiativeId,
      sourceVersion: blocked.source.sourceVersion,
      reasonCode: "UNCHANGED_CIVIC_TITLE",
      enqueueSourceVersion: blocked.source.sourceVersion,
    });
    const blockedPreflight = await preflightFor(
      blocked.initiative.initiativeId,
      blocked.source.sourceVersion,
    );
    const blockedBucket = classifyPreflight(blockedPreflight);
    assert.equal(blockedBucket, "BLOCKED_FAILED_ATTEMPT");
    assert.equal(isActionableLiveResidualBucket(blockedBucket), blockedPreflight.ready);
    const counts = accumulateLiveResidualCounts([missingBucket, blockedBucket]);
    assert.equal(counts.missing, 1);
    assert.equal(counts.failed, 1);
    assert.equal(counts.workItemsRequired, 1);

    const explained = await explainPublicLocalizationResidualsWithPreflight({
      workItems: [
        {
          sourceKind: "initiative",
          sourceRecordId: missing.initiative.initiativeId,
          sourceVersion: missing.source.sourceVersion,
          targetLanguage: "uk",
          state: "MISSING",
          autoNodeCount: 1,
          missingOrStaleNodeCount: 1,
          fallbackPaths: ["title"],
        },
        {
          sourceKind: "initiative",
          sourceRecordId: blocked.initiative.initiativeId,
          sourceVersion: blocked.source.sourceVersion,
          targetLanguage: "uk",
          state: "FAILED",
          autoNodeCount: 1,
          missingOrStaleNodeCount: 1,
          fallbackPaths: ["title"],
        },
      ],
    });
    const selected = selectReadyPresentationsForResidualRetry(explained.selection);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.sourceRecordId, missing.initiative.initiativeId);
    assert.equal(
      explained.selection.blocked.some(
        (row) => row.presentationIdentity.sourceRecordId === blocked.initiative.initiativeId,
      ),
      true,
    );
  });

  it("9–11. public news stays excluded, civic media PLP stays, and production has no ka branch", () => {
    const activation = readFileSync(
      path.join(
        apiSrc,
        "modules/language/published-localized-presentation/universal/media-consumer-plp-activation-enqueue.ts",
      ),
      "utf8",
    );
    assert.match(activation, /civic_media_editorial/);
    assert.match(activation, /civic_media_principle/);
    assert.match(activation, /civic_media_trusted/);
    assert.match(activation, /civic_media_fact_check/);
    assert.match(activation, /civic_media_propaganda/);
    assert.match(activation, /NEWS_EXCLUDED_FROM_LANGUAGE_ACTIVATION/);
    assert.doesNotMatch(activation, /enqueueConsumerVisibleNewsPlpBuilds/);
    assert.doesNotMatch(activation, /news-consumer-build-trigger/);

    const production = [
      "modules/language/public-localization-retry-preflight.ts",
      "modules/language/live-residual-identity.ts",
      "modules/language/live-residual-ct-coverage.ts",
      "modules/language/warm-attempt-version-ownership.ts",
      "modules/language/language-localization-activation/bounded-pwa-civic-coverage.ts",
      "modules/language/public-localization-residual-retry.ts",
    ];
    for (const relative of production) {
      const source = readFileSync(path.join(apiSrc, relative), "utf8");
      assert.doesNotMatch(source, /["']ka["']/);
    }
    const readiness = readFileSync(
      path.join(apiSrc, "modules/language/live-residual-ct-coverage.ts"),
      "utf8",
    );
    assert.doesNotMatch(readiness, /enqueueContentTranslationWarmRequested\(/);
    assert.doesNotMatch(readiness, /generateContentTranslation\(/);

    const coverage = readFileSync(
      path.join(apiSrc, "modules/language/live-residual-ct-coverage.ts"),
      "utf8",
    );
    assert.match(coverage, /discoverStagingInitiativePathWarmSources/);
    assert.match(coverage, /buildPublicLocalizationRetryPreflight/);
    assert.match(coverage, /kind !== "public_news"/);
    assert.doesNotMatch(coverage, /Gemini|resolveTranslationProvider/);
  });
});
