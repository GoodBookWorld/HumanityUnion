/**
 * RESET 05C — client read-only Media PLP batch for country public-news rail.
 * Same identity as /media: entityType=public_news, entityId=article.id.
 * Never calls provider; resolve endpoint only.
 */

"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE, mediaPlpPublicNewsEntityId } from "@hu/types";

import {
  resolveMediaPlpBatch,
  toMediaPlpResolvedPresentation,
} from "../language/media-plp/media-plp-api";
import {
  attachMediaPlpBatchByIdentity,
  indexMediaPlpBatchResultsByIdentity,
} from "../language/media-plp/media-plp-batch-identity-join";
import { buildCanonicalPublicNewsPresentationNode } from "../language/media-plp/load-media-plp-ssr";
import { isMediaPlpWebEnabled } from "../language/media-plp/feature-flag";
import type { MediaPlpResolvedPresentation } from "../language/media-plp/presentation";

export async function fetchCountryPublicNewsPlpById(input: {
  readonly articles: readonly PublicNewsArticleItem[];
  readonly locale: string;
}): Promise<Readonly<Record<string, MediaPlpResolvedPresentation>>> {
  if (!isMediaPlpWebEnabled() || input.articles.length === 0) {
    return {};
  }

  const items = input.articles.map((article) => ({
    entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    entityId: mediaPlpPublicNewsEntityId(article.id),
    canonicalPresentation: buildCanonicalPublicNewsPresentationNode(article),
    key: article.id,
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
    const byEntityKey = indexMediaPlpBatchResultsByIdentity(results);
    return attachMediaPlpBatchByIdentity({
      items,
      byEntityKey,
      mapHit: (hit) => toMediaPlpResolvedPresentation(hit),
      fallback: (item) => ({
        mode: "CANONICAL_FALLBACK" as const,
        presentation: item.canonicalPresentation,
        entityType: item.entityType,
        entityId: item.entityId,
        locale: input.locale,
        canonicalVersion: "",
        reasonCode: "BATCH_MISSING",
      }),
    });
  } catch {
    const out: Record<string, MediaPlpResolvedPresentation> = {};
    for (const item of items) {
      out[item.key] = {
        mode: "CANONICAL_FALLBACK",
        presentation: item.canonicalPresentation,
        entityType: item.entityType,
        entityId: item.entityId,
        locale: input.locale,
        canonicalVersion: "",
        reasonCode: "RESOLVE_FAILED",
      };
    }
    return out;
  }
}
