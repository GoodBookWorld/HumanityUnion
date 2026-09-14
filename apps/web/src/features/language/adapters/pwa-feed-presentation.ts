/**
 * Pack 08K — PWA initiative feed → PublicPresentationNode adapter.
 *
 * Feed item titles / explanations / context are AUTO_TRANSLATABLE semantic prose.
 * Initiative ids are protectedTechnical.
 *
 * PWA feed MUST import and use the public localization boundary for semantic titles.
 */

import {
  protectedTechnical,
  unwrapPublicPresentationValue,
  type PublicPresentationNode,
  type PublicProtectedValue,
} from "@hu/types";

export interface PwaFeedItemPresentationTree {
  readonly initiativeId: PublicProtectedValue;
  readonly title: string;
  readonly context: string;
  readonly explanation: string;
}

export function buildPwaFeedItemPresentation(input: {
  readonly initiativeId: string;
  readonly title: string;
  readonly context?: string | null;
  readonly explanation?: string | null;
}): PwaFeedItemPresentationTree {
  return {
    initiativeId: protectedTechnical(input.initiativeId),
    title: input.title,
    context: input.context ?? "",
    explanation: input.explanation ?? "",
  };
}

export function readPwaFeedItemTitle(presentation: PwaFeedItemPresentationTree): string {
  return presentation.title;
}

export function readPwaFeedInitiativeId(presentation: PwaFeedItemPresentationTree): string {
  return unwrapPublicPresentationValue(presentation.initiativeId) ?? "";
}

export function asPublicPresentationNode(
  presentation: PwaFeedItemPresentationTree,
): PublicPresentationNode {
  return presentation as unknown as PublicPresentationNode;
}
