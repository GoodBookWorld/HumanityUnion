/**
 * Pack 08K — Search result → PublicPresentationNode adapter.
 *
 * Semantic titles/summaries are AUTO_TRANSLATABLE.
 * Entity ids are protectedTechnical.
 *
 * Surfaces MUST pass this tree through Public Localization Boundary before render.
 */

import {
  protectedTechnical,
  unwrapPublicPresentationValue,
  type PublicPresentationNode,
  type PublicProtectedValue,
} from "@hu/types";

export interface SearchResultPresentationTree {
  readonly entityId: PublicProtectedValue;
  readonly title: string;
  readonly summary: string;
}

export function buildSearchResultPresentation(input: {
  readonly entityId: string;
  readonly title: string;
  readonly summary?: string | null;
}): SearchResultPresentationTree {
  return {
    entityId: protectedTechnical(input.entityId),
    title: input.title,
    summary: input.summary ?? "",
  };
}

/** Read participant-facing title from a (localized) search presentation tree. */
export function readSearchResultTitle(presentation: SearchResultPresentationTree): string {
  return presentation.title;
}

export function readSearchResultSummary(presentation: SearchResultPresentationTree): string {
  return presentation.summary;
}

export function readSearchResultEntityId(presentation: SearchResultPresentationTree): string {
  return unwrapPublicPresentationValue(presentation.entityId) ?? "";
}

/** Widen to PublicPresentationNode for localizePublicPresentation. */
export function asPublicPresentationNode(
  presentation: SearchResultPresentationTree,
): PublicPresentationNode {
  return presentation as unknown as PublicPresentationNode;
}
