/**
 * Reset 03 — canonical Media semantic presentation trees for PLP.
 * Complete participant-facing trees; protected identity/technical remain wrapped.
 */

import type {
  CivicMediaSelectionPrinciple,
  PublicNewsArticleItem,
  PublicPresentationNode,
  TrustedMediaResource,
} from "@hu/types";
import { protectedIdentity, protectedTechnical } from "@hu/types";

import { fingerprintPublicPresentation } from "../../public-localized-presentation.js";

export type MediaPlpPublicNewsTree = {
  readonly id: ReturnType<typeof protectedTechnical>;
  readonly articleUrl: ReturnType<typeof protectedTechnical>;
  readonly imageUrl: ReturnType<typeof protectedTechnical> | null;
  readonly publishedAt: ReturnType<typeof protectedTechnical>;
  readonly sourceName: ReturnType<typeof protectedIdentity>;
  readonly verificationStatus: ReturnType<typeof protectedTechnical>;
  readonly title: string;
  readonly summary: string;
  readonly category: string;
  readonly geographicScope: ReturnType<typeof protectedTechnical>;
};

export type MediaPlpPrincipleTree = {
  readonly title: string;
  readonly description: string;
};

export type MediaPlpTrustedTree = {
  readonly name: ReturnType<typeof protectedIdentity>;
  readonly websiteUrl: ReturnType<typeof protectedTechnical>;
  readonly explanation: string;
};

export function buildCanonicalPublicNewsPresentation(
  article: PublicNewsArticleItem,
): MediaPlpPublicNewsTree {
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

export function buildCanonicalPrinciplePresentation(
  principle: CivicMediaSelectionPrinciple,
): MediaPlpPrincipleTree {
  return {
    title: principle.title,
    description: principle.description,
  };
}

export function buildCanonicalTrustedPresentation(
  resource: TrustedMediaResource,
): MediaPlpTrustedTree {
  return {
    name: protectedIdentity(resource.name),
    websiteUrl: protectedTechnical(resource.websiteUrl),
    explanation: resource.explanation,
  };
}

export function asMediaPlpPresentationNode(
  tree: MediaPlpPublicNewsTree | MediaPlpPrincipleTree | MediaPlpTrustedTree,
): PublicPresentationNode {
  return tree as unknown as PublicPresentationNode;
}

/** Semantic-only canonicalVersion (ignores wall-clock updatedAt). */
export function fingerprintMediaPlpCanonicalVersion(
  tree: PublicPresentationNode,
): string {
  return fingerprintPublicPresentation(tree);
}
