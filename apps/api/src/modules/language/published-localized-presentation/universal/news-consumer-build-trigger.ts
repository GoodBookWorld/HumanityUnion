/**
 * RESET 04 — dynamic RSS / consumer-visible News build trigger.
 *
 * Uses the SAME selection authority as /media SSR (selectMediaPlpConsumerNewsIds).
 * Enqueues PLP build work; does not call Gemini.
 */

import { MEDIA_PLP_ENTITY_TYPE, mediaPlpPublicNewsEntityId } from "@hu/types";

import { selectMediaPlpConsumerNewsArticles } from "../../media-plp-carousel/media-plp-news-selection.js";
import {
  fingerprintMediaPlpCanonicalVersion,
  buildCanonicalPublicNewsPresentation,
  asMediaPlpPresentationNode,
} from "../media/canonical-trees.js";
import { enqueuePlpBuildRequest } from "./build-request-queue.js";
import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

/**
 * After RSS ingest / consumer-visible refresh: enqueue missing/stale news
 * localization for eligible Registry locales (caller supplies locales).
 */
export async function enqueueConsumerVisibleNewsPlpBuilds(input: {
  readonly locales: readonly string[];
  readonly limit?: number;
}): Promise<{
  readonly consumerCount: number;
  readonly enqueued: number;
  readonly PROVIDER_CALLS: 0;
}> {
  ensureMediaPlpAdapterRegistered();
  const articles = await selectMediaPlpConsumerNewsArticles({
    limit: input.limit,
  });
  let enqueued = 0;
  for (const article of articles) {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation({
        id: article.id,
        title: article.title,
        summary: article.summary,
        category: article.category,
        sourceName: article.sourceName,
        articleUrl: article.articleUrl,
        publishedAt: article.publishedAt,
        verificationStatus: article.verificationStatus,
        geographicScope: article.geographicScope,
        language: article.language,
        imageUrl: article.imageUrl,
      }),
    );
    const canonicalVersion = fingerprintMediaPlpCanonicalVersion(tree);
    for (const locale of input.locales) {
      if (String(locale).toLowerCase() === "en") {
        continue;
      }
      enqueuePlpBuildRequest({
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId: mediaPlpPublicNewsEntityId(article.id),
        locale,
        canonicalVersion,
        contentRevision: 1,
        trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
      });
      enqueued += 1;
    }
  }
  return {
    consumerCount: articles.length,
    enqueued,
    PROVIDER_CALLS: 0,
  };
}

/**
 * Single-article dynamic refresh (post-upsert). Still identity-keyed.
 */
export function enqueuePublicNewsArticlePlpBuild(input: {
  readonly articleId: string;
  readonly canonicalVersion: string;
  readonly locales: readonly string[];
}): number {
  ensureMediaPlpAdapterRegistered();
  let n = 0;
  for (const locale of input.locales) {
    if (String(locale).toLowerCase() === "en") {
      continue;
    }
    enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(input.articleId),
      locale,
      canonicalVersion: input.canonicalVersion,
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });
    n += 1;
  }
  return n;
}
