/**
 * Pack 08K — schedule bounded content-translation warm after public presentation
 * mutations. Fire-and-forget; never awaits Gemini.
 */

import type {
  ContentTranslationSourceKind,
  ContentTranslationWarmReason,
} from "@hu/types";

import { isSupportedContentTranslationSourceKind } from "./content-translation-eligibility.js";
import { scheduleContentTranslationWarmAfterMutation } from "./content-translation-warm-enqueue.js";

const WARM_REASONS = new Set<ContentTranslationWarmReason>([
  "public_mutation",
  "public_update",
  "operator_manual",
  "operator_backfill",
]);

function asWarmReason(reason: string | undefined): ContentTranslationWarmReason | undefined {
  if (reason && WARM_REASONS.has(reason as ContentTranslationWarmReason)) {
    return reason as ContentTranslationWarmReason;
  }
  return undefined;
}

export function notifyPublicPresentationChanged(input: {
  sourceKind: ContentTranslationSourceKind | string;
  sourceRecordId: string;
  reason?: string;
}): void {
  if (!isSupportedContentTranslationSourceKind(input.sourceKind)) {
    return;
  }
  scheduleContentTranslationWarmAfterMutation({
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    reason: asWarmReason(input.reason),
  });
}
