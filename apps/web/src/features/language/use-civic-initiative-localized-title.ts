"use client";

/**
 * Pack 08I.15 — shared Initiative localized title boundary.
 * Public Choice and normal Initiative cards/rails must reuse this contract.
 */

import { useInitiativeCardTitlePresentation } from "../public-initiative-experience/use-initiative-public-presentation";

export function useCivicInitiativeLocalizedTitle(input: {
  readonly initiativeId: string;
  readonly canonicalTitle: string;
  readonly canonicalSummary?: string;
}): string {
  return useInitiativeCardTitlePresentation(input);
}
