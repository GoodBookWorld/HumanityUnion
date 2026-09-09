/**
 * Pack 08K / RESET 04 — schedule bounded content-translation warm AND PLP build
 * enqueue after public presentation mutations. Fire-and-forget; never awaits Gemini.
 */

import type {
  ContentTranslationSourceKind,
  ContentTranslationWarmReason,
} from "@hu/types";

import { isSupportedContentTranslationSourceKind } from "./content-translation-eligibility.js";
import { scheduleContentTranslationWarmAfterMutation } from "./content-translation-warm-enqueue.js";
import { notifyPlpPublicSourceMutation } from "./published-localized-presentation/universal/public-source-mutation-bridge.js";

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
  /** Optional fingerprint when caller already has canonical version (News). */
  canonicalVersion?: string;
}): void {
  if (!isSupportedContentTranslationSourceKind(input.sourceKind)) {
    return;
  }
  // Final Localization Closure 02 — RSS/public_news is original-language-only.
  // Never schedule CT warm (no Gemini quota). PLP mutation bridge remains a no-op enqueue.
  if (input.sourceKind !== "public_news") {
    scheduleContentTranslationWarmAfterMutation({
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      reason: asWarmReason(input.reason),
    });
  }
  notifyPlpPublicSourceMutation({
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    canonicalVersion: input.canonicalVersion,
  });
}
