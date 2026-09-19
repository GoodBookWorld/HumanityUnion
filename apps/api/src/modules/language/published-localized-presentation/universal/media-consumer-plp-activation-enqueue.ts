/**
 * Language activation — bounded Media PLP enqueue for a newly CT-eligible locale.
 *
 * Covers required Civic Media families:
 *   civic_media_editorial, civic_media_principle, civic_media_trusted,
 *   civic_media_fact_check, civic_media_propaganda.
 *
 * Public News / RSS is source-original in visible reading and is excluded
 * from new-language activation. RSS ingest still owns news PLP independently.
 *
 * Durable enqueue only (fingerprint/CURRENT skip via enqueuePlpBuildRequest).
 * No provider await. No unbounded corpus scan. Registry locale list is the caller's.
 * No locale allowlist.
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpFactCheckEntityId,
  mediaPlpPrincipleEntityId,
  mediaPlpPropagandaEntityId,
  mediaPlpTrustedEntityId,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { FACT_CHECK_RESOURCES } from "../../../civic-media-center/content/fact-checking.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "../../../civic-media-center/content/propaganda-analysis.js";
import { CIVIC_MEDIA_SELECTION_PRINCIPLES } from "../../../civic-media-center/content/sections.js";
import { TRUSTED_MEDIA_RESOURCES } from "../../../civic-media-center/content/trusted-media.js";
import { MEDIA_PLP_CAROUSEL_TRUSTED_WORLD_LIMIT } from "../../media-plp-carousel/constants.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalFactCheckPresentation,
  buildCanonicalPrinciplePresentation,
  buildCanonicalPropagandaPresentation,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../media/canonical-trees.js";
import { enqueuePlpBuildRequest } from "./build-request-queue.js";
import { enqueueCivicMediaEditorialPlpBuilds } from "./editorial-build-trigger.js";
import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

/** Zeroed so activation callers can read `.news` without scheduling RSS PLP. */
const NEWS_EXCLUDED_FROM_LANGUAGE_ACTIVATION = {
  consumerCount: 0,
  enqueued: 0,
  skippedUsable: 0,
  deduped: 0,
  PROVIDER_CALLS: 0,
} as const;

export type MediaConsumerPlpActivationEnqueueResult = {
  readonly locales: readonly string[];
  readonly families: readonly string[];
  readonly enqueued: number;
  readonly skippedUsable: number;
  readonly deduped: number;
  readonly editorial: Awaited<ReturnType<typeof enqueueCivicMediaEditorialPlpBuilds>>;
  readonly news: typeof NEWS_EXCLUDED_FROM_LANGUAGE_ACTIVATION;
  readonly staticCarouselEnqueued: number;
  readonly PROVIDER_CALLS: 0;
};

function isDefaultPlatformLocale(locale: string): boolean {
  return (
    normalizeLanguageRegistryLocaleKey(locale) ===
    normalizeLanguageRegistryLocaleKey(DEFAULT_PLATFORM_LANGUAGE)
  );
}

async function enqueueStaticCarouselEntitiesForLocale(locale: string): Promise<{
  readonly enqueued: number;
  readonly skippedUsable: number;
  readonly deduped: number;
}> {
  let enqueued = 0;
  let skippedUsable = 0;
  let deduped = 0;

  const record = async (input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly tree: ReturnType<typeof asMediaPlpPresentationNode>;
  }) => {
    const canonicalVersion = fingerprintMediaPlpCanonicalVersion(input.tree);
    const result = await enqueuePlpBuildRequest({
      entityType: input.entityType,
      entityId: input.entityId,
      locale,
      canonicalVersion,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      canonicalPresentation: input.tree,
      reopenFailedSameVersion: true,
    });
    if (result.skippedUsable) {
      skippedUsable += 1;
    } else if (result.deduped) {
      deduped += 1;
    } else if (result.accepted) {
      enqueued += 1;
    }
  };

  for (const principle of CIVIC_MEDIA_SELECTION_PRINCIPLES) {
    await record({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: mediaPlpPrincipleEntityId(principle.id),
      tree: asMediaPlpPresentationNode(buildCanonicalPrinciplePresentation(principle)),
    });
  }

  for (const resource of TRUSTED_MEDIA_RESOURCES.slice(
    0,
    MEDIA_PLP_CAROUSEL_TRUSTED_WORLD_LIMIT,
  )) {
    await record({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(resource.id),
      tree: asMediaPlpPresentationNode(buildCanonicalTrustedPresentation(resource)),
    });
  }

  for (const resource of FACT_CHECK_RESOURCES) {
    await record({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
      entityId: mediaPlpFactCheckEntityId(resource.id),
      tree: asMediaPlpPresentationNode(buildCanonicalFactCheckPresentation(resource)),
    });
  }

  for (const resource of PROPAGANDA_ANALYSIS_RESOURCES) {
    await record({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
      entityId: mediaPlpPropagandaEntityId(resource.id),
      tree: asMediaPlpPresentationNode(buildCanonicalPropagandaPresentation(resource)),
    });
  }

  return { enqueued, skippedUsable, deduped };
}

/**
 * Schedule bounded async Media PLP work for Registry CT-eligible locales.
 * Idempotent: usable CURRENT snapshots are skipped by enqueuePlpBuildRequest.
 */
export async function enqueueConsumerVisibleMediaPlpBuildsForLocales(input: {
  readonly locales: readonly string[];
}): Promise<MediaConsumerPlpActivationEnqueueResult> {
  ensureMediaPlpAdapterRegistered();

  const locales = [
    ...new Set(
      input.locales
        .map((locale) => locale.trim())
        .filter((locale) => locale.length > 0 && !isDefaultPlatformLocale(locale)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const families = [
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
  ] as const;

  const editorial = await enqueueCivicMediaEditorialPlpBuilds({ locales });

  let staticCarouselEnqueued = 0;
  let staticSkipped = 0;
  let staticDeduped = 0;
  for (const locale of locales) {
    const staticResult = await enqueueStaticCarouselEntitiesForLocale(locale);
    staticCarouselEnqueued += staticResult.enqueued;
    staticSkipped += staticResult.skippedUsable;
    staticDeduped += staticResult.deduped;
  }

  return {
    locales,
    families: [...families],
    enqueued: editorial.enqueued + staticCarouselEnqueued,
    skippedUsable: editorial.skippedUsable + staticSkipped,
    deduped: editorial.deduped + staticDeduped,
    editorial,
    news: NEWS_EXCLUDED_FROM_LANGUAGE_ACTIVATION,
    staticCarouselEnqueued,
    PROVIDER_CALLS: 0,
  };
}
