/**
 * Pack 08K.2.8 — thin residual state resolution (DI-friendly, read-only).
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import {
  resolveAttemptFailureFields,
  resolveCanonicalResidualTranslationState,
  selectLatestLocaleRelevantWarmAttempt,
  type ResidualResolvedTranslationState,
  type ResidualWarmAttemptLike,
} from "../content-translation-residual-state-core.js";
import {
  isThinLocaleContentTranslationEnabled,
  listThinWarmAttemptsBounded,
  loadThinSourceVersionMetadata,
  loadThinTranslationRow,
  THIN_WARM_ATTEMPTS_LIST_LIMIT,
} from "./mongo-lookups.js";
import type { ThinResidualIdentity } from "./parse-residual-args.js";
import { markThinIdentityResolved } from "./thin-counters.js";

export type ThinResidualDiagnosticRow = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
  readonly sourceExists: boolean;
  readonly sourceVersion: string | null;
  readonly translationRowExists: boolean;
  readonly translationSourceVersion: string | null;
  readonly translationState: ResidualResolvedTranslationState;
  readonly translationUpdatedAt: string | null;
  readonly activeAttemptExists: boolean;
  readonly selectedAttemptId: string | null;
  readonly selectedAttemptCreatedAt: string | null;
  readonly selectedAttemptReason: string | null;
  readonly failureMetadataVersion: string | null;
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
  readonly retryability: string | null;
  readonly architectureRetryBasis: string | null;
  readonly localeEnabled: boolean | null;
  readonly outboxRowsInspected: number;
};

export type ThinResidualLookupDeps = {
  readonly loadSource: (
    identity: ThinResidualIdentity,
  ) => Promise<{
    readonly sourceExists: boolean;
    readonly sourceVersion: string | null;
  }>;
  readonly loadTranslation: (input: {
    readonly sourceKind: ContentTranslationSourceKind;
    readonly sourceRecordId: string;
    readonly sourceVersion: string;
    readonly targetLocale: LanguageCode;
  }) => Promise<{
    readonly translationRowExists: boolean;
    readonly translationSourceVersion: string | null;
    readonly translationFreshness: string | null;
    readonly translationStale: boolean | null;
    readonly translationUpdatedAt: string | null;
  }>;
  readonly listAttempts: (input: {
    readonly sourceKind: ContentTranslationSourceKind;
    readonly sourceRecordId: string;
    readonly limit?: number;
  }) => Promise<{
    readonly attempts: readonly ResidualWarmAttemptLike[];
    readonly outboxRowsInspected: number;
  }>;
  readonly isLocaleEnabled: (locale: LanguageCode) => Promise<boolean>;
};

export const defaultThinResidualLookupDeps: ThinResidualLookupDeps = {
  loadSource: loadThinSourceVersionMetadata,
  loadTranslation: loadThinTranslationRow,
  listAttempts: listThinWarmAttemptsBounded,
  isLocaleEnabled: isThinLocaleContentTranslationEnabled,
};

export function thinResidualDiagnosticDigest(row: ThinResidualDiagnosticRow): string {
  return JSON.stringify({
    sourceKind: row.sourceKind,
    sourceRecordId: row.sourceRecordId,
    targetLocale: row.targetLocale,
    sourceExists: row.sourceExists,
    sourceVersion: row.sourceVersion,
    translationRowExists: row.translationRowExists,
    translationSourceVersion: row.translationSourceVersion,
    translationState: row.translationState,
    translationUpdatedAt: row.translationUpdatedAt,
    activeAttemptExists: row.activeAttemptExists,
    selectedAttemptId: row.selectedAttemptId,
    selectedAttemptCreatedAt: row.selectedAttemptCreatedAt,
    selectedAttemptReason: row.selectedAttemptReason,
    failureMetadataVersion: row.failureMetadataVersion,
    failureClass: row.failureClass,
    failureReasonCode: row.failureReasonCode,
    retryability: row.retryability,
    architectureRetryBasis: row.architectureRetryBasis,
    localeEnabled: row.localeEnabled,
  });
}

export async function resolveThinResidualState(
  identity: ThinResidualIdentity,
  deps: ThinResidualLookupDeps = defaultThinResidualLookupDeps,
  attemptLimit: number = THIN_WARM_ATTEMPTS_LIST_LIMIT,
): Promise<ThinResidualDiagnosticRow> {
  const source = await deps.loadSource(identity);
  const localeEnabled = await deps.isLocaleEnabled(identity.targetLocale);

  let translation: Awaited<ReturnType<ThinResidualLookupDeps["loadTranslation"]>> = {
    translationRowExists: false,
    translationSourceVersion: null,
    translationFreshness: null,
    translationStale: null,
    translationUpdatedAt: null,
  };
  if (source.sourceExists && source.sourceVersion) {
    translation = await deps.loadTranslation({
      sourceKind: identity.sourceKind,
      sourceRecordId: identity.sourceRecordId,
      sourceVersion: source.sourceVersion,
      targetLocale: identity.targetLocale,
    });
  }

  const { attempts, outboxRowsInspected } = await deps.listAttempts({
    sourceKind: identity.sourceKind,
    sourceRecordId: identity.sourceRecordId,
    limit: attemptLimit,
  });

  const selected = selectLatestLocaleRelevantWarmAttempt({
    attemptsOldestFirst: attempts,
    targetLocale: identity.targetLocale,
  });
  const failure = resolveAttemptFailureFields(selected, identity.targetLocale);
  const translationState = resolveCanonicalResidualTranslationState({
    translationRow: translation.translationRowExists
      ? {
          freshness: translation.translationFreshness ?? undefined,
          stale: translation.translationStale ?? undefined,
          sourceVersion: translation.translationSourceVersion ?? undefined,
        }
      : null,
    liveSourceVersion: source.sourceVersion,
    outboxDisposition: failure.disposition,
  });

  markThinIdentityResolved();

  return {
    sourceKind: identity.sourceKind,
    sourceRecordId: identity.sourceRecordId,
    targetLocale: identity.targetLocale,
    sourceExists: source.sourceExists,
    sourceVersion: source.sourceVersion,
    translationRowExists: translation.translationRowExists,
    translationSourceVersion: translation.translationSourceVersion,
    translationState,
    translationUpdatedAt: translation.translationUpdatedAt,
    activeAttemptExists: failure.disposition === "pending",
    selectedAttemptId: selected?.eventId ?? null,
    selectedAttemptCreatedAt: selected?.attemptAt ?? null,
    selectedAttemptReason: selected?.reason ?? null,
    failureMetadataVersion: failure.failureMetadata
      ? failure.failureMetadata.schema
      : selected?.status === "failed"
        ? "legacy_unstructured"
        : null,
    failureClass: failure.failureClass,
    failureReasonCode: failure.failureReasonCode,
    retryability: failure.retryabilityHint,
    architectureRetryBasis: selected?.architectureRetryBasis ?? null,
    localeEnabled,
    outboxRowsInspected,
  };
}
