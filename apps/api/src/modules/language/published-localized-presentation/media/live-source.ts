/**
 * Reset 03C — thin live canonical source for Media PLP consumer diagnostic.
 * Provider/worker/materializer-free. Bounded projections only.
 */

import type {
  MediaPlpEntityType,
  PublicPresentationNode,
  TrustedMediaCategoryId,
} from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { FACT_CHECK_RESOURCES } from "../../../civic-media-center/content/fact-checking.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "../../../civic-media-center/content/propaganda-analysis.js";
import { CIVIC_MEDIA_FAQ, CIVIC_MEDIA_OVERVIEW, CIVIC_MEDIA_SELECTION_PRINCIPLES } from "../../../civic-media-center/content/sections.js";
import { MONGO_COLLECTIONS } from "../../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../../infrastructure/mongodb/mongo-database.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  buildCanonicalFactCheckPresentation,
  buildCanonicalPrinciplePresentation,
  buildCanonicalPropagandaPresentation,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "./canonical-trees.js";

export type MediaPlpLiveCanonicalSource = {
  readonly SOURCE_FOUND: boolean;
  readonly SOURCE_PUBLIC: boolean;
  readonly CANONICAL_VERSION: string | null;
  readonly canonicalPresentation: PublicPresentationNode | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function empty(): MediaPlpLiveCanonicalSource {
  return {
    SOURCE_FOUND: false,
    SOURCE_PUBLIC: false,
    CANONICAL_VERSION: null,
    canonicalPresentation: null,
  };
}

function withTree(
  presentation: PublicPresentationNode,
  sourcePublic: boolean,
): MediaPlpLiveCanonicalSource {
  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: sourcePublic,
    CANONICAL_VERSION: fingerprintMediaPlpCanonicalVersion(presentation),
    canonicalPresentation: presentation,
  };
}

function resolvePrinciple(entityId: string): MediaPlpLiveCanonicalSource {
  const principle = CIVIC_MEDIA_SELECTION_PRINCIPLES.find((item) => item.id === entityId);
  if (!principle) {
    return empty();
  }
  return withTree(
    asMediaPlpPresentationNode(buildCanonicalPrinciplePresentation(principle)),
    true,
  );
}

async function resolveTrusted(entityId: string): Promise<MediaPlpLiveCanonicalSource> {
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
    return empty();
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

function resolveEditorial(entityId: string): MediaPlpLiveCanonicalSource {
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

function resolveFactCheck(entityId: string): MediaPlpLiveCanonicalSource {
  const resource = FACT_CHECK_RESOURCES.find((item) => item.id === entityId);
  if (!resource) {
    return empty();
  }
  return withTree(
    asMediaPlpPresentationNode(buildCanonicalFactCheckPresentation(resource)),
    true,
  );
}

function resolvePropaganda(entityId: string): MediaPlpLiveCanonicalSource {
  const resource = PROPAGANDA_ANALYSIS_RESOURCES.find((item) => item.id === entityId);
  if (!resource) {
    return empty();
  }
  return withTree(
    asMediaPlpPresentationNode(buildCanonicalPropagandaPresentation(resource)),
    true,
  );
}

export async function loadMediaPlpLiveCanonicalSource(input: {
  readonly entityType: MediaPlpEntityType;
  readonly entityId: string;
}): Promise<MediaPlpLiveCanonicalSource> {
  switch (input.entityType) {
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
    case MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS:
      // Consumer gate focuses on trusted/principles/editorial; news remains precomputed/canonical.
      return empty();
    default: {
      const _exhaustive: never = input.entityType;
      void _exhaustive;
      return empty();
    }
  }
}
