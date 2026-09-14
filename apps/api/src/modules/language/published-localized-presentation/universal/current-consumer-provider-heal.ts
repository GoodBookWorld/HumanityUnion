/**
 * RESET 05E / 05E.1 — bounded heal for current Editorial provider-response
 * failures (including legacy pre-05E shapes).
 *
 * Reset 01 — News title/summary builds are owned by
 * enqueueConsumerVisibleNewsPlpBuilds (MEDIA_PLP_CAROUSEL_NEWS_LIMIT after RSS
 * refresh), not this heal path. newsEnqueued stays 0 here.
 */

import { enqueueCivicMediaEditorialPlpBuilds } from "./editorial-build-trigger.js";
import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

export async function healCurrentConsumerProviderFailures(input: {
  readonly locales: readonly string[];
}): Promise<{
  readonly editorialEnqueued: number;
  readonly newsEnqueued: number;
  readonly newsSkippedNotProviderClass: number;
  readonly newsSkippedAlreadyRecovered: number;
  readonly newsSkippedUsable: number;
  readonly newsSkippedVersionMismatch: number;
  readonly PROVIDER_CALLS: 0;
}> {
  ensureMediaPlpAdapterRegistered();
  const editorial = await enqueueCivicMediaEditorialPlpBuilds({
    locales: input.locales,
  });

  return {
    editorialEnqueued: editorial.enqueued,
    newsEnqueued: 0,
    newsSkippedNotProviderClass: 0,
    newsSkippedAlreadyRecovered: 0,
    newsSkippedUsable: 0,
    newsSkippedVersionMismatch: 0,
    PROVIDER_CALLS: 0,
  };
}
