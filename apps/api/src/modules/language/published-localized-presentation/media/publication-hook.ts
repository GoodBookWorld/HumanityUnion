/**
 * Reset 03 / RESET 04 / RESET 05C — Media canonical publication → LocalizationBuildRequested.
 *
 * RESET 04 activates enqueue into the universal coalesce queue (no Gemini).
 * RESET 05C wires the production processor; status flips to ACTIVE when registered.
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

/** Historical RESET 04 string — queue accepts work; provider was dormant. */
export const QUEUE_ACTIVE_PROVIDER_DORMANT = "QUEUE_ACTIVE_PROVIDER_DORMANT" as const;

/** RESET 05C — production processor registered and draining. */
export const QUEUE_ACTIVE_PROVIDER_ACTIVE = "QUEUE_ACTIVE_PROVIDER_ACTIVE" as const;

export type MediaLocalizationBuildHookStatus =
  | typeof QUEUE_ACTIVE_PROVIDER_DORMANT
  | typeof QUEUE_ACTIVE_PROVIDER_ACTIVE;

/**
 * Static historical constant (RESET 04 tests assert this string).
 * Runtime status: getMediaLocalizationBuildHookStatus().
 */
export const MEDIA_LOCALIZATION_BUILD_HOOK_STATUS =
  QUEUE_ACTIVE_PROVIDER_DORMANT;

let runtimeHookStatus: MediaLocalizationBuildHookStatus =
  QUEUE_ACTIVE_PROVIDER_DORMANT;

export function getMediaLocalizationBuildHookStatus(): MediaLocalizationBuildHookStatus {
  return runtimeHookStatus;
}

export function setMediaLocalizationBuildHookStatus(
  status: MediaLocalizationBuildHookStatus,
): void {
  runtimeHookStatus = status;
}

export function resetMediaLocalizationBuildHookStatusForTests(): void {
  runtimeHookStatus = QUEUE_ACTIVE_PROVIDER_DORMANT;
}

/**
 * Enqueue localization build requests for non-English Registry locales.
 * Does not call Gemini / materializer. Kick is durable-write-only.
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
    void enqueuePlpBuildRequest({
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
