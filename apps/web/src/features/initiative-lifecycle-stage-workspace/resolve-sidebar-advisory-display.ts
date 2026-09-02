/**
 * Pack 02G Task 08E.8a/08E.8b/08E.8c — resolve Working Sidebar advisory descriptors to display text.
 * Display-only. Does not parse English or mutate civic values.
 * API opaque intelligence details bypass this resolver entirely.
 */

import type { InitiativeExperienceTranslator } from "../public-initiative-experience/initiative-experience-i18n";
import {
  ANALYSIS_ADVISORY_MESSAGE_KEY,
  isAnalysisSidebarAdvisoryCode,
  isPetitionSidebarAdvisoryCode,
  isPetitionSidebarFieldId,
  isProposalSidebarAdvisoryCode,
  isProposalSidebarFieldId,
  isProposalTreatmentSuggestionCode,
  isRevisionSidebarAdvisoryCode,
  PETITION_ADVISORY_MESSAGE_KEY,
  PROPOSAL_ADVISORY_MESSAGE_KEY,
  REVISION_ADVISORY_MESSAGE_KEY,
  type InitiativeSidebarAdvisory,
  type PetitionSidebarFieldId,
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
 * Canonical Petition field ID → localized label via author.petition.fields.*.
 * Unknown → raw ID.
 */
export function resolvePetitionSidebarFieldDisplayLabel(
  fieldId: string,
  t: InitiativeExperienceTranslator,
): string {
  if (!isPetitionSidebarFieldId(fieldId)) {
    return fieldId;
  }
  return t(`author.petition.fields.${fieldId}`);
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
  // Revision/Petition alignment catalogs interpolate civic.title as {title}.
  if (advisory.civic?.title != null) {
    values.title = advisory.civic.title;
  }
  // Proposal incomplete-treatment rationale interpolates localized field labels as {fields}.
  if (advisory.civic?.fieldIds && advisory.civic.fieldIds.length > 0) {
    values.fields = formatProposalSidebarFieldLabels(advisory.civic.fieldIds, t);
  }
  // Petition clarity/context advisories may interpolate a single localized field label as {field}.
  if (advisory.civic?.petitionFieldIds && advisory.civic.petitionFieldIds.length > 0) {
    const first = advisory.civic.petitionFieldIds[0]!;
    values.field = resolvePetitionSidebarFieldDisplayLabel(first, t);
  }
  return values;
}

/**
 * Map a known Analysis/Proposal/Revision/Petition advisory code → localized text.
 * Defensive fallback for malformed/external codes: localized unknown label + raw code.
 * API opaque intelligence details must not pass through this resolver.
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

  if (isRevisionSidebarAdvisoryCode(advisory.code)) {
    const leaf = REVISION_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.revision.${leaf}`, values),
      code: advisory.code,
      civic: advisory.civic,
    };
  }

  if (isPetitionSidebarAdvisoryCode(advisory.code)) {
    const leaf = PETITION_ADVISORY_MESSAGE_KEY[advisory.code];
    return {
      text: t(`author.sidebar.advisories.petition.${leaf}`, values),
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

/** Type helpers for incomplete proposal / petition field ID arrays. */
export type { ProposalSidebarFieldId, PetitionSidebarFieldId };
