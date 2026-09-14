/**
 * Pack 08K.2.7 — canonical, deterministic residual translation-state resolution.
 *
 * Persistence-backed only. No process-local Maps as source of truth.
 * Never prints source/translated prose, prompts, or provider payloads.
 *
 * Pack 08K.2.8 — pure selection lives in content-translation-residual-state-core.ts
 * (thin-diagnostic safe). This module retains the thick resolveExplicitResidualState
 * path used by historical reconcile operators (memory-unsafe at import time).
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import type { ContentTranslationSafeFailureMetadata } from "./content-translation-failure-metadata.js";
import {
  CONTENT_TRANSLATION_WARM_ATTEMPTS_LIST_LIMIT,
  listContentTranslationWarmAttemptsBounded,
  type ContentTranslationWarmAttemptSnapshot,
  type ContentTranslationWarmOutboxDisposition,
} from "./content-translation-warm-enqueue.js";
import { findContentTranslation } from "./persistence/content-translation.repository.js";
import { loadTranslatableSourceDirect } from "./content-translation-source-direct.js";
import {
  resolveAttemptFailureFields,
  resolveCanonicalResidualTranslationState,
  selectLatestLocaleRelevantWarmAttempt,
  type ResidualResolvedTranslationState,
} from "./content-translation-residual-state-core.js";

export type { ResidualResolvedTranslationState } from "./content-translation-residual-state-core.js";
export {
  resolveAttemptFailureFields,
  resolveCanonicalResidualTranslationState,
  selectLatestLocaleRelevantWarmAttempt,
} from "./content-translation-residual-state-core.js";

export type ResidualStateSnapshot = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
  readonly sourceVersion: string | null;
  readonly sourceFingerprint: string | null;
  readonly translationRowExists: boolean;
  readonly translationRowStatus: "current" | "stale" | "absent" | "other";
  readonly translationVersionMatch: boolean | null;
  readonly translationUpdatedAt: string | null;
  readonly activeAttemptExists: boolean;
  readonly terminalAttemptCountInspected: number;
  readonly selectedAttemptId: string | null;
  readonly selectedAttemptCreatedAt: string | null;
  readonly selectedAttemptReason: string | null;
  readonly selectedAttemptMetadataVersion: string | null;
  readonly selectedAttemptTargetLocale: string | null;
  readonly selectedFailureClass: string | null;
  readonly selectedFailureReasonCode: string | null;
  readonly resolvedTranslationState: ResidualResolvedTranslationState;
  readonly outboxDisposition: ContentTranslationWarmOutboxDisposition;
  readonly failureMetadata: ContentTranslationSafeFailureMetadata | null;
  readonly latestAttempt: ContentTranslationWarmAttemptSnapshot | null;
};

/**
 * Resolve residual state for one explicit identity from persistence.
 * Read-only; bounded attempt listing.
 *
 * @deprecated Prefer thin-localization-diagnostic for operator observation
 * (Pack 08K.2.8). This path remains for in-process tests of thick adapters.
 */
export async function resolveExplicitResidualState(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
  readonly attemptLimit?: number;
}): Promise<ResidualStateSnapshot> {
  let sourceVersion: string | null = null;
  let sourceFingerprint: string | null = null;

  try {
    const source = await loadTranslatableSourceDirect({
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
    });
    if (source) {
      sourceVersion = source.sourceVersion;
      sourceFingerprint = `${source.sourceKind}::${source.sourceRecordId}::${source.sourceVersion}`;
    }
  } catch {
    sourceVersion = null;
    sourceFingerprint = null;
  }

  let translationRow: Awaited<ReturnType<typeof findContentTranslation>> = null;
  if (sourceVersion) {
    translationRow = await findContentTranslation({
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      sourceVersion,
      targetLanguage: input.targetLocale,
    });
  }

  const attempts = await listContentTranslationWarmAttemptsBounded({
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    limit: input.attemptLimit ?? CONTENT_TRANSLATION_WARM_ATTEMPTS_LIST_LIMIT,
  });

  const selected = selectLatestLocaleRelevantWarmAttempt({
    attemptsOldestFirst: attempts,
    targetLocale: input.targetLocale,
  });
  const failure = resolveAttemptFailureFields(selected, input.targetLocale);
  const resolvedTranslationState = resolveCanonicalResidualTranslationState({
    translationRow,
    liveSourceVersion: sourceVersion,
    outboxDisposition: failure.disposition,
  });

  const terminalAttemptCountInspected = attempts.filter(
    (row) => row.status === "failed",
  ).length;

  let translationRowStatus: ResidualStateSnapshot["translationRowStatus"] = "absent";
  if (translationRow) {
    if (translationRow.freshness === "current" && translationRow.stale !== true) {
      translationRowStatus = "current";
    } else if (translationRow.stale === true || translationRow.freshness === "stale") {
      translationRowStatus = "stale";
    } else {
      translationRowStatus = "other";
    }
  }

  return {
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    targetLocale: input.targetLocale,
    sourceVersion,
    sourceFingerprint,
    translationRowExists: Boolean(translationRow),
    translationRowStatus,
    translationVersionMatch: translationRow
      ? translationRow.sourceVersion === sourceVersion
      : null,
    translationUpdatedAt: translationRow?.updatedAt ?? null,
    activeAttemptExists: failure.disposition === "pending",
    terminalAttemptCountInspected,
    selectedAttemptId: selected?.eventId ?? null,
    selectedAttemptCreatedAt: selected?.attemptAt ?? null,
    selectedAttemptReason: selected?.reason ?? null,
    selectedAttemptMetadataVersion: failure.failureMetadata
      ? failure.failureMetadata.schema
      : selected?.status === "failed"
        ? "legacy_unstructured"
        : null,
    selectedAttemptTargetLocale: failure.failureMetadata?.targetLocale
      ? String(failure.failureMetadata.targetLocale)
      : selected?.targetLocales?.includes(input.targetLocale)
        ? input.targetLocale
        : null,
    selectedFailureClass: failure.failureClass,
    selectedFailureReasonCode: failure.failureReasonCode,
    resolvedTranslationState,
    outboxDisposition: failure.disposition,
    failureMetadata: failure.failureMetadata,
    latestAttempt: selected as ContentTranslationWarmAttemptSnapshot | null,
  };
}

/** Serialize comparable snapshot fields (no attempt object refs / prose). */
export function residualStateSnapshotDigest(
  snapshot: ResidualStateSnapshot,
): string {
  return JSON.stringify({
    sourceKind: snapshot.sourceKind,
    sourceRecordId: snapshot.sourceRecordId,
    targetLocale: snapshot.targetLocale,
    sourceVersion: snapshot.sourceVersion,
    sourceFingerprint: snapshot.sourceFingerprint,
    translationRowExists: snapshot.translationRowExists,
    translationRowStatus: snapshot.translationRowStatus,
    translationVersionMatch: snapshot.translationVersionMatch,
    translationUpdatedAt: snapshot.translationUpdatedAt,
    activeAttemptExists: snapshot.activeAttemptExists,
    terminalAttemptCountInspected: snapshot.terminalAttemptCountInspected,
    selectedAttemptId: snapshot.selectedAttemptId,
    selectedAttemptCreatedAt: snapshot.selectedAttemptCreatedAt,
    selectedAttemptReason: snapshot.selectedAttemptReason,
    selectedAttemptMetadataVersion: snapshot.selectedAttemptMetadataVersion,
    selectedAttemptTargetLocale: snapshot.selectedAttemptTargetLocale,
    selectedFailureClass: snapshot.selectedFailureClass,
    selectedFailureReasonCode: snapshot.selectedFailureReasonCode,
    resolvedTranslationState: snapshot.resolvedTranslationState,
    outboxDisposition: snapshot.outboxDisposition,
  });
}
