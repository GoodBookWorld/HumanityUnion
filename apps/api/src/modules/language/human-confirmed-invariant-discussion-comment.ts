/**
 * Two French discussion comments whose source text is the confirmed translation.
 *
 * Write guard for the recovery script. Readiness uses
 * isAuthoritativeManualTranslation and does not consult these identities.
 */

import type { TranslatedContentRecord } from "@hu/types";

export const HUMAN_CONFIRMED_INVARIANT_TARGET_LOCALE = "fr" as const;

export type HumanConfirmedInvariantDiscussionComment = {
  readonly sourceKind: "discussion_comment";
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceBody: string;
  readonly targetLanguage: typeof HUMAN_CONFIRMED_INVARIANT_TARGET_LOCALE;
  readonly translatedBody: string;
};

export const HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS = [
  {
    sourceKind: "discussion_comment",
    sourceRecordId: "ff0345b3-47ba-43f8-8d46-2e8368ada089",
    sourceVersion: "v-40261791a2c14050",
    sourceBody: "Test",
    targetLanguage: HUMAN_CONFIRMED_INVARIANT_TARGET_LOCALE,
    translatedBody: "Test",
  },
  {
    sourceKind: "discussion_comment",
    sourceRecordId: "3054799b-3b9b-4d59-ac17-638ae7fbf117",
    sourceVersion: "v-42b3253b643dddbe",
    sourceBody: "test",
    targetLanguage: HUMAN_CONFIRMED_INVARIANT_TARGET_LOCALE,
    translatedBody: "test",
  },
] as const satisfies readonly HumanConfirmedInvariantDiscussionComment[];

export type HumanConfirmedInvariantTranslationIdentity = {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLanguage: string;
  readonly translationKind: string;
  readonly translatedBody: string;
};

/**
 * True only for a human French row of one allowlisted comment, version, and body.
 * Comparison is exact. Case, locale, and version are not normalized.
 */
export function isHumanConfirmedInvariantDiscussionComment(
  input: HumanConfirmedInvariantTranslationIdentity,
): boolean {
  return HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS.some(
    (target) =>
      input.sourceKind === target.sourceKind &&
      input.sourceRecordId === target.sourceRecordId &&
      input.sourceVersion === target.sourceVersion &&
      input.targetLanguage === target.targetLanguage &&
      input.translationKind === "human" &&
      input.translatedBody === target.translatedBody,
  );
}

function translatedBody(record: Pick<TranslatedContentRecord, "translatedContent">): string | null {
  const content = record.translatedContent;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const keys = Object.keys(content);
  if (keys.length !== 1 || keys[0] !== "body") {
    return null;
  }
  const body = content.body;
  return typeof body === "string" ? body : null;
}

/**
 * The row this recovery persists. Timestamps and translationId may differ.
 * Any other French row for the identity is a conflict.
 */
export function isExactHumanConfirmedInvariantTranslation(
  record: TranslatedContentRecord,
): boolean {
  const body = translatedBody(record);
  if (body === null) {
    return false;
  }
  if (record.localizationInputVersion) {
    return false;
  }
  return (
    record.sourceLanguage === "en" &&
    record.translationProvider === "human" &&
    record.freshness === "current" &&
    record.stale === false &&
    isHumanConfirmedInvariantDiscussionComment({
      sourceKind: record.sourceKind,
      sourceRecordId: record.sourceRecordId,
      sourceVersion: record.sourceVersion,
      targetLanguage: record.targetLanguage,
      translationKind: record.translationKind,
      translatedBody: body,
    })
  );
}

export function buildHumanConfirmedInvariantTranslationRecord(input: {
  readonly target: HumanConfirmedInvariantDiscussionComment;
  readonly translationId: string;
  readonly now: string;
}): TranslatedContentRecord {
  return {
    translationId: input.translationId,
    sourceKind: input.target.sourceKind,
    sourceRecordId: input.target.sourceRecordId,
    sourceVersion: input.target.sourceVersion,
    sourceLanguage: "en",
    targetLanguage: input.target.targetLanguage,
    translatedContent: { body: input.target.translatedBody },
    translationProvider: "human",
    translationKind: "human",
    createdAt: input.now,
    updatedAt: input.now,
    stale: false,
    freshness: "current",
  };
}
