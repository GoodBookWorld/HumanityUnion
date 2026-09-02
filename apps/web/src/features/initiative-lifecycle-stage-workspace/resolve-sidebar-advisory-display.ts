/**
 * Pack 02G Task 08E.8a/08E.8b — resolve Working Sidebar advisory descriptors to display text.
 * Display-only. Does not parse English or mutate civic values.
 */

import type { InitiativeExperienceTranslator } from "../public-initiative-experience/initiative-experience-i18n";
import {
  ANALYSIS_ADVISORY_MESSAGE_KEY,
  isAnalysisSidebarAdvisoryCode,
  isProposalSidebarAdvisoryCode,
  isProposalSidebarFieldId,
  isProposalTreatmentSuggestionCode,
  PROPOSAL_ADVISORY_MESSAGE_KEY,
  type InitiativeSidebarAdvisory,
  type ProposalSidebarFieldId,
} from "./sidebar-advisory-contract";

export type SidebarAdvisoryPresentation = {
  readonly text: string;
  readonly code: string;
  readonly civic?: InitiativeSidebarAdvisory["civic"];
};

/**
 * Canonical Proposal field ID → localized label via author.proposal.fields.*.
 * Unknown → raw ID.
 */
export function resolveProposalSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isProposalSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.proposal.fields.${fieldId}`);
}

/**
 * Format Proposal field IDs as a localized, comma-joined list for ICU {fields}.
 */
export function formatProposalSidebarFieldLabels(
  fieldIds: readonly string[],
  t: InitiativeExperienceTranslator,
): string {
  return fieldIds.map((fieldId) => resolveProposalSidebarFieldDisplayLabel(fieldId, t)).join(", ");
}

/**
 * Stable treatment suggestion code → display label.
 * Reuses author.proposal.curation.* where semantics match Accept / Partially accept / Decline.
 * `review` uses advisories.proposal.treatments.review.
 * Unknown → raw code.
 */
export function resolveProposalTreatmentSuggestionDisplayLabel(
  suggestion: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isProposalTreatmentSuggestionCode(suggestion)) {
    return suggestion;
  }
  if (suggestion === "accept") {
    return t("author.proposal.curation.included_in_revision");
  }
  if (suggestion === "partially_accept") {
    return t("author.proposal.curation.keep_for_later");
  }
  if (suggestion === "decline") {
    return t("author.proposal.curation.not_applicable");
  }
  return t("author.sidebar.advisories.proposal.treatments.review");
}

function buildInterpolationValues(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  if (advisory.params) {
    for (const [key, value] of Object.entries(advisory.params)) {
      if (typeof value === "boolean") {
        values[key] = value ? "true" : "false";
      } else {
        values[key] = value;
      }
    }
  }
  // Analysis contradiction catalogs interpolate civic.subject as {topic}.
  if (advisory.civic?.subject != null) {
    values.topic = advisory.civic.subject;
  }
  // Proposal incomplete-treatment rationale interpolates localized field labels as {fields}.
  if (advisory.civic?.fieldIds && advisory.civic.fieldIds.length > 0) {
    values.fields = formatProposalSidebarFieldLabels(advisory.civic.fieldIds, t);
  }
  return values;
}

/**
 * Map a known Analysis/Proposal advisory code → localized text.
 * Defensive fallback for malformed/external codes: localized unknown label + raw code.
 */
export function resolveSidebarAdvisoryDisplay(
  advisory: InitiativeSidebarAdvisory,
  t: InitiativeExperienceTranslator,
): SidebarAdvisoryPresentation {
  const values = buildInterpolationValues(advisory, t);

  if (isAnalysisSidebarAdvisoryCode(advisory.code)) {
    const leaf = ANALYSIS_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.analysis.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isProposalSidebarAdvisoryCode(advisory.code)) {
    const leaf = PROPOSAL_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.proposal.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  return {
    text: t("author.sidebar.advisories.unknown", { code: advisory.code }),
    code: advisory.code,
    civic: advisory.civic,
  };
}

/** Type helper for incomplete proposal field ID arrays. */
export type { ProposalSidebarFieldId };
