/**
 * RESET 04 / 05C / 05C.1 / 05D — dynamic RSS / consumer-visible News build trigger.
 *
 * RESET 05D — auto-build covers /media 12 + country-affiliated candidates via
 * selectConsumerVisibleNewsArticlesForAutoBuild. Exact media-12 rows may heal
 * same-version failed work (targeted, not mass reopen of historical failures).
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
import { recordPlpAutoBuildCollectionEnqueueAttempt } from "./plp-auto-build-runtime.js";
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
  readonly skippedUsable: number;
  readonly deduped: number;
  readonly PROVIDER_CALLS: 0;
}> {
  ensureMediaPlpAdapterRegistered();
  recordPlpAutoBuildCollectionEnqueueAttempt();
  const mediaExact = await selectMediaPlpConsumerNewsArticles({
    limit: input.limit ?? 12,
  });
  const mediaExactIds = new Set(mediaExact.map((article) => article.id));
  const articles =
    input.limit != null
      ? mediaExact
      : await selectConsumerVisibleNewsArticlesForAutoBuild();
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
    const healMediaRail = mediaExactIds.has(article.id);
    for (const locale of input.locales) {
      if (String(locale).toLowerCase() === "en") {
        continue;
      }
      const result = await enqueuePlpBuildRequest({
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId: mediaPlpPublicNewsEntityId(article.id),
        locale,
        canonicalVersion,
        contentRevision: 1,
        trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
        canonicalPresentation: tree,
        reopenFailedSameVersion: healMediaRail,
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
 * Single-article dynamic refresh (post-upsert). Still identity-keyed.
 * Awaits durable upsert only.
 */
export async function enqueuePublicNewsArticlePlpBuild(input: {
  readonly articleId: string;
  readonly canonicalVersion: string;
  readonly locales: readonly string[];
}): Promise<number> {
  ensureMediaPlpAdapterRegistered();
  let n = 0;
  for (const locale of input.locales) {
    if (String(locale).toLowerCase() === "en") {
      continue;
    }
    const result = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(input.articleId),
      locale,
      canonicalVersion: input.canonicalVersion,
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });
    if (result.accepted) {
      n += 1;
    }
  }
  return n;
}
