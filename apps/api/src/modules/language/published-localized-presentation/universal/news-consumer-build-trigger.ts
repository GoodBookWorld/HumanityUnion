/**
 * RESET 04 / 05C / 05C.1 / 05D / 05E.1 — dynamic RSS / consumer-visible News build trigger.
 *
 * Final Localization Closure 02 — public_news is original-language-only.
 * Enqueue entry points remain for call-site compatibility but accept no work
 * and never call the provider.
 */

import { recordPlpAutoBuildCollectionEnqueueAttempt } from "./plp-auto-build-runtime.js";
import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

/**
 * After RSS ingest / consumer-visible refresh.
 * Original-language-only policy: no PLP auto-build enqueue for public_news.
 */
export async function enqueueConsumerVisibleNewsPlpBuilds(input: {
  readonly locales: readonly string[];
  readonly limit?: number;
}): Promise<{
  readonly consumerCount: number;
  readonly enqueued: number;
  readonly skippedUsable: number;
  readonly deduped: number;
  readonly PROVIDER_CALLS: 0;
}> {
  void input;
  ensureMediaPlpAdapterRegistered();
  recordPlpAutoBuildCollectionEnqueueAttempt();
  return {
    consumerCount: 0,
    enqueued: 0,
    skippedUsable: 0,
    deduped: 0,
    PROVIDER_CALLS: 0,
  };
}

/**
 * Single-article dynamic refresh (post-upsert).
 * Original-language-only policy: no PLP auto-build enqueue for public_news.
 */
export async function enqueuePublicNewsArticlePlpBuild(input: {
  readonly articleId: string;
  readonly canonicalVersion: string;
  readonly locales: readonly string[];
}): Promise<number> {
  void input;
  ensureMediaPlpAdapterRegistered();
  return 0;
}
