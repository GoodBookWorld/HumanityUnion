/**
 * Thin stale-revision check for PLP builds.
 *
 * Kept out of build-request-queue.ts so materializers / build-pipeline do not
 * statically import the durable queue → language-registry barrel → global-search
 * graph (Render Starter 512 MB OOM).
 */

export function isPlpBuildStaleAgainstLive(input: {
  readonly buildTargetCanonicalVersion: string;
  readonly liveCanonicalVersion: string;
}): boolean {
  return input.buildTargetCanonicalVersion !== input.liveCanonicalVersion;
}
