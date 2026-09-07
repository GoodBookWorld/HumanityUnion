/**
 * RESET 04 — publication trigger helpers → build enqueue.
 */

import type { PlpPublicationTrigger, PlpPublicationTriggerKind } from "@hu/types";

import { enqueuePlpBuildRequest } from "./build-request-queue.js";

export function createPlpPublicationTrigger(input: {
  readonly kind: PlpPublicationTriggerKind;
  readonly entityType: string;
  readonly entityId: string;
  readonly locale?: string;
  readonly canonicalVersion?: string;
  readonly contentRevision?: number;
  readonly reason?: string;
}): PlpPublicationTrigger {
  return {
    kind: input.kind,
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    canonicalVersion: input.canonicalVersion,
    contentRevision: input.contentRevision,
    reason: input.reason,
    requestedAt: new Date().toISOString(),
  };
}

/**
 * Enqueue build for one entity×locale when locale + version are known.
 * Safe no-op when locale omitted (caller expands Registry locales).
 * Kick is durable-write-only (does not await provider).
 */
export function dispatchPlpPublicationTrigger(input: {
  readonly trigger: PlpPublicationTrigger;
  readonly locales: readonly string[];
}): number {
  if (!input.trigger.canonicalVersion) {
    return 0;
  }
  let enqueued = 0;
  const locales =
    input.trigger.locale != null && input.trigger.locale.trim()
      ? [input.trigger.locale]
      : input.locales;
  for (const locale of locales) {
    if (String(locale).toLowerCase() === "en") {
      continue;
    }
    void enqueuePlpBuildRequest({
      entityType: input.trigger.entityType,
      entityId: input.trigger.entityId,
      locale,
      canonicalVersion: input.trigger.canonicalVersion,
      contentRevision: input.trigger.contentRevision ?? 1,
      trigger: input.trigger.kind,
    });
    enqueued += 1;
  }
  return enqueued;
}

export const PLP_PUBLICATION_TRIGGER_KINDS: readonly PlpPublicationTriggerKind[] = [
  "CANONICAL_ENTITY_PUBLISHED",
  "CANONICAL_CONTENT_UPDATED",
  "REGISTRY_LOCALE_ENABLED",
  "MANUAL_OR_AUTHOR_LOCALIZATION_UPDATED",
  "TERMINOLOGY_OR_CONTROLLED_VOCAB_CHANGED",
  "ADMIN_REBUILD",
  "DYNAMIC_SOURCE_REFRESH",
  "CONSUMER_VISIBLE_COLLECTION_REFRESH",
];
