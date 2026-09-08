/**
 * RESET 05E / 05E.1 — bounded heal for current Editorial + /media-12 News
 * provider-response failures (including legacy pre-05E shapes).
 *
 * One-shot recovery generation "05E" resets attempt budget exactly once so the
 * structured provider contract can execute. Does not mass-reopen historical rows.
 */

import { MEDIA_PLP_ENTITY_TYPE, mediaPlpPublicNewsEntityId } from "@hu/types";

import { selectMediaPlpConsumerNewsArticles } from "../../media-plp-carousel/media-plp-news-selection.js";
import {
  classifyConsumerProviderRecoveryEligibility,
  PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION,
} from "../../media-plp-materializer/provider-response-contract.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../media/canonical-trees.js";
import {
  enqueuePlpBuildRequest,
  isExistingPlpUsableForEnqueue,
} from "./build-request-queue.js";
import { enqueueCivicMediaEditorialPlpBuilds } from "./editorial-build-trigger.js";
import { findPlpAutoBuildWorkByKey } from "./plp-auto-build-work.repository.js";
import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

export async function healCurrentConsumerProviderFailures(input: {
  readonly locales: readonly string[];
}): Promise<{
  readonly editorialEnqueued: number;
  readonly newsEnqueued: number;
  readonly newsSkippedNotProviderClass: number;
  readonly newsSkippedAlreadyRecovered: number;
  readonly newsSkippedUsable: number;
  readonly newsSkippedVersionMismatch: number;
  readonly PROVIDER_CALLS: 0;
}> {
  ensureMediaPlpAdapterRegistered();
  const editorial = await enqueueCivicMediaEditorialPlpBuilds({
    locales: input.locales,
  });

  const mediaExact = await selectMediaPlpConsumerNewsArticles({ limit: 12 });
  let newsEnqueued = 0;
  let newsSkippedNotProviderClass = 0;
  let newsSkippedAlreadyRecovered = 0;
  let newsSkippedUsable = 0;
  let newsSkippedVersionMismatch = 0;

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

      const hasUsableSnapshot = await isExistingPlpUsableForEnqueue({
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        locale,
        canonicalVersion,
        canonicalPresentation: tree,
      });

      const decision = classifyConsumerProviderRecoveryEligibility({
        work: existing
          ? {
              status: existing.status,
              canonicalVersion: existing.canonicalVersion,
              lastError: existing.lastError,
              failureCode: existing.failureCode,
              recoveryGeneration: existing.recoveryGeneration,
            }
          : null,
        liveCanonicalVersion: canonicalVersion,
        hasUsableSnapshot,
      });

      if (!decision.eligible) {
        if (decision.ineligibleReason === "RECOVERY_ALREADY_ATTEMPTED") {
          newsSkippedAlreadyRecovered += 1;
        } else if (decision.ineligibleReason === "USABLE_SNAPSHOT") {
          newsSkippedUsable += 1;
        } else if (decision.ineligibleReason === "VERSION_MISMATCH") {
          newsSkippedVersionMismatch += 1;
        } else if (
          decision.ineligibleReason === "NOT_PROVIDER_RESPONSE_CLASS" ||
          decision.ineligibleReason === "INTEGRITY_OR_BRAND" ||
          decision.ineligibleReason === "STALE_OR_CANONICAL" ||
          decision.ineligibleReason === "NON_PROVIDER"
        ) {
          newsSkippedNotProviderClass += 1;
        }
        // NOT_FAILED / NO_WORK_ROW: fall through to ordinary enqueue below.
        if (
          decision.ineligibleReason !== "NOT_FAILED" &&
          decision.ineligibleReason !== "NO_WORK_ROW"
        ) {
          continue;
        }
      }

      const result = await enqueuePlpBuildRequest({
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        locale,
        canonicalVersion,
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        canonicalPresentation: tree,
        reopenFailedSameVersion: decision.eligible === true,
        recoveryGeneration: decision.eligible
          ? PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION
          : undefined,
        // Heal already probed usability for eligibility; avoid double-skip races.
        skipUsableCheck: decision.eligible === true,
      });
      if (result.accepted) {
        newsEnqueued += 1;
      } else if (result.skippedUsable) {
        newsSkippedUsable += 1;
      }
    }
  }

  return {
    editorialEnqueued: editorial.enqueued,
    newsEnqueued,
    newsSkippedNotProviderClass,
    newsSkippedAlreadyRecovered,
    newsSkippedUsable,
    newsSkippedVersionMismatch,
    PROVIDER_CALLS: 0,
  };
}
