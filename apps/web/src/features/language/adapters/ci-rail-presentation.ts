/**
 * Pack 08K — Community Intelligence rail → PublicPresentationNode adapter.
 *
 * Collaboration / overlap / related-rail titles and summaries are AUTO_TRANSLATABLE.
 * Initiative / opportunity ids are protectedTechnical.
 *
 * CI rails MUST use PublicLocalizedPresentation for semantic titles.
 */

import {
  protectedTechnical,
  unwrapPublicPresentationValue,
  type PublicPresentationNode,
  type PublicProtectedValue,
} from "@hu/types";

export interface CiRailPresentationTree {
  readonly recordId: PublicProtectedValue;
  readonly title: string;
  readonly summary: string;
}

export function buildCiRailPresentation(input: {
  readonly recordId: string;
  readonly title: string;
  readonly summary?: string | null;
}): CiRailPresentationTree {
  return {
    recordId: protectedTechnical(input.recordId),
    title: input.title,
    summary: input.summary ?? "",
  };
}

export function readCiRailTitle(presentation: CiRailPresentationTree): string {
  return presentation.title;
}

export function readCiRailSummary(presentation: CiRailPresentationTree): string {
  return presentation.summary;
}

export function readCiRailRecordId(presentation: CiRailPresentationTree): string {
  return unwrapPublicPresentationValue(presentation.recordId) ?? "";
}

export function asPublicPresentationNode(
  presentation: CiRailPresentationTree,
): PublicPresentationNode {
  return presentation as unknown as PublicPresentationNode;
}
