/**
 * Step 06C.1 / 06C.2B — Admin searchEnabled → durable Search discovery enqueue.
 *
 * Fire-and-forget outbox only. Never invokes the translation provider in-process.
 * Scope: searchable/public records for discovery-mapped CT kinds (no civic_media).
 */

import type { ContentTranslationWarmReason, LanguageCode } from "@hu/types";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { logger } from "../../shared/observability/logger.js";
import { enqueueContentTranslationWarmRequested } from "./content-translation-warm-enqueue.js";
import {
  assertCivicMediaExcludedFromSearchDiscoveryWarm,
  listSearchDiscoveryWarmTargets,
  type SearchDiscoveryWarmTarget,
} from "./content-translation-search-discovery-enumerate.js";

/** @deprecated Prefer listSearchDiscoveryWarmTargets — kept for Initiative-focused call sites/tests. */
export function listSearchableInitiativeIdsForDiscovery(): readonly string[] {
  // Sync path for Initiative-only callers; full multi-kind list is async.
  const { listInitiatives } = require("../initiatives/initiative.store.js") as {
    listInitiatives: () => Array<{ initiativeId: string; lifecyclePhase: string }>;
  };
  return listInitiatives()
    .filter((initiative) => initiative.lifecyclePhase !== "draft")
    .map((initiative) => initiative.initiativeId);
}

export async function enqueueSearchDiscoveryForLocale(input: {
  readonly targetLanguage: LanguageCode;
  readonly reason?: ContentTranslationWarmReason;
  /** Optional override for tests — defaults to live enumeration. */
  readonly targets?: readonly SearchDiscoveryWarmTarget[];
}): Promise<{
  readonly attempted: number;
  readonly enqueued: number;
  readonly deduped: number;
  readonly byKind: Readonly<Record<string, number>>;
}> {
  const localeKey = normalizeLanguageRegistryLocaleKey(input.targetLanguage);
  if (
    !localeKey ||
    localeKey === normalizeLanguageRegistryLocaleKey(DEFAULT_PLATFORM_LANGUAGE)
  ) {
    return { attempted: 0, enqueued: 0, deduped: 0, byKind: {} };
  }

  const targets = input.targets ?? (await listSearchDiscoveryWarmTargets());
  assertCivicMediaExcludedFromSearchDiscoveryWarm(targets);

  let enqueued = 0;
  let deduped = 0;
  const byKind: Record<string, number> = {};

  for (const target of targets) {
    byKind[target.sourceKind] = (byKind[target.sourceKind] ?? 0) + 1;
    const result = await enqueueContentTranslationWarmRequested({
      sourceKind: target.sourceKind,
      sourceRecordId: target.sourceRecordId,
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
    attempted: targets.length,
    enqueued,
    deduped,
    byKind,
  });

  return { attempted: targets.length, enqueued, deduped, byKind };
}

/** Backward-compatible alias — Initiative-era name now fans out all mapped kinds. */
export async function enqueueInitiativeSearchDiscoveryForLocale(input: {
  readonly targetLanguage: LanguageCode;
  readonly reason?: ContentTranslationWarmReason;
}): Promise<{
  readonly attempted: number;
  readonly enqueued: number;
  readonly deduped: number;
}> {
  const result = await enqueueSearchDiscoveryForLocale(input);
  return {
    attempted: result.attempted,
    enqueued: result.enqueued,
    deduped: result.deduped,
  };
}

/**
 * Schedule discovery after Admin searchEnabled false→true.
 * Does not await provider work; outbox writes run in the background.
 */
export function scheduleSearchDiscoveryAfterSearchEnabled(input: {
  readonly targetLanguage: LanguageCode;
}): void {
  void enqueueSearchDiscoveryForLocale({
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

/** @deprecated Prefer scheduleSearchDiscoveryAfterSearchEnabled. */
export function scheduleInitiativeSearchDiscoveryAfterSearchEnabled(input: {
  readonly targetLanguage: LanguageCode;
}): void {
  scheduleSearchDiscoveryAfterSearchEnabled(input);
}
