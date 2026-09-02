/**
 * Pack 02G Task 08E.8a/08E.8b — Web-local Working Sidebar advisory descriptors.
 * Language-neutral codes + civic payloads. Presentation owns localized prose.
 * Not part of @hu/types (Web presentation architecture).
 */

export type SidebarAdvisorySeverity = "info" | "warning" | "critical";

/** Canonical Proposal field IDs used by incomplete-proposal advisories (08E.8b). */
export type ProposalSidebarFieldId =
  | "title"
  | "summary"
  | "description"
  | "reason"
  | "expectedImprovement";

export const PROPOSAL_SIDEBAR_FIELD_IDS: readonly ProposalSidebarFieldId[] = [
  "title",
  "summary",
  "description",
  "reason",
  "expectedImprovement",
] as const;

export type ProposalTreatmentSuggestionCode =
  | "accept"
  | "partially_accept"
  | "decline"
  | "review";

export const PROPOSAL_TREATMENT_SUGGESTION_CODES: readonly ProposalTreatmentSuggestionCode[] = [
  "accept",
  "partially_accept",
  "decline",
  "review",
] as const;

/**
 * Civic/data payload — only fields used by migrated Analysis/Proposal slices.
 * Analysis: subject. Proposal: fieldIds (+ subject reserved unused).
 */
export type InitiativeSidebarAdvisoryCivic = {
  readonly subject?: string;
  readonly fieldIds?: readonly ProposalSidebarFieldId[];
};

export type InitiativeSidebarAdvisory<Code extends string = string> = {
  readonly code: Code;
  readonly severity?: SidebarAdvisorySeverity;
  readonly params?: Readonly<Record<string, string | number | boolean>>;
  readonly civic?: InitiativeSidebarAdvisoryCivic;
};

/** Exact Analysis-stage advisory codes (08E.8a). No open `| string`. */
export type AnalysisSidebarAdvisoryCode =
  | "analysis.sources.summary"
  | "analysis.sources.empty"
  | "analysis.missing_helpful_sources"
  | "analysis.missing_not_helpful_sources"
  | "analysis.missing_proposal_candidates"
  | "analysis.missing_open_questions"
  | "analysis.text_overlap_contradiction";

export type AnalysisSidebarAdvisory = InitiativeSidebarAdvisory<AnalysisSidebarAdvisoryCode>;

/** Exact Proposal-stage advisory codes (08E.8b). No open `| string`. */
export type ProposalSidebarAdvisoryCode =
  | "proposal.sources.summary"
  | "proposal.sources.empty"
  | "proposal.treatment.rationale.review_incomplete"
  | "proposal.treatment.rationale.accept_clear"
  | "proposal.treatment.rationale.partially_accept_limited"
  | "proposal.treatment.rationale.decline_limited";

export type ProposalSidebarAdvisory = InitiativeSidebarAdvisory<ProposalSidebarAdvisoryCode>;

/** Catalog leaf under author.sidebar.advisories.analysis.* */
export const ANALYSIS_ADVISORY_MESSAGE_KEY: Record<AnalysisSidebarAdvisoryCode, string> = {
  "analysis.sources.summary": "sourcesSummary",
  "analysis.sources.empty": "sourcesEmpty",
  "analysis.missing_helpful_sources": "missingHelpfulSources",
  "analysis.missing_not_helpful_sources": "missingNotHelpfulSources",
  "analysis.missing_proposal_candidates": "missingProposalCandidates",
  "analysis.missing_open_questions": "missingOpenQuestions",
  "analysis.text_overlap_contradiction": "textOverlapContradiction",
};

/** Catalog leaf under author.sidebar.advisories.proposal.* */
export const PROPOSAL_ADVISORY_MESSAGE_KEY: Record<ProposalSidebarAdvisoryCode, string> = {
  "proposal.sources.summary": "sourcesSummary",
  "proposal.sources.empty": "sourcesEmpty",
  "proposal.treatment.rationale.review_incomplete": "rationaleReviewIncomplete",
  "proposal.treatment.rationale.accept_clear": "rationaleAcceptClear",
  "proposal.treatment.rationale.partially_accept_limited": "rationalePartiallyAcceptLimited",
  "proposal.treatment.rationale.decline_limited": "rationaleDeclineLimited",
};

export function isAnalysisSidebarAdvisoryCode(
  code: string,
): code is AnalysisSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(ANALYSIS_ADVISORY_MESSAGE_KEY, code);
}

export function isProposalSidebarAdvisoryCode(
  code: string,
): code is ProposalSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(PROPOSAL_ADVISORY_MESSAGE_KEY, code);
}

export function isProposalSidebarFieldId(value: string): value is ProposalSidebarFieldId {
  return (PROPOSAL_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isProposalTreatmentSuggestionCode(
  value: string,
): value is ProposalTreatmentSuggestionCode {
  return (PROPOSAL_TREATMENT_SUGGESTION_CODES as readonly string[]).includes(value);
}
