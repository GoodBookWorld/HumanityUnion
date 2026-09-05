/**
 * Reset 03 — Media PLP read path (provider/worker-free).
 * Coherent PUBLISHED_LOCALIZED or CANONICAL_FALLBACK — never mixed fields.
 */

import type {
  PublicPresentationNode,
  ResolvePublishedPresentationResult,
  PublishedLocalizedPresentationSeo,
} from "@hu/types";

import { resolvePublishedPresentation } from "../resolve-published-presentation.js";
import { isMediaPlpEntityConsumptionEnabled } from "./feature-flag.js";
import { markMediaPlpRead } from "./instrumentation.js";

export type ResolveMediaPlpPresentationInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly liveCanonicalVersion: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly canonicalSeo?: PublishedLocalizedPresentationSeo;
};

/**
 * Resolve one Media entity presentation.
 * When Media PLP flag is OFF, returns CANONICAL_FALLBACK with reason
 * MEDIA_PLP_DISABLED (callers should use legacy path instead of this API).
 */
export async function resolveMediaPlpPresentation(
  input: ResolveMediaPlpPresentationInput,
): Promise<ResolvePublishedPresentationResult> {
  if (!isMediaPlpEntityConsumptionEnabled(input.entityType)) {
    return {
      mode: "CANONICAL_FALLBACK",
      presentation: input.canonicalPresentation,
      seo: input.canonicalSeo,
      reasonCode: "MEDIA_PLP_DISABLED",
    };
  }

  markMediaPlpRead();
  return resolvePublishedPresentation({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    liveCanonicalVersion: input.liveCanonicalVersion,
    canonicalPresentation: input.canonicalPresentation,
    canonicalSeo: input.canonicalSeo,
  });
}
