/**
 * Reset 03 / RESET 04 — Media canonical publication → LocalizationBuildRequested.
 *
 * RESET 04 activates enqueue into the universal coalesce queue (no Gemini).
 * Provider execution remains opt-in via setPlpBuildRequestProcessor.
 */

import type { PlpPublicationTriggerKind } from "@hu/types";

import { enqueuePlpBuildRequest } from "../universal/build-request-queue.js";
import { ensureMediaPlpAdapterRegistered } from "../universal/register-defaults.js";

export type MediaCanonicalLocalizationBuildHookInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly locales?: readonly string[];
  readonly trigger?: PlpPublicationTriggerKind;
};

/** Queue accepts work; provider execution is still dormant until a processor is set. */
export const MEDIA_LOCALIZATION_BUILD_HOOK_STATUS = "QUEUE_ACTIVE_PROVIDER_DORMANT" as const;

/**
 * Enqueue localization build requests for non-English Registry locales.
 * Does not call Gemini / materializer.
 */
export function notifyMediaCanonicalPublishedForLocalizationBuild(
  input: MediaCanonicalLocalizationBuildHookInput,
): number {
  ensureMediaPlpAdapterRegistered();
  const locales = input.locales ?? [];
  if (locales.length === 0) {
    // No locales supplied — nothing to enqueue (caller must pass Registry locales).
    void MEDIA_LOCALIZATION_BUILD_HOOK_STATUS;
    return 0;
  }
  let n = 0;
  for (const locale of locales) {
    if (String(locale).toLowerCase() === "en") {
      continue;
    }
    enqueuePlpBuildRequest({
      entityType: input.entityType,
      entityId: input.entityId,
      locale,
      canonicalVersion: input.canonicalVersion,
      contentRevision: input.contentRevision,
      trigger: input.trigger ?? "CANONICAL_ENTITY_PUBLISHED",
    });
    n += 1;
  }
  return n;
}
