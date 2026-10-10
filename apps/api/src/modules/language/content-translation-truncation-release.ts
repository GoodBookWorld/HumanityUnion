/**
 * Explicit one-time release for a truncated content-translation identity.
 *
 * The truncation hold stays closed for reconciliation, activation, and
 * ordinary operator retries. This module names one identity and enqueues
 * one warm. The warm consumer spends that outbox row before the provider
 * call, so a crash cannot replay the attempt.
 */

import type { ContentTranslationSourceKind, ContentTranslationWarmRequestedCommand, LanguageCode } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import {
  SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
} from "./content-translation-failure-metadata.js";
import {
  selectInvalidProviderPayloadRetry,
  shouldHoldAutomaticRetryForUnsplitTruncation,
  type InvalidProviderPayloadRetryAttempt,
} from "./content-translation-provider-payload-retry.js";
import {
  enqueueContentTranslationWarmRequested,
  type ContentTranslationWarmEnqueueResult,
} from "./content-translation-warm-enqueue.js";

export const CONTENT_TRANSLATION_TRUNCATION_RELEASE_BASIS =
  "CONTENT_TRANSLATION_TRUNCATION_RELEASE_ONCE_v1" as const;

export type TruncationReleaseIdentity = {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly targetLocale: string;
  readonly sourceVersion: string;
};

function sameLocale(left: string, right: string): boolean {
  try {
    return normalizeLanguageRegistryLocaleKey(left) === normalizeLanguageRegistryLocaleKey(right);
  } catch {
    return left.trim() === right.trim();
  }
}

export function sameTruncationReleaseIdentity(
  left: TruncationReleaseIdentity,
  right: TruncationReleaseIdentity,
): boolean {
  return (
    left.sourceKind.trim() === right.sourceKind.trim() &&
    left.sourceRecordId.trim() === right.sourceRecordId.trim() &&
    left.sourceVersion.trim() === right.sourceVersion.trim() &&
    sameLocale(left.targetLocale, right.targetLocale)
  );
}

/**
 * The command is an authorization only when every identity field is present
 * and the architecture basis is the one-time release marker.
 */
export function explicitTruncationReleaseIdentity(
  command: Pick<
    ContentTranslationWarmRequestedCommand,
    "architectureRetryBasis" | "sourceKind" | "sourceRecordId" | "sourceVersion" | "targetLocales"
  >,
): TruncationReleaseIdentity | null {
  if (command.architectureRetryBasis !== CONTENT_TRANSLATION_TRUNCATION_RELEASE_BASIS) {
    return null;
  }
  const sourceKind = command.sourceKind.trim();
  const sourceRecordId = command.sourceRecordId.trim();
  const sourceVersion = command.sourceVersion?.trim() ?? "";
  const locales = command.targetLocales ?? [];
  const targetLocale = locales.length === 1 ? locales[0]?.trim() ?? "" : "";
  if (!sourceKind || !sourceRecordId || !sourceVersion || !targetLocale) {
    return null;
  }
  return { sourceKind, sourceRecordId, targetLocale, sourceVersion };
}

export function truncationReleaseMatchesLive(
  command: Pick<
    ContentTranslationWarmRequestedCommand,
    "architectureRetryBasis" | "sourceKind" | "sourceRecordId" | "sourceVersion" | "targetLocales"
  >,
  live: TruncationReleaseIdentity,
): boolean {
  const authorized = explicitTruncationReleaseIdentity(command);
  if (!authorized) {
    return false;
  }
  return sameTruncationReleaseIdentity(authorized, live);
}

export function truncationReleaseDecision(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly targetLocale: string;
  readonly sourceVersion: string;
  readonly attempts: readonly InvalidProviderPayloadRetryAttempt[];
  readonly nowMs?: number;
}): {
  readonly required: boolean;
  readonly exhausted: boolean;
  readonly countedFailures: number;
} {
  const decision = selectInvalidProviderPayloadRetry({
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    targetLocale: input.targetLocale,
    sourceVersion: input.sourceVersion,
    attempts: input.attempts,
    nowMs: input.nowMs,
  });
  const truncated = shouldHoldAutomaticRetryForUnsplitTruncation({
    sourceVersion: input.sourceVersion,
    targetLocale: input.targetLocale,
    attempts: input.attempts,
    retryOutcome: "due",
  });
  if (!truncated) {
    return {
      required: false,
      exhausted: false,
      countedFailures: decision.countedFailures,
    };
  }
  return {
    required: true,
    exhausted:
      decision.outcome === "exhausted" ||
      decision.countedFailures >= SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
    countedFailures: decision.countedFailures,
  };
}

/**
 * Enqueue one warm for this exact identity. A pending warm for the same
 * source is deduped and does not create a second authorization.
 */
export async function enqueueTruncationReleaseOnce(
  input: TruncationReleaseIdentity,
): Promise<ContentTranslationWarmEnqueueResult> {
  const sourceKind = input.sourceKind.trim();
  const sourceRecordId = input.sourceRecordId.trim();
  const targetLocale = input.targetLocale.trim();
  const sourceVersion = input.sourceVersion.trim();
  if (!sourceKind || !sourceRecordId || !targetLocale || !sourceVersion) {
    throw new Error(
      "Truncation release requires sourceKind, sourceRecordId, targetLocale, and sourceVersion.",
    );
  }
  return enqueueContentTranslationWarmRequested({
    sourceKind: sourceKind as ContentTranslationSourceKind,
    sourceRecordId,
    reason: "operator_manual",
    targetLocales: [targetLocale as LanguageCode],
    sourceVersion,
    architectureRetryBasis: CONTENT_TRANSLATION_TRUNCATION_RELEASE_BASIS,
  });
}
