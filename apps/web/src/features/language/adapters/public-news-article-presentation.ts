/**
 * Pack 08K.3 — Public news article → PublicPresentationNode adapter.
 *
 * Semantic card copy is AUTO_TRANSLATABLE (plain strings).
 * Publisher/source organization name is protectedIdentity (outlet identity).
 * URL / id / timestamps / image URLs are protectedTechnical.
 *
 * Unknown nested semantic fields remain plain strings → auto-collected by the
 * PublicLocalizedPresentation walker (no field-name allowlist).
 */

import type { PublicNewsArticleItem } from "@hu/types";
import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  protectedIdentity,
  protectedTechnical,
  unwrapPublicPresentationValue,
  type PublicLocalizedPresentation,
  type PublicPresentationNode,
  type PublicProtectedValue,
} from "@hu/types";

import {
  collectAutoTranslatableNodes,
  localizePublicPresentation,
} from "../public-localized-presentation.js";

export type PublicNewsArticlePresentationTree = {
  readonly id: PublicProtectedValue;
  readonly articleUrl: PublicProtectedValue;
  readonly imageUrl: PublicProtectedValue | null;
  readonly publishedAt: PublicProtectedValue;
  readonly sourceName: PublicProtectedValue;
  readonly verificationStatus: PublicProtectedValue;
  readonly title: string;
  readonly summary: string;
  readonly category: string;
  readonly geographicScope: PublicProtectedValue;
  /**
   * Extension bag for future nested semantic fields.
   * Plain strings auto-localize without allowlist edits.
   */
  readonly extensions?: Record<string, PublicPresentationNode>;
};

export function buildPublicNewsArticlePresentation(
  article: PublicNewsArticleItem & {
    readonly extensions?: Record<string, PublicPresentationNode>;
  },
): PublicNewsArticlePresentationTree {
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
    ...(article.extensions ? { extensions: article.extensions } : {}),
  };
}

export function asPublicNewsPresentationNode(
  presentation: PublicNewsArticlePresentationTree,
): PublicPresentationNode {
  return presentation as unknown as PublicPresentationNode;
}

export function readPublicNewsPresentationTitle(
  presentation: PublicNewsArticlePresentationTree | PublicPresentationNode,
): string {
  const tree = presentation as PublicNewsArticlePresentationTree;
  return typeof tree.title === "string" ? tree.title : "";
}

export function readPublicNewsPresentationSummary(
  presentation: PublicNewsArticlePresentationTree | PublicPresentationNode,
): string {
  const tree = presentation as PublicNewsArticlePresentationTree;
  return typeof tree.summary === "string" ? tree.summary : "";
}

export function readPublicNewsPresentationCategory(
  presentation: PublicNewsArticlePresentationTree | PublicPresentationNode,
): string {
  const tree = presentation as PublicNewsArticlePresentationTree;
  return typeof tree.category === "string" ? tree.category : "";
}

export function readPublicNewsProtectedSourceName(
  presentation: PublicNewsArticlePresentationTree | PublicPresentationNode,
): string {
  const tree = presentation as PublicNewsArticlePresentationTree;
  return unwrapPublicPresentationValue(tree.sourceName) ?? "";
}

export function readPublicNewsProtectedArticleUrl(
  presentation: PublicNewsArticlePresentationTree | PublicPresentationNode,
): string {
  const tree = presentation as PublicNewsArticlePresentationTree;
  return unwrapPublicPresentationValue(tree.articleUrl) ?? "";
}

export function readPublicNewsProtectedImageUrl(
  presentation: PublicNewsArticlePresentationTree | PublicPresentationNode,
): string | undefined {
  const tree = presentation as PublicNewsArticlePresentationTree;
  if (!tree.imageUrl) {
    return undefined;
  }
  return unwrapPublicPresentationValue(tree.imageUrl) ?? undefined;
}

export function readPublicNewsProtectedId(
  presentation: PublicNewsArticlePresentationTree | PublicPresentationNode,
): string {
  const tree = presentation as PublicNewsArticlePresentationTree;
  return unwrapPublicPresentationValue(tree.id) ?? "";
}

export function readPublicNewsProtectedPublishedAt(
  presentation: PublicNewsArticlePresentationTree | PublicPresentationNode,
): string {
  const tree = presentation as PublicNewsArticlePresentationTree;
  return unwrapPublicPresentationValue(tree.publishedAt) ?? "";
}

/**
 * Build complete localized presentation for a news article.
 * Provide `translations` path→string for non-source locales (fixtures / warm).
 */
export function localizePublicNewsArticlePresentation(input: {
  readonly article: PublicNewsArticleItem & {
    readonly extensions?: Record<string, PublicPresentationNode>;
  };
  readonly targetLanguage: string;
  readonly translations?: Readonly<Record<string, string>>;
}): PublicLocalizedPresentation {
  const presentation = asPublicNewsPresentationNode(
    buildPublicNewsArticlePresentation(input.article),
  );
  const sourceLanguage = input.article.language?.trim() || "en";
  return localizePublicPresentation({
    identity: {
      sourceKind: "public_news",
      sourceRecordId: input.article.id,
      presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
    },
    sourceLanguage,
    targetLanguage: input.targetLanguage,
    presentation,
    translations: input.translations,
  });
}

/** Deterministic fixture helper: prefix every auto node with [locale]. */
export function buildCompletePublicNewsFixtureTranslations(
  article: PublicNewsArticleItem & {
    readonly extensions?: Record<string, PublicPresentationNode>;
  },
  targetLanguage: string,
): Record<string, string> {
  const tree = asPublicNewsPresentationNode(buildPublicNewsArticlePresentation(article));
  const translations: Record<string, string> = {};
  for (const node of collectAutoTranslatableNodes(tree)) {
    translations[node.path] = `[${targetLanguage}] ${node.value}`;
  }
  return translations;
}
