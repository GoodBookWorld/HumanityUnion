/**
 * Step 06C.1 — Admin searchEnabled → durable Initiative Search discovery enqueue.
 *
 * Fire-and-forget outbox only. Never invokes the translation provider in-process.
 * Scope: searchable Initiatives (lifecyclePhase !== draft), one locale per schedule.
 */

import type { ContentTranslationWarmReason, LanguageCode } from "@hu/types";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { listInitiatives } from "../initiatives/initiative.store.js";
import { logger } from "../../shared/observability/logger.js";
import { enqueueContentTranslationWarmRequested } from "./content-translation-warm-enqueue.js";

export function listSearchableInitiativeIdsForDiscovery(): readonly string[] {
  return listInitiatives()
    .filter((initiative) => initiative.lifecyclePhase !== "draft")
    .map((initiative) => initiative.initiativeId);
}

export async function enqueueInitiativeSearchDiscoveryForLocale(input: {
  readonly targetLanguage: LanguageCode;
  readonly reason?: ContentTranslationWarmReason;
}): Promise<{
  readonly attempted: number;
  readonly enqueued: number;
  readonly deduped: number;
}> {
  const localeKey = normalizeLanguageRegistryLocaleKey(input.targetLanguage);
  if (
    !localeKey ||
    localeKey === normalizeLanguageRegistryLocaleKey(DEFAULT_PLATFORM_LANGUAGE)
  ) {
    return { attempted: 0, enqueued: 0, deduped: 0 };
  }

  const ids = listSearchableInitiativeIdsForDiscovery();
  let enqueued = 0;
  let deduped = 0;

  for (const sourceRecordId of ids) {
    const result = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId,
      reason: input.reason ?? "search_discovery_enable",
      targetLocales: [input.targetLanguage],
    });
    if (result.enqueued) {
      enqueued += 1;
    } else if (result.deduped) {
      deduped += 1;
    }
  }

  logger.info("content_translation.search_discovery.enqueued_batch", {
    component: "content-translation-search-discovery",
    targetLanguage: input.targetLanguage,
    reason: input.reason ?? "search_discovery_enable",
    attempted: ids.length,
    enqueued,
    deduped,
  });

  return { attempted: ids.length, enqueued, deduped };
}

/**
 * Schedule discovery after Admin searchEnabled false→true.
 * Does not await provider work; outbox writes run in the background.
 */
export function scheduleInitiativeSearchDiscoveryAfterSearchEnabled(input: {
  readonly targetLanguage: LanguageCode;
}): void {
  void enqueueInitiativeSearchDiscoveryForLocale({
    targetLanguage: input.targetLanguage,
    reason: "search_discovery_enable",
  }).catch((error) => {
    logger.warn("content_translation.search_discovery.enqueue_failed", {
      component: "content-translation-search-discovery",
      targetLanguage: input.targetLanguage,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
