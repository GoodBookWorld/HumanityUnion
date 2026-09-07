/**
 * Reset 03 — canonical Media semantic presentation trees for PLP.
 * Complete participant-facing trees; protected identity/technical remain wrapped.
 * Reset 03E — civic_media_editorial tree (overview + FAQ).
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
import { controlledTerminologyValue, protectedIdentity, protectedTechnical } from "@hu/types";

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
  /**
   * MediaRegistryCategory key — CONTROLLED_VOCABULARY (not Gemini AUTO).
   * Localized via UI dictionary on the card; must not be plain AUTO string.
   */
  readonly category: ReturnType<typeof controlledTerminologyValue>;
  readonly geographicScope: ReturnType<typeof protectedTechnical>;
};

export type MediaPlpPrincipleTree = {
  readonly title: string;
  readonly description: string;
  readonly whyItMatters: string;
};

export type MediaPlpTrustedTree = {
  readonly name: ReturnType<typeof protectedIdentity>;
  readonly websiteUrl: ReturnType<typeof protectedTechnical>;
  readonly explanation: string;
};

export type MediaPlpFactCheckTree = {
  readonly name: ReturnType<typeof protectedIdentity>;
  readonly websiteUrl: ReturnType<typeof protectedTechnical>;
  readonly mission: string;
  readonly coverage: string;
};

export type MediaPlpPropagandaTree = {
  readonly name: ReturnType<typeof protectedIdentity>;
  readonly websiteUrl: ReturnType<typeof protectedTechnical>;
  readonly focus: string;
  readonly explanation: string;
};

/** Overview + FAQ semantic tree (initiative-flow UX stays UI dictionary). */
export type MediaPlpEditorialTree = {
  readonly overviewTitle: string;
  readonly overviewSummary: string;
  readonly overviewPoints: readonly {
    readonly id: string;
    readonly heading: string;
    readonly body: string;
  }[];
  readonly faq: readonly {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
  }[];
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
    category: controlledTerminologyValue(article.category ?? ""),
    geographicScope: protectedTechnical(article.geographicScope ?? ""),
  };
}

export function buildCanonicalPrinciplePresentation(
  principle: CivicMediaSelectionPrinciple,
): MediaPlpPrincipleTree {
  return {
    title: principle.title,
    description: principle.description,
    whyItMatters: principle.whyItMatters ?? "",
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

export function buildCanonicalFactCheckPresentation(
  resource: FactCheckResource,
): MediaPlpFactCheckTree {
  return {
    name: protectedIdentity(resource.name),
    websiteUrl: protectedTechnical(resource.websiteUrl),
    mission: resource.mission,
    coverage: resource.coverage,
  };
}

export function buildCanonicalPropagandaPresentation(
  resource: PropagandaAnalysisResource,
): MediaPlpPropagandaTree {
  return {
    name: protectedIdentity(resource.name),
    websiteUrl: protectedTechnical(resource.websiteUrl),
    focus: resource.focus,
    explanation: resource.explanation,
  };
}

export function buildCanonicalEditorialPresentation(
  media: Pick<CivicMediaCenterPublic, "overview" | "faq">,
): MediaPlpEditorialTree {
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

export function asMediaPlpPresentationNode(
  tree:
    | MediaPlpPublicNewsTree
    | MediaPlpPrincipleTree
    | MediaPlpTrustedTree
    | MediaPlpEditorialTree
    | MediaPlpFactCheckTree
    | MediaPlpPropagandaTree,
): PublicPresentationNode {
  return tree as unknown as PublicPresentationNode;
}

/** Semantic-only canonicalVersion (ignores wall-clock updatedAt). */
export function fingerprintMediaPlpCanonicalVersion(
  tree: PublicPresentationNode,
): string {
  return fingerprintPublicPresentation(tree);
}
