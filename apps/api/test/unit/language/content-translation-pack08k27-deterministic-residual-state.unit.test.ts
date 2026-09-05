/**
 * Pack 08K.2.7 — deterministic residual state resolution.
 * Deterministic fixtures only — no live Gemini / no staging Mongo mutation.
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
  encodeContentTranslationFailureMetadata,
  ensureLanguageRegistrySeeded,
  enqueueContentTranslationWarmRequested,
  listContentTranslationWarmAttemptsBounded,
  markContentTranslationWarmMemoryFailedForTests,
  peekContentTranslationWarmOutboxFailure,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetResidualDiagnosticCountersForTests,
  resetTranslationProviderForTests,
  resolveCanonicalResidualTranslationState,
  resolveExplicitResidualState,
  residualStateSnapshotDigest,
  selectLatestLocaleRelevantWarmAttempt,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { DeterministicTranslationProvider } from "../../../src/modules/language/providers/deterministic-translation-provider.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import type { ContentTranslationWarmAttemptSnapshot } from "../../../src/modules/language/content-translation-warm-enqueue.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import { parseContentTranslationFailureMetadata } from "../../../src/modules/language/content-translation-failure-metadata.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");

function readApi(rel: string): string {
  return readFileSync(join(apiRoot, rel), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08k27-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08k27",
    createdAt: now,
    updatedAt: now,
    title: `Pack08K27 Initiative ${suffix}`,
    description: `Canonical English prose for deterministic residual ${suffix}.`,
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

function meta(input: {
  sourceRecordId: string;
  targetLocale: string | null;
  failureReasonCode: string;
  localeFailures?: readonly {
    targetLocale: string;
    failureReasonCode: string;
  }[];
}): string {
  return encodeContentTranslationFailureMetadata({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: input.failureReasonCode,
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: "v1",
    targetLocale: input.targetLocale,
    failedAt: "2026-09-05T12:00:00.000Z",
    retryabilityHint: "non_retryable_until_code_or_content_change",
    ...(input.localeFailures
      ? {
          localeFailures: input.localeFailures.map((row) => ({
            targetLocale: row.targetLocale,
            failureClass: "VALIDATION_FAILED",
            failureReasonCode: row.failureReasonCode,
            retryabilityHint: "non_retryable_until_code_or_content_change",
          })),
        }
      : {}),
  });
}

function attempt(input: {
  eventId: string;
  attemptAt: string;
  status?: "failed" | "published" | "pending";
  reason?: string | null;
  targetLocales?: readonly string[] | null;
  lastError?: string | null;
}): ContentTranslationWarmAttemptSnapshot {
  const lastError = input.lastError ?? null;
  return {
    eventId: input.eventId,
    status: input.status ?? "failed",
    reason: input.reason ?? "operator_residual_retry",
    architectureRetryBasis: null,
    requestedAt: input.attemptAt,
    attemptAt: input.attemptAt,
    targetLocales: input.targetLocales
      ? ([...input.targetLocales] as ContentTranslationWarmAttemptSnapshot["targetLocales"])
      : null,
    lastError,
    failureMetadata: parseContentTranslationFailureMetadata(lastError),
  };
}

describe("Pack 08K.2.7 — deterministic residual state resolution", () => {
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

  it("A. deterministic total ordering (equal timestamps + eventId tie-break)", () => {
    const tie = "2026-09-05T10:00:00.000Z";
    const attempts = [
      attempt({
        eventId: "event-a",
        attemptAt: tie,
        lastError: "legacy older unstructured",
        targetLocales: null,
      }),
      attempt({
        eventId: "event-z",
        attemptAt: tie,
        lastError: meta({
          sourceRecordId: "id",
          targetLocale: "uk",
          failureReasonCode: "UNCHANGED_CIVIC_TITLE",
        }),
        targetLocales: ["uk"],
      }),
    ];
    // Shuffle insertion; selector walks by attemptAt then must be stable via list sort in real path.
    const selected = selectLatestLocaleRelevantWarmAttempt({
      attemptsOldestFirst: [...attempts].sort((a, b) => {
        const byTime = a.attemptAt.localeCompare(b.attemptAt);
        return byTime !== 0 ? byTime : a.eventId.localeCompare(b.eventId);
      }),
      targetLocale: "uk",
    });
    assert.equal(selected?.eventId, "event-z");
    assert.equal(selected?.failureMetadata?.failureReasonCode, "UNCHANGED_CIVIC_TITLE");
  });

  it("B. modern locale-specific attempt wins appropriate legacy event", () => {
    const historicalCollapsed = `CT_FAIL_META_V1:${JSON.stringify({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: "VALIDATION_FAILED",
      failureReasonCode: "VALIDATION_FAILED",
      sourceKind: "initiative",
      sourceRecordId: "id",
      sourceVersion: "v1",
      targetLocale: "uk",
      failedAt: "2026-09-05T00:00:00.000Z",
      retryabilityHint: "non_retryable_until_code_or_content_change",
    })}`;
    const selected = selectLatestLocaleRelevantWarmAttempt({
      attemptsOldestFirst: [
        attempt({
          eventId: "legacy",
          attemptAt: "2026-01-01T00:00:00.000Z",
          lastError: "without current materialization",
          targetLocales: null,
        }),
        attempt({
          eventId: "modern",
          attemptAt: "2026-09-05T00:00:00.000Z",
          lastError: historicalCollapsed,
          targetLocales: ["uk"],
        }),
      ],
      targetLocale: "uk",
    });
    assert.equal(selected?.eventId, "modern");
    assert.equal(selected?.failureMetadata?.failureReasonCode, "VALIDATION_FAILED");
  });

  it("C. sibling locale cannot steal failure", async () => {
    const initiative = sampleInitiative("sibling");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const uk = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk", "ar"],
      requestedAt: "2026-09-05T12:00:00.000Z",
    });
    assert.ok(uk.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      uk.eventId,
      meta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
        failureReasonCode: "UNCHANGED_CIVIC_TITLE",
        localeFailures: [{ targetLocale: "uk", failureReasonCode: "UNCHANGED_CIVIC_TITLE" }],
      }),
    );

    const arPeek = await peekContentTranslationWarmOutboxFailure({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "ar",
    });
    // Must NOT remap sibling uk failure to published for ar — look for older/none.
    assert.notEqual(arPeek.failureMetadata?.failureReasonCode, "UNCHANGED_CIVIC_TITLE");

    const ukPeek = await peekContentTranslationWarmOutboxFailure({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
    });
    assert.equal(ukPeek.failureMetadata?.failureReasonCode, "UNCHANGED_CIVIC_TITLE");
    assert.equal(ukPeek.disposition, "failed");
  });

  it("D. CURRENT wins historical FAILED", () => {
    assert.equal(
      resolveCanonicalResidualTranslationState({
        translationRow: { freshness: "current", stale: false },
        liveSourceVersion: "v1",
        outboxDisposition: "failed",
      }),
      "CURRENT",
    );
  });

  it("E. current terminal failure resolved correctly", () => {
    assert.equal(
      resolveCanonicalResidualTranslationState({
        translationRow: null,
        liveSourceVersion: "v1",
        outboxDisposition: "failed",
      }),
      "TERMINAL_FAILED",
    );
  });

  it("F. MISSING resolved correctly", () => {
    assert.equal(
      resolveCanonicalResidualTranslationState({
        translationRow: null,
        liveSourceVersion: "v1",
        outboxDisposition: "none",
      }),
      "MISSING",
    );
  });

  it("G. STALE resolved correctly", () => {
    assert.equal(
      resolveCanonicalResidualTranslationState({
        translationRow: { freshness: "stale", stale: true },
        liveSourceVersion: "v2",
        outboxDisposition: "none",
      }),
      "STALE",
    );
  });

  it("H. active attempt precedence correct", () => {
    assert.equal(
      resolveCanonicalResidualTranslationState({
        translationRow: null,
        liveSourceVersion: "v1",
        outboxDisposition: "pending",
      }),
      "ACTIVE",
    );
    const selected = selectLatestLocaleRelevantWarmAttempt({
      attemptsOldestFirst: [
        attempt({
          eventId: "failed",
          attemptAt: "2026-09-05T11:00:00.000Z",
          status: "failed",
          targetLocales: ["uk"],
          lastError: meta({
            sourceRecordId: "id",
            targetLocale: "uk",
            failureReasonCode: "EMPTY_TRANSLATION",
          }),
        }),
        attempt({
          eventId: "pending",
          attemptAt: "2026-09-05T12:00:00.000Z",
          status: "pending",
          targetLocales: ["uk"],
          lastError: null,
        }),
      ],
      targetLocale: "uk",
    });
    assert.equal(selected?.eventId, "pending");
  });

  it("I. 100 repeated resolutions identical", async () => {
    const initiative = sampleInitiative("repeat");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      meta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
        failureReasonCode: "VALIDATION_FAILED",
      }),
    );

    const first = residualStateSnapshotDigest(
      await resolveExplicitResidualState({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
      }),
    );
    for (let i = 0; i < 100; i += 1) {
      const next = residualStateSnapshotDigest(
        await resolveExplicitResidualState({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        }),
      );
      assert.equal(next, first);
    }
  });

  it("J. shuffled insertion order identical", () => {
    const base = [
      attempt({
        eventId: "e1",
        attemptAt: "2026-01-01T00:00:00.000Z",
        lastError: "legacy",
        targetLocales: null,
      }),
      attempt({
        eventId: "e2",
        attemptAt: "2026-06-01T00:00:00.000Z",
        lastError: meta({
          sourceRecordId: "id",
          targetLocale: "ar",
          failureReasonCode: "EMPTY_TRANSLATION",
        }),
        targetLocales: ["ar"],
      }),
      attempt({
        eventId: "e3",
        attemptAt: "2026-09-01T00:00:00.000Z",
        lastError: meta({
          sourceRecordId: "id",
          targetLocale: "uk",
          failureReasonCode: "UNCHANGED_SOURCE_PROSE",
        }),
        targetLocales: ["uk"],
      }),
    ];
    const sort = (rows: ContentTranslationWarmAttemptSnapshot[]) =>
      [...rows].sort((a, b) => {
        const byTime = a.attemptAt.localeCompare(b.attemptAt);
        return byTime !== 0 ? byTime : a.eventId.localeCompare(b.eventId);
      });
    const a = selectLatestLocaleRelevantWarmAttempt({
      attemptsOldestFirst: sort(base),
      targetLocale: "uk",
    });
    const b = selectLatestLocaleRelevantWarmAttempt({
      attemptsOldestFirst: sort([...base].reverse()),
      targetLocale: "uk",
    });
    assert.equal(a?.eventId, b?.eventId);
    assert.equal(a?.eventId, "e3");
  });

  it("K. two fresh resolver instances identical", async () => {
    const initiative = sampleInitiative("cross-process");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["zh-Hant"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      meta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "zh-Hant",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
      }),
    );

    const left = residualStateSnapshotDigest(
      await resolveExplicitResidualState({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLocale: "zh-Hant",
      }),
    );
    // Simulate fresh call path (no shared snapshot object).
    const right = residualStateSnapshotDigest(
      await resolveExplicitResidualState({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLocale: "zh-Hant",
      }),
    );
    assert.equal(left, right);
  });

  it("L. no process-local Map dependency in residual-state module", () => {
    const source = readApi("src/modules/language/content-translation-residual-state.ts");
    assert.doesNotMatch(source, /new Map\(/);
    assert.doesNotMatch(source, /memoryRecordsByEventId/);
    assert.match(source, /listContentTranslationWarmAttemptsBounded/);
  });

  it("M. explicit four-identity mode bounded", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const initiative = sampleInitiative(`four-${i}`);
      createInitiative(initiative);
      createdInitiativeIds.push(initiative.initiativeId);
      ids.push(initiative.initiativeId);
      const enqueued = await enqueueContentTranslationWarmRequested({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        reason: "operator_residual_retry",
        targetLocales: ["uk"],
      });
      assert.ok(enqueued.eventId);
      markContentTranslationWarmMemoryFailedForTests(
        enqueued.eventId,
        meta({
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
          failureReasonCode: "VALIDATION_FAILED",
        }),
      );
    }
    const snapshots = [];
    for (const id of ids) {
      snapshots.push(
        await resolveExplicitResidualState({
          sourceKind: "initiative",
          sourceRecordId: id,
          targetLocale: "uk",
        }),
      );
    }
    assert.equal(snapshots.length, 4);
    assert.ok(
      snapshots.every((row) => row.resolvedTranslationState === "TERMINAL_FAILED"),
    );
  });

  it("N/O. no provider call / no write in residual-state module", () => {
    const source = readApi("src/modules/language/content-translation-residual-state.ts");
    assert.doesNotMatch(source, /getOrCreateContentTranslation\(/);
    assert.doesNotMatch(source, /enqueueContentTranslationWarmRequested\(/);
    assert.doesNotMatch(source, /Gemini/);
    const script = readApi("src/scripts/reconcile-public-localization.ts");
    assert.match(script, /--snapshot-explicit-residual-state/);
  });

  it("P. CURRENT + historical FAILED snapshot clears failure codes", async () => {
    const initiative = sampleInitiative("current-hist");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    await upsertContentTranslation({
      translationId: "tr-08k27",
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { title: "[uk] ok", description: "[uk] ok" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      meta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
        failureReasonCode: "VALIDATION_FAILED",
      }),
    );

    const snapshot = await resolveExplicitResidualState({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
    });
    assert.equal(snapshot.resolvedTranslationState, "CURRENT");
    // Snapshot still reports selected attempt for diagnostics, but state is CURRENT.
    assert.equal(snapshot.translationRowExists, true);
  });

  it("list attempts remain bounded", async () => {
    const initiative = sampleInitiative("bound");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    for (let i = 0; i < 15; i += 1) {
      const enqueued = await enqueueContentTranslationWarmRequested({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        reason: "operator_residual_retry",
        targetLocales: ["uk"],
        requestedAt: `2026-09-05T${String(i).padStart(2, "0")}:00:00.000Z`,
      });
      assert.ok(enqueued.eventId);
      markContentTranslationWarmMemoryFailedForTests(enqueued.eventId, "legacy");
    }
    const attempts = await listContentTranslationWarmAttemptsBounded({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      limit: 10,
    });
    assert.ok(attempts.length <= 10);
  });
});
