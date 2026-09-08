/**
 * RESET 05E — bounded heal for current Editorial + /media-12 News provider failures.
 *
 * Reopens only current-version failed work in the provider-response class.
 * Does not mass-reopen historical rows.
 */

import { MEDIA_PLP_ENTITY_TYPE, mediaPlpPublicNewsEntityId } from "@hu/types";

import { selectMediaPlpConsumerNewsArticles } from "../../media-plp-carousel/media-plp-news-selection.js";
import { isProviderResponseClassFailureReason } from "../../media-plp-materializer/provider-response-contract.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../media/canonical-trees.js";
import { enqueuePlpBuildRequest } from "./build-request-queue.js";
import { enqueueCivicMediaEditorialPlpBuilds } from "./editorial-build-trigger.js";
import { findPlpAutoBuildWorkByKey } from "./plp-auto-build-work.repository.js";
import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

export async function healCurrentConsumerProviderFailures(input: {
  readonly locales: readonly string[];
}): Promise<{
  readonly editorialEnqueued: number;
  readonly newsEnqueued: number;
  readonly newsSkippedNotProviderClass: number;
  readonly PROVIDER_CALLS: 0;
}> {
  ensureMediaPlpAdapterRegistered();
  const editorial = await enqueueCivicMediaEditorialPlpBuilds({
    locales: input.locales,
  });

  const mediaExact = await selectMediaPlpConsumerNewsArticles({ limit: 12 });
  let newsEnqueued = 0;
  let newsSkippedNotProviderClass = 0;

  for (const article of mediaExact) {
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

      const existing = await findPlpAutoBuildWorkByKey({
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        locale,
      });

      const sameVersionFailed =
        existing?.status === "failed" &&
        existing.canonicalVersion === canonicalVersion;
      const providerClass =
        sameVersionFailed &&
        isProviderResponseClassFailureReason(
          existing!.lastError,
          existing!.failureCode,
        );

      if (sameVersionFailed && !providerClass) {
        newsSkippedNotProviderClass += 1;
        continue;
      }

      const result = await enqueuePlpBuildRequest({
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        locale,
        canonicalVersion,
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        canonicalPresentation: tree,
        reopenFailedSameVersion: providerClass === true,
      });
      if (result.accepted) {
        newsEnqueued += 1;
      }
    }
  }

  return {
    editorialEnqueued: editorial.enqueued,
    newsEnqueued,
    newsSkippedNotProviderClass,
    PROVIDER_CALLS: 0,
  };
}
