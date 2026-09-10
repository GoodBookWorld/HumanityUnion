/**
 * RESET 04 / 05C / Reset 01 — bounded RSS /media carousel News PLP build trigger.
 *
 * After RSS ingest, enqueue PLP only for the currently selected /media news
 * rail (MEDIA_PLP_CAROUSEL_NEWS_LIMIT). Never fan out the full RSS corpus.
 * Durable enqueue only — does not call Gemini.
 */

import { MEDIA_PLP_ENTITY_TYPE, mediaPlpPublicNewsEntityId } from "@hu/types";

import { MEDIA_PLP_CAROUSEL_NEWS_LIMIT } from "../../media-plp-carousel/constants.js";
import { selectMediaPlpConsumerNewsArticles } from "../../media-plp-carousel/media-plp-news-selection.js";
import {
  fingerprintMediaPlpCanonicalVersion,
  buildCanonicalPublicNewsPresentation,
  asMediaPlpPresentationNode,
} from "../media/canonical-trees.js";
import { enqueuePlpBuildRequest } from "./build-request-queue.js";
import { recordPlpAutoBuildCollectionEnqueueAttempt } from "./plp-auto-build-runtime.js";
import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

/**
 * After RSS ingest / consumer-visible refresh: enqueue missing/stale news
 * localization for the current /media carousel selection × eligible locales.
 */
export async function enqueueConsumerVisibleNewsPlpBuilds(input: {
  readonly locales: readonly string[];
  readonly limit?: number;
}): Promise<{
  readonly consumerCount: number;
  readonly enqueued: number;
  readonly skippedUsable: number;
  readonly deduped: number;
  readonly PROVIDER_CALLS: 0;
}> {
  ensureMediaPlpAdapterRegistered();
  recordPlpAutoBuildCollectionEnqueueAttempt();
  const articles = await selectMediaPlpConsumerNewsArticles({
    limit: input.limit ?? MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
  });
  let enqueued = 0;
  let skippedUsable = 0;
  let deduped = 0;
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
    const entityId = mediaPlpPublicNewsEntityId(article.id);

    for (const locale of input.locales) {
      if (String(locale).toLowerCase() === "en") {
        continue;
      }

      const result = await enqueuePlpBuildRequest({
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        locale,
        canonicalVersion,
        contentRevision: 1,
        trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
        canonicalPresentation: tree,
      });
      if (result.skippedUsable) {
        skippedUsable += 1;
      } else if (result.deduped) {
        deduped += 1;
      } else if (result.accepted) {
        enqueued += 1;
      }
    }
  }
  return {
    consumerCount: articles.length,
    enqueued,
    skippedUsable,
    deduped,
    PROVIDER_CALLS: 0,
  };
}

/**
 * Single-article path — intentionally a no-op.
 * Arbitrary RSS publication must not locale-fan-out; only the bounded
 * carousel collection trigger may enqueue public_news PLP work.
 */
export async function enqueuePublicNewsArticlePlpBuild(input: {
  readonly articleId: string;
  readonly canonicalVersion: string;
  readonly locales: readonly string[];
}): Promise<number> {
  void input;
  ensureMediaPlpAdapterRegistered();
  return 0;
}
