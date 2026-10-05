/**
 * RSS /media news trigger.
 *
 * STEP 15D.14.F.2 — public_news title and summary are SOURCE_ORIGINAL.
 * Refresh must not enqueue machine translation. Card chrome stays WEB_UI.
 */

import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

/**
 * After RSS ingest: do not schedule public_news provider work.
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
  return {
    consumerCount: 0,
    enqueued: 0,
    skippedUsable: 0,
    deduped: 0,
    PROVIDER_CALLS: 0,
  };
}

/**
 * Single-article path — intentionally a no-op.
 * Arbitrary RSS publication must not locale-fan-out; only the bounded
 * carousel collection trigger may enqueue public_news PLP work.
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
