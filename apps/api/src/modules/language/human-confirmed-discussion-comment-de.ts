/**
 * Checked-in German recovery manifest for two discussion comments.
 *
 * The translated body is the confirmed human text. This list does not
 * authorize any other locale, comment, or short-word exception.
 */

import type { HumanConfirmedTranslationTarget } from "./human-confirmed-translation-recovery.js";

export const HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE_TARGET_LANGUAGE = "de" as const;

export const HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE = [
  {
    sourceKind: "discussion_comment",
    sourceRecordId: "ff0345b3-47ba-43f8-8d46-2e8368ada089",
    sourceVersion: "v-40261791a2c14050",
    sourceBody: "Test",
    targetLanguage: HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE_TARGET_LANGUAGE,
    translatedBody: "Test",
  },
  {
    sourceKind: "discussion_comment",
    sourceRecordId: "3054799b-3b9b-4d59-ac17-638ae7fbf117",
    sourceVersion: "v-42b3253b643dddbe",
    sourceBody: "test",
    targetLanguage: HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE_TARGET_LANGUAGE,
    translatedBody: "test",
  },
] as const satisfies readonly HumanConfirmedTranslationTarget[];
