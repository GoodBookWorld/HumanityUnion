/**
 * Reset 03C — SSR seed helper for Media PLP (resolve published or canonical fallback).
 * When flag OFF, returns null so callers keep legacy path.
 * Never generate-on-miss; never mix fields; API fingerprints match materializer.
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
import {
  resolveMediaPlpBatch,
  toMediaPlpResolvedPresentation,
} from "./media-plp-api";
import type { MediaPlpResolvedPresentation } from "./presentation";

export function buildCanonicalTrustedPresentationNode(
  resource: TrustedMediaResource,
): PublicPresentationNode {
  return {
    name: protectedIdentity(resource.name),
    websiteUrl: protectedTechnical(resource.websiteUrl),
    explanation: resource.explanation,
  };
}

export function buildCanonicalPrinciplePresentationNode(
  principle: CivicMediaSelectionPrinciple,
): PublicPresentationNode {
  return {
    title: principle.title,
    description: principle.description,
  };
}

function coherentFallback(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly presentation: PublicPresentationNode;
  readonly canonicalVersion?: string;
}): MediaPlpResolvedPresentation {
  return {
    mode: "CANONICAL_FALLBACK",
    presentation: input.presentation,
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    canonicalVersion: input.canonicalVersion ?? "canonical",
  };
}

/**
 * Resolve trusted presentations for SSR when PLP is enabled.
 * Uses API consumer resolve (API fingerprints). Optional injected resolve for tests.
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

  if (input.resolve) {
    const out: Record<string, MediaPlpResolvedPresentation> = {};
    for (const resource of input.resources) {
      const entityId = mediaPlpTrustedEntityId(resource.id);
      const canonical = buildCanonicalTrustedPresentationNode(resource);
      out[resource.id] = await input.resolve({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId,
        locale: input.locale,
        liveCanonicalVersion: "injected",
        canonicalPresentation: canonical,
      });
    }
    return out;
  }

  const items = input.resources.map((resource) => ({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
    entityId: mediaPlpTrustedEntityId(resource.id),
    canonicalPresentation: buildCanonicalTrustedPresentationNode(resource),
    resourceId: resource.id,
  }));

  try {
    const results = await resolveMediaPlpBatch({
      locale: input.locale,
      items: items.map(({ entityType, entityId, canonicalPresentation }) => ({
        entityType,
        entityId,
        canonicalPresentation,
      })),
    });
    const byEntityId = new Map(results.map((row) => [row.entityId, row]));
    const out: Record<string, MediaPlpResolvedPresentation> = {};
    for (const item of items) {
      const hit = byEntityId.get(item.entityId);
      out[item.resourceId] = hit
        ? toMediaPlpResolvedPresentation(hit)
        : coherentFallback({
            entityType: item.entityType,
            entityId: item.entityId,
            locale: input.locale,
            presentation: item.canonicalPresentation,
          });
    }
    return out;
  } catch {
    const out: Record<string, MediaPlpResolvedPresentation> = {};
    for (const item of items) {
      out[item.resourceId] = coherentFallback({
        entityType: item.entityType,
        entityId: item.entityId,
        locale: input.locale,
        presentation: item.canonicalPresentation,
      });
    }
    return out;
  }
}

export async function loadMediaPlpPrinciplePresentations(input: {
  readonly principles: readonly CivicMediaSelectionPrinciple[];
  readonly locale: string;
  readonly resolve?: (args: {
    entityType: string;
    entityId: string;
    locale: string;
    canonicalPresentation: PublicPresentationNode;
  }) => Promise<MediaPlpResolvedPresentation>;
}): Promise<Readonly<Record<string, MediaPlpResolvedPresentation>> | null> {
  if (!isMediaPlpWebEnabled()) {
    return null;
  }

  if (input.resolve) {
    const out: Record<string, MediaPlpResolvedPresentation> = {};
    for (const principle of input.principles) {
      const entityId = mediaPlpPrincipleEntityId(principle.id);
      const canonical = buildCanonicalPrinciplePresentationNode(principle);
      out[principle.id] = await input.resolve({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId,
        locale: input.locale,
        canonicalPresentation: canonical,
      });
    }
    return out;
  }

  const items = input.principles.map((principle) => ({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
    entityId: mediaPlpPrincipleEntityId(principle.id),
    canonicalPresentation: buildCanonicalPrinciplePresentationNode(principle),
    principleId: principle.id,
  }));

  try {
    const results = await resolveMediaPlpBatch({
      locale: input.locale,
      items: items.map(({ entityType, entityId, canonicalPresentation }) => ({
        entityType,
        entityId,
        canonicalPresentation,
      })),
    });
    const byEntityId = new Map(results.map((row) => [row.entityId, row]));
    const out: Record<string, MediaPlpResolvedPresentation> = {};
    for (const item of items) {
      const hit = byEntityId.get(item.entityId);
      out[item.principleId] = hit
        ? toMediaPlpResolvedPresentation(hit)
        : coherentFallback({
            entityType: item.entityType,
            entityId: item.entityId,
            locale: input.locale,
            presentation: item.canonicalPresentation,
          });
    }
    return out;
  } catch {
    const out: Record<string, MediaPlpResolvedPresentation> = {};
    for (const item of items) {
      out[item.principleId] = coherentFallback({
        entityType: item.entityType,
        entityId: item.entityId,
        locale: input.locale,
        presentation: item.canonicalPresentation,
      });
    }
    return out;
  }
}
