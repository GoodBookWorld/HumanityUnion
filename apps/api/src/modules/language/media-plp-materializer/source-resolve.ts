/**
 * Reset 03B — one-entity Media source resolve (canonical tree + version).
 * Never logs prose bodies.
 */

import type {
  LanguageCode,
  MediaPlpEntityType,
  PublicNewsArticleItem,
  PublicPresentationNode,
  TrustedMediaCategoryId,
} from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { FACT_CHECK_RESOURCES } from "../../civic-media-center/content/fact-checking.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "../../civic-media-center/content/propaganda-analysis.js";
import { CIVIC_MEDIA_FAQ, CIVIC_MEDIA_OVERVIEW, CIVIC_MEDIA_SELECTION_PRINCIPLES } from "../../civic-media-center/content/sections.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  buildCanonicalFactCheckPresentation,
  buildCanonicalPrinciplePresentation,
  buildCanonicalPropagandaPresentation,
  buildCanonicalPublicNewsPresentation,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../published-localized-presentation/media/canonical-trees.js";
import { collectAutoPaths } from "../published-localized-presentation/presentation-paths.js";
import { markMaterializerSourceLookup } from "./counters.js";

export type MediaPlpMaterializerSourceResolve = {
  readonly SOURCE_FOUND: boolean;
  readonly SOURCE_PUBLIC: boolean;
  readonly CANONICAL_VERSION: string | null;
  readonly canonicalPresentation: PublicPresentationNode | null;
  readonly autoPaths: readonly { readonly path: string; readonly value: string }[];
  readonly identityCollision: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function empty(): MediaPlpMaterializerSourceResolve {
  return {
    SOURCE_FOUND: false,
    SOURCE_PUBLIC: false,
    CANONICAL_VERSION: null,
    canonicalPresentation: null,
    autoPaths: [],
    identityCollision: false,
  };
}

function withTree(
  presentation: PublicPresentationNode,
  sourcePublic: boolean,
): MediaPlpMaterializerSourceResolve {
  const canonicalVersion = fingerprintMediaPlpCanonicalVersion(presentation);
  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: sourcePublic,
    CANONICAL_VERSION: canonicalVersion,
    canonicalPresentation: presentation,
    autoPaths: collectAutoPaths(presentation),
    identityCollision: false,
  };
}

async function resolvePublicNews(
  entityId: string,
): Promise<MediaPlpMaterializerSourceResolve> {
  markMaterializerSourceLookup();
  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.publicNewsArticles,
  );
  const cursor = collection.find(
    { id: entityId },
    {
      projection: {
        id: 1,
        title: 1,
        summary: 1,
        category: 1,
        articleUrl: 1,
        imageUrl: 1,
        publishedAt: 1,
        language: 1,
        geographicScope: 1,
        sourceName: 1,
        verificationStatus: 1,
        status: 1,
        expiresAt: 1,
      },
      limit: 2,
    },
  );
  const doc = (await cursor.next()) as Record<string, unknown> | null;
  if (await cursor.next()) {
    return { ...empty(), identityCollision: true };
  }
  if (!doc) {
    return empty();
  }
  const now = new Date().toISOString();
  const expiresAt = asString(doc.expiresAt);
  const sourcePublic =
    asString(doc.status) === "active" && (!expiresAt || expiresAt > now);
  const article: PublicNewsArticleItem = {
    id: asString(doc.id) || entityId,
    sourceName: asString(doc.sourceName),
    title: asString(doc.title),
    summary: asString(doc.summary),
    articleUrl: asString(doc.articleUrl),
    ...(asString(doc.imageUrl) ? { imageUrl: asString(doc.imageUrl) } : {}),
    publishedAt: asString(doc.publishedAt),
    language: asString(doc.language) || "en",
    ...(asString(doc.category) ? { category: asString(doc.category) } : {}),
    ...(asString(doc.geographicScope)
      ? { geographicScope: asString(doc.geographicScope) }
      : {}),
    verificationStatus:
      doc.verificationStatus === "reviewed" ? "reviewed" : "external-source",
  };
  return withTree(
    asMediaPlpPresentationNode(buildCanonicalPublicNewsPresentation(article)),
    sourcePublic,
  );
}

function resolvePrinciple(entityId: string): MediaPlpMaterializerSourceResolve {
  markMaterializerSourceLookup();
  const matches = CIVIC_MEDIA_SELECTION_PRINCIPLES.filter((item) => item.id === entityId);
  if (matches.length > 1) {
    return { ...empty(), identityCollision: true };
  }
  const principle = matches[0];
  if (!principle) {
    return empty();
  }
  return withTree(
    asMediaPlpPresentationNode(buildCanonicalPrinciplePresentation(principle)),
    true,
  );
}

async function resolveTrusted(
  entityId: string,
): Promise<MediaPlpMaterializerSourceResolve> {
  markMaterializerSourceLookup();
  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.mediaResources,
  );
  const cursor = collection.find(
    { id: entityId },
    {
      projection: {
        id: 1,
        name: 1,
        websiteUrl: 1,
        description: 1,
        resourceType: 1,
        active: 1,
        categoryId: 1,
        logoLabel: 1,
        secondaryText: 1,
        countryCode: 1,
        sortOrder: 1,
      },
      limit: 2,
    },
  );
  const doc = (await cursor.next()) as Record<string, unknown> | null;
  if (await cursor.next()) {
    return { ...empty(), identityCollision: true };
  }
  if (!doc) {
    return empty();
  }
  const sourcePublic =
    doc.active === true && asString(doc.resourceType) === "TRUSTED_MEDIA";
  const categoryId = (asString(doc.categoryId) ||
    "international-wire-service") as TrustedMediaCategoryId;
  return withTree(
    asMediaPlpPresentationNode(
      buildCanonicalTrustedPresentation({
        id: asString(doc.id) || entityId,
        name: asString(doc.name),
        logoLabel: asString(doc.logoLabel) || "?",
        country:
          asString(doc.secondaryText) || asString(doc.countryCode) || "International",
        ...(asString(doc.countryCode) ? { countryCode: asString(doc.countryCode) } : {}),
        categoryId,
        explanation: asString(doc.description),
        websiteUrl: asString(doc.websiteUrl),
        sortOrder: typeof doc.sortOrder === "number" ? doc.sortOrder : 0,
      }),
    ),
    sourcePublic,
  );
}

function resolveEditorial(entityId: string): MediaPlpMaterializerSourceResolve {
  markMaterializerSourceLookup();
  if (entityId.trim() !== "civic-media-center") {
    return empty();
  }
  return withTree(
    asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    ),
    true,
  );
}

function resolveFactCheck(entityId: string): MediaPlpMaterializerSourceResolve {
  markMaterializerSourceLookup();
  const matches = FACT_CHECK_RESOURCES.filter((item) => item.id === entityId);
  if (matches.length > 1) {
    return { ...empty(), identityCollision: true };
  }
  const resource = matches[0];
  if (!resource) {
    return empty();
  }
  return withTree(
    asMediaPlpPresentationNode(buildCanonicalFactCheckPresentation(resource)),
    true,
  );
}

function resolvePropaganda(entityId: string): MediaPlpMaterializerSourceResolve {
  markMaterializerSourceLookup();
  const matches = PROPAGANDA_ANALYSIS_RESOURCES.filter((item) => item.id === entityId);
  if (matches.length > 1) {
    return { ...empty(), identityCollision: true };
  }
  const resource = matches[0];
  if (!resource) {
    return empty();
  }
  return withTree(
    asMediaPlpPresentationNode(buildCanonicalPropagandaPresentation(resource)),
    true,
  );
}

export async function resolveMediaPlpMaterializerSource(input: {
  readonly entityType: MediaPlpEntityType;
  readonly entityId: string;
  readonly locale: LanguageCode;
}): Promise<MediaPlpMaterializerSourceResolve> {
  void input.locale;
  switch (input.entityType) {
    case MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS:
      return resolvePublicNews(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE:
      return resolvePrinciple(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED:
      return resolveTrusted(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL:
      return resolveEditorial(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK:
      return resolveFactCheck(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA:
      return resolvePropaganda(input.entityId);
    default: {
      const _exhaustive: never = input.entityType;
      void _exhaustive;
      return empty();
    }
  }
}
