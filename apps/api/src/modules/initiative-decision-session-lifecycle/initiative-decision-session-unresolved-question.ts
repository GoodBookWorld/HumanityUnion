/**
 * Pack 02G Task 08E.9c — Decision Session draft unresolved-question adapter.
 *
 * Maps semantic consistency checks to API-owned canonical English draft
 * strings. This is DOCUMENT/DRAFT CONTENT, not UI localization.
 * Must not import Web catalogs / next-intl or parse check.detail.
 */

import type { InitiativeDecisionSessionConsistencyCheck } from "@hu/types";

/**
 * Produce one unresolved-question string from a warning-status consistency
 * check using checkId + params/civic only. Returns null when the check
 * should not contribute a draft question.
 */
export function formatDecisionSessionUnresolvedQuestionFromCheck(
  check: InitiativeDecisionSessionConsistencyCheck,
): string | null {
  if (check.status !== "warning") {
    return null;
  }

  switch (check.checkId) {
    case "petition-available":
      return "No published Petition yet — Decision Session can use Initiative / Analysis / Proposal context instead.";
    case "revision-available":
      return "No published Revision is available for traceability.";
    case "analysis-available":
      return "No published Collaborative Analysis is available.";
    case "proposal-references":
      return "No accepted Improvement Proposals are referenced yet.";
    case "ally-recommendations":
      // Always status "ok" in the producer; keep exhaustive for safety.
      return null;
    default: {
      const _exhaustive: never = check.checkId;
      void _exhaustive;
      return null;
    }
  }
}
