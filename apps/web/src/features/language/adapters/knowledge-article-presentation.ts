/**
 * Pack 08K — Knowledge article → PublicPresentationNode adapter.
 *
 * Article semantic prose (title/purpose/overview/sections) is AUTO_TRANSLATABLE.
 * Slug / article id are protectedTechnical.
 *
 * Knowledge surfaces MUST use PublicLocalizedPresentation for semantic titles —
 * not raw canonical domain strings in governed render.
 */

import {
  protectedTechnical,
  unwrapPublicPresentationValue,
  type PublicPresentationNode,
  type PublicProtectedValue,
} from "@hu/types";

export interface KnowledgeArticlePresentationTree {
  readonly articleId: PublicProtectedValue;
  readonly slug: PublicProtectedValue;
  readonly title: string;
  readonly purpose: string;
  readonly overview: string;
  readonly keyConcepts: readonly string[];
  readonly explanation: readonly {
    readonly id: PublicProtectedValue;
    readonly heading: string;
    readonly body: string;
  }[];
}

export function buildKnowledgeArticlePresentation(input: {
  readonly articleId?: string;
  readonly slug: string;
  readonly title: string;
  readonly purpose?: string | null;
  readonly overview?: string | null;
  readonly keyConcepts?: readonly string[];
  readonly explanation?: readonly { id: string; heading: string; body: string }[];
}): KnowledgeArticlePresentationTree {
  return {
    articleId: protectedTechnical(input.articleId ?? input.slug),
    slug: protectedTechnical(input.slug),
    title: input.title,
    purpose: input.purpose ?? "",
    overview: input.overview ?? "",
    keyConcepts: input.keyConcepts ?? [],
    explanation: (input.explanation ?? []).map((section) => ({
      id: protectedTechnical(section.id),
      heading: section.heading,
      body: section.body,
    })),
  };
}

export function readKnowledgeArticleTitle(presentation: KnowledgeArticlePresentationTree): string {
  return presentation.title;
}

export function readKnowledgeArticleSlug(presentation: KnowledgeArticlePresentationTree): string {
  return unwrapPublicPresentationValue(presentation.slug) ?? "";
}

export function asPublicPresentationNode(
  presentation: KnowledgeArticlePresentationTree,
): PublicPresentationNode {
  return presentation as unknown as PublicPresentationNode;
}
