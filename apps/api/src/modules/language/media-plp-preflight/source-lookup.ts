/**
 * Reset 03A — one-entity Media source lookup (indexed / direct only).
 * Never enumerates the Media corpus. Never logs document bodies.
 */

import type {
  LanguageCode,
  MediaPlpEntityType,
  PublicNewsArticleItem,
  PublicPresentationNode,
  TrustedMediaCategoryId,
} from "@hu/types";
import { MEDIA_PLP_EDITORIAL_ENTITY_ID, MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { FACT_CHECK_RESOURCES } from "../../civic-media-center/content/fact-checking.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "../../civic-media-center/content/propaganda-analysis.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
  CIVIC_MEDIA_SELECTION_PRINCIPLES,
} from "../../civic-media-center/content/sections.js";
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
import { markMediaPlpPreflightSourceLookup } from "./counters.js";

export type MediaPlpPreflightSourceLookup = {
  readonly SOURCE_FOUND: boolean;
  readonly SOURCE_PUBLIC: boolean;
  readonly CANONICAL_VERSION: string | null;
  readonly SOURCE_DOCUMENT_BYTES: number;
  readonly SOURCE_RECORDS_MATCHED: number;
  readonly identityCollision: boolean;
  /** In-memory only for 03E.2 integrity counts — never printed. */
  readonly canonicalPresentation?: PublicPresentationNode | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function documentBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

function emptySource(matched: number, collision = false): MediaPlpPreflightSourceLookup {
  return {
    SOURCE_FOUND: false,
    SOURCE_PUBLIC: false,
    CANONICAL_VERSION: null,
    SOURCE_DOCUMENT_BYTES: 0,
    SOURCE_RECORDS_MATCHED: matched,
    identityCollision: collision,
    canonicalPresentation: null,
  };
}

async function loadPublicNewsSource(
  entityId: string,
): Promise<MediaPlpPreflightSourceLookup> {
  markMediaPlpPreflightSourceLookup();
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
  const second = await cursor.next();
  if (second) {
    return emptySource(2, true);
  }
  if (!doc) {
    return emptySource(0);
  }

  const now = new Date().toISOString();
  const status = asString(doc.status);
  const expiresAt = asString(doc.expiresAt);
  const sourcePublic = status === "active" && (!expiresAt || expiresAt > now);

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

  const tree = buildCanonicalPublicNewsPresentation(article);
  const canonicalVersion = fingerprintMediaPlpCanonicalVersion(
    asMediaPlpPresentationNode(tree),
  );

  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: sourcePublic,
    CANONICAL_VERSION: canonicalVersion,
    SOURCE_DOCUMENT_BYTES: documentBytes(doc),
    SOURCE_RECORDS_MATCHED: 1,
    identityCollision: false,
    canonicalPresentation: asMediaPlpPresentationNode(tree),
  };
}

function loadPrincipleSource(entityId: string): MediaPlpPreflightSourceLookup {
  markMediaPlpPreflightSourceLookup();
  const matches = CIVIC_MEDIA_SELECTION_PRINCIPLES.filter(
    (item) => item.id === entityId,
  );
  if (matches.length > 1) {
    return emptySource(matches.length, true);
  }
  const principle = matches[0];
  if (!principle) {
    return emptySource(0);
  }
  const tree = buildCanonicalPrinciplePresentation(principle);
  const canonicalVersion = fingerprintMediaPlpCanonicalVersion(
    asMediaPlpPresentationNode(tree),
  );
  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: true,
    CANONICAL_VERSION: canonicalVersion,
    SOURCE_DOCUMENT_BYTES: documentBytes({
      id: principle.id,
      titleLen: principle.title.length,
      descriptionLen: principle.description.length,
      sortOrder: principle.sortOrder,
    }),
    SOURCE_RECORDS_MATCHED: 1,
    identityCollision: false,
    canonicalPresentation: asMediaPlpPresentationNode(tree),
  };
}

function loadEditorialSource(entityId: string): MediaPlpPreflightSourceLookup {
  markMediaPlpPreflightSourceLookup();
  if (entityId.trim() !== MEDIA_PLP_EDITORIAL_ENTITY_ID) {
    return emptySource(0);
  }
  const tree = buildCanonicalEditorialPresentation({
    overview: CIVIC_MEDIA_OVERVIEW,
    faq: [...CIVIC_MEDIA_FAQ],
  });
  const canonicalVersion = fingerprintMediaPlpCanonicalVersion(
    asMediaPlpPresentationNode(tree),
  );
  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: true,
    CANONICAL_VERSION: canonicalVersion,
    SOURCE_DOCUMENT_BYTES: documentBytes({
      id: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      overviewTitleLen: CIVIC_MEDIA_OVERVIEW.title.length,
      overviewSummaryLen: CIVIC_MEDIA_OVERVIEW.summary.length,
      overviewPointCount: CIVIC_MEDIA_OVERVIEW.points.length,
      faqCount: CIVIC_MEDIA_FAQ.length,
    }),
    SOURCE_RECORDS_MATCHED: 1,
    identityCollision: false,
    canonicalPresentation: asMediaPlpPresentationNode(tree),
  };
}

async function loadTrustedSource(
  entityId: string,
): Promise<MediaPlpPreflightSourceLookup> {
  markMediaPlpPreflightSourceLookup();
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
  const second = await cursor.next();
  if (second) {
    return emptySource(2, true);
  }
  if (!doc) {
    return emptySource(0);
  }

  const resourceType = asString(doc.resourceType);
  const active = doc.active === true;
  const sourcePublic = active && resourceType === "TRUSTED_MEDIA";

  const categoryRaw = asString(doc.categoryId) || "international-wire-service";
  const categoryId = categoryRaw as TrustedMediaCategoryId;

  const tree = buildCanonicalTrustedPresentation({
    id: asString(doc.id) || entityId,
    name: asString(doc.name),
    logoLabel: asString(doc.logoLabel) || "?",
    country: asString(doc.secondaryText) || asString(doc.countryCode) || "International",
    ...(asString(doc.countryCode) ? { countryCode: asString(doc.countryCode) } : {}),
    categoryId,
    explanation: asString(doc.description),
    websiteUrl: asString(doc.websiteUrl),
    sortOrder: typeof doc.sortOrder === "number" ? doc.sortOrder : 0,
  });
  const canonicalVersion = fingerprintMediaPlpCanonicalVersion(
    asMediaPlpPresentationNode(tree),
  );

  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: sourcePublic,
    CANONICAL_VERSION: canonicalVersion,
    SOURCE_DOCUMENT_BYTES: documentBytes(doc),
    SOURCE_RECORDS_MATCHED: 1,
    identityCollision: false,
    canonicalPresentation: asMediaPlpPresentationNode(tree),
  };
}

function loadFactCheckSource(entityId: string): MediaPlpPreflightSourceLookup {
  markMediaPlpPreflightSourceLookup();
  const matches = FACT_CHECK_RESOURCES.filter((item) => item.id === entityId);
  if (matches.length > 1) {
    return emptySource(matches.length, true);
  }
  const resource = matches[0];
  if (!resource) {
    return emptySource(0);
  }
  const tree = buildCanonicalFactCheckPresentation(resource);
  const canonicalVersion = fingerprintMediaPlpCanonicalVersion(
    asMediaPlpPresentationNode(tree),
  );
  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: true,
    CANONICAL_VERSION: canonicalVersion,
    SOURCE_DOCUMENT_BYTES: documentBytes({
      id: resource.id,
      missionLen: resource.mission.length,
      coverageLen: resource.coverage.length,
      sortOrder: resource.sortOrder,
    }),
    SOURCE_RECORDS_MATCHED: 1,
    identityCollision: false,
    canonicalPresentation: asMediaPlpPresentationNode(tree),
  };
}

function loadPropagandaSource(entityId: string): MediaPlpPreflightSourceLookup {
  markMediaPlpPreflightSourceLookup();
  const matches = PROPAGANDA_ANALYSIS_RESOURCES.filter((item) => item.id === entityId);
  if (matches.length > 1) {
    return emptySource(matches.length, true);
  }
  const resource = matches[0];
  if (!resource) {
    return emptySource(0);
  }
  const tree = buildCanonicalPropagandaPresentation(resource);
  const canonicalVersion = fingerprintMediaPlpCanonicalVersion(
    asMediaPlpPresentationNode(tree),
  );
  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: true,
    CANONICAL_VERSION: canonicalVersion,
    SOURCE_DOCUMENT_BYTES: documentBytes({
      id: resource.id,
      focusLen: resource.focus.length,
      explanationLen: resource.explanation.length,
      sortOrder: resource.sortOrder,
    }),
    SOURCE_RECORDS_MATCHED: 1,
    identityCollision: false,
    canonicalPresentation: asMediaPlpPresentationNode(tree),
  };
}

export async function loadMediaPlpPreflightSource(input: {
  readonly entityType: MediaPlpEntityType;
  readonly entityId: string;
  readonly locale: LanguageCode;
}): Promise<MediaPlpPreflightSourceLookup> {
  void input.locale;
  switch (input.entityType) {
    case MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS:
      return loadPublicNewsSource(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE:
      return loadPrincipleSource(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED:
      return loadTrustedSource(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL:
      return loadEditorialSource(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK:
      return loadFactCheckSource(input.entityId);
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA:
      return loadPropagandaSource(input.entityId);
    default: {
      const _exhaustive: never = input.entityType;
      void _exhaustive;
      return emptySource(0);
    }
  }
}
