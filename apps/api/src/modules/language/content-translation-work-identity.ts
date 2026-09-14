/**
 * Pack 02G Task 02 — canonical translation work identity + deterministic key.
 *
 * Identity: sourceKind + sourceRecordId + sourceVersion + targetLanguage
 * Reusable for persistence uniqueness, warm-job dedupe, and retry idempotency.
 */

import type {
  ContentTranslationSourceKind,
  ContentTranslationWorkIdentity,
  LanguageCode,
} from "@hu/types";

export function buildContentTranslationWorkIdentity(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLanguage: LanguageCode;
}): ContentTranslationWorkIdentity {
  return {
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId.trim(),
    sourceVersion: input.sourceVersion.trim(),
    targetLanguage: input.targetLanguage.trim().toLowerCase() as LanguageCode,
  };
}

/**
 * Deterministic string key for the work identity.
 * Includes sourceKind (unlike the legacy Pack 01 cache key helper).
 */
export function buildContentTranslationWorkIdentityKey(
  input: ContentTranslationWorkIdentity,
): string {
  const identity = buildContentTranslationWorkIdentity(input);
  return [
    identity.sourceKind,
    identity.sourceRecordId,
    identity.sourceVersion,
    identity.targetLanguage,
  ].join("::");
}
