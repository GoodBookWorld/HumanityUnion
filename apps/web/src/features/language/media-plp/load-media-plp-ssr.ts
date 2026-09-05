/**
 * Reset 03 — SSR seed helper for Media PLP (GET-only resolve; no generate).
 * When flag OFF, returns null so callers keep legacy path.
 */

import type {
  CivicMediaSelectionPrinciple,
  PublicPresentationNode,
  TrustedMediaResource,
} from "@hu/types";
import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPrincipleEntityId,
  mediaPlpTrustedEntityId,
  protectedIdentity,
  protectedTechnical,
} from "@hu/types";

import { isMediaPlpWebEnabled } from "./feature-flag";
import type { MediaPlpResolvedPresentation } from "./presentation";

function buildCanonicalTrusted(resource: TrustedMediaResource): PublicPresentationNode {
  return {
    name: protectedIdentity(resource.name),
    websiteUrl: protectedTechnical(resource.websiteUrl),
    explanation: resource.explanation,
  };
}

function buildCanonicalPrinciple(
  principle: CivicMediaSelectionPrinciple,
): PublicPresentationNode {
  return {
    title: principle.title,
    description: principle.description,
  };
}

/**
 * Resolve trusted presentations for SSR when PLP is enabled.
 * Uses optional injected resolver (API) — default coherent canonical fallback
 * until snapshots exist (still coherent; never mixed; never generate-on-miss).
 */
export async function loadMediaPlpTrustedPresentations(input: {
  readonly resources: readonly TrustedMediaResource[];
  readonly locale: string;
  readonly resolve?: (args: {
    entityType: string;
    entityId: string;
    locale: string;
    liveCanonicalVersion: string;
    canonicalPresentation: PublicPresentationNode;
  }) => Promise<MediaPlpResolvedPresentation>;
}): Promise<Readonly<Record<string, MediaPlpResolvedPresentation>> | null> {
  if (!isMediaPlpWebEnabled()) {
    return null;
  }

  const out: Record<string, MediaPlpResolvedPresentation> = {};
  for (const resource of input.resources) {
    const entityId = mediaPlpTrustedEntityId(resource.id);
    const canonical = buildCanonicalTrusted(resource);
    const liveCanonicalVersion = `v-${resource.id}-${resource.explanation.length}`;
    if (input.resolve) {
      out[resource.id] = await input.resolve({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId,
        locale: input.locale,
        liveCanonicalVersion,
        canonicalPresentation: canonical,
      });
    } else {
      out[resource.id] = {
        mode: "CANONICAL_FALLBACK",
        presentation: canonical,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId,
        locale: input.locale,
        canonicalVersion: liveCanonicalVersion,
      };
    }
  }
  return out;
}

export async function loadMediaPlpPrinciplePresentations(input: {
  readonly principles: readonly CivicMediaSelectionPrinciple[];
  readonly locale: string;
}): Promise<Readonly<Record<string, MediaPlpResolvedPresentation>> | null> {
  if (!isMediaPlpWebEnabled()) {
    return null;
  }
  const out: Record<string, MediaPlpResolvedPresentation> = {};
  for (const principle of input.principles) {
    const entityId = mediaPlpPrincipleEntityId(principle.id);
    const canonical = buildCanonicalPrinciple(principle);
    out[principle.id] = {
      mode: "CANONICAL_FALLBACK",
      presentation: canonical,
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId,
      locale: input.locale,
      canonicalVersion: `v-${principle.id}`,
    };
  }
  return out;
}
