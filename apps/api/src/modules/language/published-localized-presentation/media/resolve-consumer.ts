/**
 * Reset 03C — batch/single Media PLP consumer resolve (read-only).
 * Fingerprints canonical trees with the API algorithm so web SSR matches
 * materializer-published snapshots (no web FNV fingerprint).
 */

import type { PublicPresentationNode } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPES } from "@hu/types";

import { fingerprintMediaPlpCanonicalVersion } from "./canonical-trees.js";
import { resolveMediaPlpPresentation } from "./resolve-media-presentation.js";

export const MEDIA_PLP_CONSUMER_RESOLVE_MAX_ITEMS = 64;

export type MediaPlpConsumerResolveItemInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalPresentation: PublicPresentationNode;
};

export type MediaPlpConsumerResolveItemResult = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  readonly presentation: PublicPresentationNode;
  readonly canonicalVersion: string;
  readonly reasonCode?: string;
  readonly snapshotId?: string;
};

export async function resolveMediaPlpConsumerItem(input: {
  readonly locale: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalPresentation: PublicPresentationNode;
}): Promise<MediaPlpConsumerResolveItemResult> {
  const liveCanonicalVersion = fingerprintMediaPlpCanonicalVersion(
    input.canonicalPresentation,
  );
  const resolved = await resolveMediaPlpPresentation({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    liveCanonicalVersion,
    canonicalPresentation: input.canonicalPresentation,
  });

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    mode: resolved.mode,
    presentation: resolved.presentation,
    canonicalVersion: liveCanonicalVersion,
    ...(resolved.reasonCode ? { reasonCode: resolved.reasonCode } : {}),
    ...(resolved.snapshotId ? { snapshotId: resolved.snapshotId } : {}),
  };
}

export async function resolveMediaPlpConsumerBatch(input: {
  readonly locale: string;
  readonly items: readonly MediaPlpConsumerResolveItemInput[];
}): Promise<{
  readonly ok: true;
  readonly results: readonly MediaPlpConsumerResolveItemResult[];
} | {
  readonly ok: false;
  readonly error: string;
}> {
  if (input.items.length === 0) {
    return { ok: true, results: [] };
  }
  if (input.items.length > MEDIA_PLP_CONSUMER_RESOLVE_MAX_ITEMS) {
    return {
      ok: false,
      error: `Batch exceeds MEDIA_PLP_CONSUMER_RESOLVE_MAX_ITEMS=${MEDIA_PLP_CONSUMER_RESOLVE_MAX_ITEMS}`,
    };
  }

  for (const item of input.items) {
    if (!(MEDIA_PLP_ENTITY_TYPES as readonly string[]).includes(item.entityType)) {
      return { ok: false, error: `Unsupported Media PLP entityType=${item.entityType}` };
    }
    if (!item.entityId.trim()) {
      return { ok: false, error: "entityId required" };
    }
  }

  const results = await Promise.all(
    input.items.map((item) =>
      resolveMediaPlpConsumerItem({
        locale: input.locale,
        entityType: item.entityType,
        entityId: item.entityId,
        canonicalPresentation: item.canonicalPresentation,
      }),
    ),
  );

  return { ok: true, results };
}
