/**
 * RESET 04 / 05C — dynamic RSS / consumer-visible News build trigger.
 *
 * RESET 05C uses the auto-build union (limit 24 = country rail) so both
 * /media (12) and country surfaces are covered. Does not call Gemini.
 * discoverActiveNewsIds / carousel materializer keep limit 12 via
 * selectMediaPlpConsumerNewsArticles (03E.13 unchanged).
 */

import { MEDIA_PLP_ENTITY_TYPE, mediaPlpPublicNewsEntityId } from "@hu/types";

import {
  selectConsumerVisibleNewsArticlesForAutoBuild,
  selectMediaPlpConsumerNewsArticles,
} from "../../media-plp-carousel/media-plp-news-selection.js";
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
 * Default selection = auto-build union (limit 24). Optional limit override
 * still uses the same language=en + balance selector (tests may pass 12).
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
  const articles =
    input.limit != null
      ? await selectMediaPlpConsumerNewsArticles({ limit: input.limit })
      : await selectConsumerVisibleNewsArticlesForAutoBuild();
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
