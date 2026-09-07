/**
 * Reset 03C — SSR seed helper for Media PLP (resolve published or canonical fallback).
 * When flag OFF, returns null so callers keep legacy path.
 * Never generate-on-miss; never mix fields; API fingerprints match materializer.
 */

import type {
  CivicMediaCenterPublic,
  CivicMediaSelectionPrinciple,
  FactCheckResource,
  PropagandaAnalysisResource,
  PublicNewsArticleItem,
  PublicPresentationNode,
  TrustedMediaResource,
} from "@hu/types";
import {
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpEditorialEntityId,
  mediaPlpFactCheckEntityId,
  mediaPlpPrincipleEntityId,
  mediaPlpPropagandaEntityId,
  mediaPlpPublicNewsEntityId,
  mediaPlpTrustedEntityId,
  protectedIdentity,
  protectedTechnical,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
} from "@hu/types";

import { isMediaPlpWebEnabled } from "./feature-flag";
import {
  resolveMediaPlpBatch,
  toMediaPlpResolvedPresentation,
} from "./media-plp-api";
import {
  isMediaPlpLiveTruthProbeEnabled,
  recordMediaPlpLiveTruthEditorialResult,
} from "./media-plp-live-truth-probe";
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
    whyItMatters: principle.whyItMatters ?? "",
  };
}

export function buildCanonicalFactCheckPresentationNode(
  resource: FactCheckResource,
): PublicPresentationNode {
  return {
    name: protectedIdentity(resource.name),
    websiteUrl: protectedTechnical(resource.websiteUrl),
    mission: resource.mission,
    coverage: resource.coverage,
  };
}

export function buildCanonicalPropagandaPresentationNode(
  resource: PropagandaAnalysisResource,
): PublicPresentationNode {
  return {
    name: protectedIdentity(resource.name),
    websiteUrl: protectedTechnical(resource.websiteUrl),
    focus: resource.focus,
    explanation: resource.explanation,
  };
}

export function buildCanonicalPublicNewsPresentationNode(
  article: PublicNewsArticleItem,
): PublicPresentationNode {
  return {
    id: protectedTechnical(article.id),
    articleUrl: protectedTechnical(article.articleUrl),
    imageUrl: article.imageUrl ? protectedTechnical(article.imageUrl) : null,
    publishedAt: protectedTechnical(article.publishedAt),
    sourceName: protectedIdentity(article.sourceName),
    verificationStatus: protectedTechnical(article.verificationStatus),
    title: article.title,
    summary: article.summary,
    category: article.category ?? "",
    geographicScope: protectedTechnical(article.geographicScope ?? ""),
  };
}

/** Reset 03E — overview + FAQ canonical presentation for civic_media_editorial. */
export function buildCanonicalEditorialPresentationNode(
  media: Pick<CivicMediaCenterPublic, "overview" | "faq">,
): PublicPresentationNode {
  return {
    overviewTitle: media.overview.title,
    overviewSummary: media.overview.summary,
    overviewPoints: media.overview.points.map((point) => ({
      id: point.id,
      heading: point.heading,
      body: point.body,
    })),
    faq: media.faq.map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
    })),
  };
}

function coherentFallback(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly presentation: PublicPresentationNode;
  readonly canonicalVersion?: string;
  readonly reasonCode?: string;
}): MediaPlpResolvedPresentation {
  return {
    mode: "CANONICAL_FALLBACK",
    presentation: input.presentation,
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    canonicalVersion: input.canonicalVersion ?? "canonical",
    reasonCode: input.reasonCode ?? "NO_PUBLISHED_SNAPSHOT",
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
      try {
        out[resource.id] = await input.resolve({
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          entityId,
          locale: input.locale,
          liveCanonicalVersion: "injected",
          canonicalPresentation: canonical,
        });
      } catch {
        out[resource.id] = coherentFallback({
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          entityId,
          locale: input.locale,
          presentation: canonical,
        });
      }
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
      try {
        out[principle.id] = await input.resolve({
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
          entityId,
          locale: input.locale,
          canonicalPresentation: canonical,
        });
      } catch {
        out[principle.id] = coherentFallback({
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
          entityId,
          locale: input.locale,
          presentation: canonical,
        });
      }
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

function resolveKeyedFromBatch(input: {
  readonly locale: string;
  readonly byEntityKey: ReadonlyMap<
    string,
    {
      readonly entityType: string;
      readonly entityId: string;
      readonly locale: string;
      readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
      readonly presentation: PublicPresentationNode;
      readonly canonicalVersion: string;
    }
  >;
  readonly items: readonly {
    readonly entityType: string;
    readonly entityId: string;
    readonly canonicalPresentation: PublicPresentationNode;
    readonly key: string;
  }[];
}): Record<string, MediaPlpResolvedPresentation> {
  const out: Record<string, MediaPlpResolvedPresentation> = {};
  for (const item of input.items) {
    const hit = input.byEntityKey.get(`${item.entityType}\0${item.entityId}`);
    out[item.key] = hit
      ? toMediaPlpResolvedPresentation(hit)
      : coherentFallback({
          entityType: item.entityType,
          entityId: item.entityId,
          locale: input.locale,
          presentation: item.canonicalPresentation,
        });
  }
  return out;
}

function fallbackKeyed(input: {
  readonly locale: string;
  readonly items: readonly {
    readonly entityType: string;
    readonly entityId: string;
    readonly canonicalPresentation: PublicPresentationNode;
    readonly key: string;
  }[];
}): Record<string, MediaPlpResolvedPresentation> {
  const out: Record<string, MediaPlpResolvedPresentation> = {};
  for (const item of input.items) {
    out[item.key] = coherentFallback({
      entityType: item.entityType,
      entityId: item.entityId,
      locale: input.locale,
      presentation: item.canonicalPresentation,
    });
  }
  return out;
}

/**
 * Reset 03D / 03E — one bounded Media PLP HTTP resolve for Media page entities.
 * Trusted + principles + editorial + fact-check + propaganda (+ optional news) in a single batch.
 */
export async function loadMediaPlpPagePresentations(input: {
  readonly resources: readonly TrustedMediaResource[];
  readonly principles: readonly CivicMediaSelectionPrinciple[];
  readonly factChecking: readonly FactCheckResource[];
  readonly propagandaAnalysis: readonly PropagandaAnalysisResource[];
  readonly newsArticles?: readonly PublicNewsArticleItem[];
  readonly media: Pick<CivicMediaCenterPublic, "overview" | "faq">;
  readonly locale: string;
}): Promise<{
  readonly trustedById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly principlesById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly factCheckById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly propagandaById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly newsById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly editorial: MediaPlpResolvedPresentation;
} | null> {
  if (!isMediaPlpWebEnabled()) {
    return null;
  }

  const trustedItems = input.resources.map((resource) => ({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
    entityId: mediaPlpTrustedEntityId(resource.id),
    canonicalPresentation: buildCanonicalTrustedPresentationNode(resource),
    key: resource.id,
  }));
  const principleItems = input.principles.map((principle) => ({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
    entityId: mediaPlpPrincipleEntityId(principle.id),
    canonicalPresentation: buildCanonicalPrinciplePresentationNode(principle),
    key: principle.id,
  }));
  const factCheckItems = input.factChecking.map((resource) => ({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
    entityId: mediaPlpFactCheckEntityId(resource.id),
    canonicalPresentation: buildCanonicalFactCheckPresentationNode(resource),
    key: resource.id,
  }));
  const propagandaItems = input.propagandaAnalysis.map((resource) => ({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
    entityId: mediaPlpPropagandaEntityId(resource.id),
    canonicalPresentation: buildCanonicalPropagandaPresentationNode(resource),
    key: resource.id,
  }));
  const newsItems = (input.newsArticles ?? []).map((article) => ({
    entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    entityId: mediaPlpPublicNewsEntityId(article.id),
    canonicalPresentation: buildCanonicalPublicNewsPresentationNode(article),
    key: article.id,
  }));
  const editorialCanonical = buildCanonicalEditorialPresentationNode(input.media);
  const editorialEntityId = mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID);

  const items = [
    ...trustedItems.map(({ entityType, entityId, canonicalPresentation }) => ({
      entityType,
      entityId,
      canonicalPresentation,
    })),
    ...principleItems.map(({ entityType, entityId, canonicalPresentation }) => ({
      entityType,
      entityId,
      canonicalPresentation,
    })),
    ...factCheckItems.map(({ entityType, entityId, canonicalPresentation }) => ({
      entityType,
      entityId,
      canonicalPresentation,
    })),
    ...propagandaItems.map(({ entityType, entityId, canonicalPresentation }) => ({
      entityType,
      entityId,
      canonicalPresentation,
    })),
    ...newsItems.map(({ entityType, entityId, canonicalPresentation }) => ({
      entityType,
      entityId,
      canonicalPresentation,
    })),
    {
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: editorialEntityId,
      canonicalPresentation: editorialCanonical,
    },
  ];

  try {
    const results = await resolveMediaPlpBatch({
      locale: input.locale,
      items,
    });
    const byEntityKey = new Map(
      results.map((row) => [`${row.entityType}\0${row.entityId}`, row]),
    );

    const trustedById = resolveKeyedFromBatch({
      locale: input.locale,
      byEntityKey: byEntityKey,
      items: trustedItems,
    });
    const principlesById = resolveKeyedFromBatch({
      locale: input.locale,
      byEntityKey: byEntityKey,
      items: principleItems,
    });
    const factCheckById = resolveKeyedFromBatch({
      locale: input.locale,
      byEntityKey: byEntityKey,
      items: factCheckItems,
    });
    const propagandaById = resolveKeyedFromBatch({
      locale: input.locale,
      byEntityKey: byEntityKey,
      items: propagandaItems,
    });
    const newsById = resolveKeyedFromBatch({
      locale: input.locale,
      byEntityKey: byEntityKey,
      items: newsItems,
    });

    const editorialHit = byEntityKey.get(
      `${MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL}\0${editorialEntityId}`,
    );
    const editorial = editorialHit
      ? toMediaPlpResolvedPresentation(editorialHit)
      : coherentFallback({
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: editorialEntityId,
          locale: input.locale,
          presentation: editorialCanonical,
        });

    if (isMediaPlpLiveTruthProbeEnabled()) {
      recordMediaPlpLiveTruthEditorialResult({
        mode: editorial.mode,
        reasonCode: editorialHit?.reasonCode,
        entityId: editorial.entityId,
        canonicalVersion: editorial.canonicalVersion,
        schema: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        presentation: editorial.presentation,
        canonicalPresentation: editorialCanonical,
        persistenceMode: editorialHit?.persistenceMode,
        lookupResult: editorialHit?.lookupResult,
      });
    }

    return {
      trustedById,
      principlesById,
      factCheckById,
      propagandaById,
      newsById,
      editorial,
    };
  } catch {
    return {
      trustedById: fallbackKeyed({ locale: input.locale, items: trustedItems }),
      principlesById: fallbackKeyed({ locale: input.locale, items: principleItems }),
      factCheckById: fallbackKeyed({ locale: input.locale, items: factCheckItems }),
      propagandaById: fallbackKeyed({ locale: input.locale, items: propagandaItems }),
      newsById: fallbackKeyed({ locale: input.locale, items: newsItems }),
      editorial: coherentFallback({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: editorialEntityId,
        locale: input.locale,
        presentation: editorialCanonical,
      }),
    };
  }
}
