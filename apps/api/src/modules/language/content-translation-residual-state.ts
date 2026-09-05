/**
 * Pack 08K.2.7 — canonical, deterministic residual translation-state resolution.
 *
 * Persistence-backed only. No process-local Maps as source of truth.
 * Never prints source/translated prose, prompts, or provider payloads.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import {
  classifyLegacyOutboxLastError,
  resolveLocaleFailureFromMetadata,
  type ContentTranslationSafeFailureMetadata,
} from "./content-translation-failure-metadata.js";
import {
  CONTENT_TRANSLATION_WARM_ATTEMPTS_LIST_LIMIT,
  listContentTranslationWarmAttemptsBounded,
  type ContentTranslationWarmAttemptSnapshot,
  type ContentTranslationWarmOutboxDisposition,
} from "./content-translation-warm-enqueue.js";
import { findContentTranslation } from "./persistence/content-translation.repository.js";
import { loadTranslatableSourceDirect } from "./content-translation-source-direct.js";

export type ResidualResolvedTranslationState =
  | "CURRENT"
  | "ACTIVE"
  | "TERMINAL_FAILED"
  | "MISSING"
  | "STALE"
  | "UNKNOWN";

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

function attemptMentionsLocale(
  attempt: ContentTranslationWarmAttemptSnapshot,
  targetLocale: LanguageCode | string,
): boolean {
  if (!attempt.targetLocales || attempt.targetLocales.length === 0) {
    return true;
  }
  return attempt.targetLocales.includes(targetLocale as LanguageCode);
}

/**
 * Deterministic locale-relevant latest attempt.
 *
 * Precedence (newest → oldest walk):
 * 1. Active pending attempt that mentions the locale
 * 2. Newest CT_FAIL_META_V1 attempt attributed to targetLocale
 * 3. Newest locale-constrained attempt (targetLocales includes locale)
 * 4. Newest unrestricted legacy aggregate attempt (empty targetLocales)
 *
 * Sibling-locale structured failures are skipped — never remapped to "published".
 */
export function selectLatestLocaleRelevantWarmAttempt(input: {
  readonly attemptsOldestFirst: readonly ContentTranslationWarmAttemptSnapshot[];
  readonly targetLocale: LanguageCode | string;
}): ContentTranslationWarmAttemptSnapshot | null {
  const locale = String(input.targetLocale);
  let bestLocaleConstrained: ContentTranslationWarmAttemptSnapshot | null = null;
  let bestLegacyUnrestricted: ContentTranslationWarmAttemptSnapshot | null = null;

  for (let i = input.attemptsOldestFirst.length - 1; i >= 0; i -= 1) {
    const attempt = input.attemptsOldestFirst[i]!;
    if (!attemptMentionsLocale(attempt, locale)) {
      continue;
    }

    if (attempt.status === "pending") {
      return attempt;
    }

    if (attempt.failureMetadata) {
      const attributed = resolveLocaleFailureFromMetadata(
        attempt.failureMetadata,
        locale,
      ).attributed;
      if (attributed) {
        return attempt;
      }
      // Sibling locale structured failure — skip.
      continue;
    }

    if (attempt.targetLocales?.includes(locale as LanguageCode)) {
      if (!bestLocaleConstrained) {
        bestLocaleConstrained = attempt;
      }
      continue;
    }

    if (!attempt.targetLocales || attempt.targetLocales.length === 0) {
      if (!bestLegacyUnrestricted) {
        bestLegacyUnrestricted = attempt;
      }
    }
  }

  return bestLocaleConstrained ?? bestLegacyUnrestricted;
}

export function resolveAttemptFailureFields(
  attempt: ContentTranslationWarmAttemptSnapshot | null,
  targetLocale: LanguageCode | string,
): {
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
  readonly failureMetadata: ContentTranslationSafeFailureMetadata | null;
  readonly disposition: ContentTranslationWarmOutboxDisposition;
} {
  if (!attempt) {
    return {
      failureClass: null,
      failureReasonCode: null,
      failureMetadata: null,
      disposition: "none",
    };
  }

  const disposition: ContentTranslationWarmOutboxDisposition =
    attempt.status === "pending"
      ? "pending"
      : attempt.status === "failed"
        ? "failed"
        : attempt.status === "published"
          ? "published"
          : "none";

  if (attempt.failureMetadata) {
    const localeResolved = resolveLocaleFailureFromMetadata(
      attempt.failureMetadata,
      targetLocale,
    );
    if (localeResolved.attributed) {
      return {
        disposition,
        failureClass: localeResolved.failureClass,
        failureReasonCode: localeResolved.failureReasonCode,
        failureMetadata: {
          ...attempt.failureMetadata,
          failureClass:
            localeResolved.failureClass ?? attempt.failureMetadata.failureClass,
          failureReasonCode:
            localeResolved.failureReasonCode ??
            attempt.failureMetadata.failureReasonCode,
          retryabilityHint:
            localeResolved.retryabilityHint ??
            attempt.failureMetadata.retryabilityHint,
          targetLocale: String(targetLocale),
        },
      };
    }
  }

  if (disposition === "failed") {
    const legacy = classifyLegacyOutboxLastError(attempt.lastError);
    return {
      disposition,
      failureClass: legacy.failureClass,
      failureReasonCode: legacy.failureReasonCode,
      failureMetadata: null,
    };
  }

  return {
    disposition,
    failureClass: null,
    failureReasonCode: null,
    failureMetadata: attempt.failureMetadata,
  };
}

/**
 * Canonical translation-state precedence for live sourceVersion:
 * A. CURRENT translation row => CURRENT (regardless of historical failures)
 * B. active current-version attempt => ACTIVE
 * C. latest terminal attempt => TERMINAL_FAILED
 * D. no translation / no attempt => MISSING
 * E. non-current translation row => STALE
 */
export function resolveCanonicalResidualTranslationState(input: {
  readonly translationRow: {
    readonly freshness?: string;
    readonly stale?: boolean;
    readonly sourceVersion?: string;
  } | null;
  readonly liveSourceVersion: string | null;
  readonly outboxDisposition: ContentTranslationWarmOutboxDisposition;
}): ResidualResolvedTranslationState {
  const row = input.translationRow;
  if (row && row.freshness === "current" && row.stale !== true) {
    return "CURRENT";
  }
  if (row && (row.stale === true || row.freshness === "stale")) {
    return "STALE";
  }
  if (input.outboxDisposition === "pending") {
    return "ACTIVE";
  }
  if (input.outboxDisposition === "failed") {
    return "TERMINAL_FAILED";
  }
  if (!row) {
    return "MISSING";
  }
  if (
    input.liveSourceVersion &&
    row.sourceVersion &&
    row.sourceVersion !== input.liveSourceVersion
  ) {
    return "STALE";
  }
  return "UNKNOWN";
}

/**
 * Resolve residual state for one explicit identity from persistence.
 * Read-only; bounded attempt listing.
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
    latestAttempt: selected,
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
