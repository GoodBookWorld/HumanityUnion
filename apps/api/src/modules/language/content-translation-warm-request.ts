/**
 * Pack 02G — ContentTranslationWarmRequested source-level command builder.
 *
 * Distinct from TranslationPublished / TranslationCorrected (result events).
 * Outbox enqueue lives in content-translation-warm-enqueue.ts (Task 04).
 */

import type {
  ContentTranslationSourceKind,
  ContentTranslationWarmReason,
  ContentTranslationWarmRequestedCommand,
} from "@hu/types";
import { CONTENT_TRANSLATION_WARM_REQUESTED } from "@hu/types";

/**
 * Build the durable warm-request command payload (source identity only).
 * Does not publish to outbox.
 */
export function buildContentTranslationWarmRequestedCommand(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly reason?: ContentTranslationWarmReason;
  readonly requestedAt?: string;
}): ContentTranslationWarmRequestedCommand {
  const sourceRecordId = input.sourceRecordId.trim();
  if (!sourceRecordId) {
    throw new Error("sourceRecordId is required for ContentTranslationWarmRequested.");
  }
  return {
    commandName: CONTENT_TRANSLATION_WARM_REQUESTED,
    sourceKind: input.sourceKind,
    sourceRecordId,
    requestedAt: input.requestedAt ?? new Date().toISOString(),
    reason: input.reason ?? "public_mutation",
  };
}

/** Catalogue result event names — must not be reused as warm-request commands. */
export const CONTENT_TRANSLATION_RESULT_EVENT_NAMES = [
  "TranslationPublished",
  "TranslationCorrected",
] as const;

export function isContentTranslationResultEventName(value: string): boolean {
  return (CONTENT_TRANSLATION_RESULT_EVENT_NAMES as readonly string[]).includes(value);
}

export function isContentTranslationWarmRequestCommandName(value: string): boolean {
  return value === CONTENT_TRANSLATION_WARM_REQUESTED;
}
