import type { CommunitySimilarityProvider } from "./community-similarity-provider.js";
import { DeterministicCommunitySimilarityProvider } from "./deterministic-community-similarity-provider.js";

let cached: CommunitySimilarityProvider | null = null;

/**
 * Pack 01 always resolves the deterministic provider.
 * Future semantic providers may be selected here without changing callers.
 */
export function resolveCommunitySimilarityProvider(): CommunitySimilarityProvider {
  if (!cached) {
    cached = new DeterministicCommunitySimilarityProvider();
  }

  return cached;
}

/** Test helper — reset provider cache between suites when needed. */
export function resetCommunitySimilarityProviderForTests(): void {
  cached = null;
}
