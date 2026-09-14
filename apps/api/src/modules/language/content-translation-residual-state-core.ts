/**
 * Pack 08K.2.7 / 08K.2.8 — pure residual translation-state selection.
 *
 * No Mongo, warm-enqueue, source-direct, or provider imports.
 * Safe for the thin localization diagnostic process graph.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import {
  classifyLegacyOutboxLastError,
  resolveLocaleFailureFromMetadata,
  type ContentTranslationSafeFailureMetadata,
} from "./content-translation-failure-metadata.js";

export type ResidualResolvedTranslationState =
  | "CURRENT"
  | "ACTIVE"
  | "TERMINAL_FAILED"
  | "MISSING"
  | "STALE"
  | "UNKNOWN";

export type ContentTranslationWarmOutboxDisposition =
  | "pending"
  | "failed"
  | "published"
  | "none";

/** Minimal attempt shape shared by thick and thin resolvers. */
export type ResidualWarmAttemptLike = {
  readonly eventId: string;
  readonly status: "pending" | "published" | "failed";
  readonly reason: string | null;
  readonly architectureRetryBasis: string | null;
  readonly requestedAt: string;
  readonly attemptAt: string;
  readonly targetLocales: readonly LanguageCode[] | null;
  readonly lastError: string | null;
  readonly failureMetadata: ContentTranslationSafeFailureMetadata | null;
};

function attemptMentionsLocale(
  attempt: ResidualWarmAttemptLike,
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
  readonly attemptsOldestFirst: readonly ResidualWarmAttemptLike[];
  readonly targetLocale: LanguageCode | string;
}): ResidualWarmAttemptLike | null {
  const locale = String(input.targetLocale);
  let bestLocaleConstrained: ResidualWarmAttemptLike | null = null;
  let bestLegacyUnrestricted: ResidualWarmAttemptLike | null = null;

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
  attempt: ResidualWarmAttemptLike | null,
  targetLocale: LanguageCode | string,
): {
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
  readonly retryabilityHint: string | null;
  readonly failureMetadata: ContentTranslationSafeFailureMetadata | null;
  readonly disposition: ContentTranslationWarmOutboxDisposition;
} {
  if (!attempt) {
    return {
      failureClass: null,
      failureReasonCode: null,
      retryabilityHint: null,
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
        retryabilityHint: localeResolved.retryabilityHint,
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
      retryabilityHint: null,
      failureMetadata: null,
    };
  }

  return {
    disposition,
    failureClass: null,
    failureReasonCode: null,
    retryabilityHint: attempt.failureMetadata?.retryabilityHint ?? null,
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

export type ResidualStateIdentity = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
};
