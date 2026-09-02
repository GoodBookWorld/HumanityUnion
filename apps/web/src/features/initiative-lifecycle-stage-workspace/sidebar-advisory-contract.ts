/**
 * Pack 02G Task 08E.8a/08E.8b/08E.8c — Web-local Working Sidebar advisory descriptors.
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
 * Canonical Petition draft field IDs used by clarity/context advisories (08E.8c).
 * Matches InitiativePetitionDraft keys actually checked by derive.
 */
export type PetitionSidebarFieldId =
  | "title"
  | "requestStatement"
  | "expectedOutcome"
  | "supportingContext"
  | "keyArguments";

export const PETITION_SIDEBAR_FIELD_IDS: readonly PetitionSidebarFieldId[] = [
  "title",
  "requestStatement",
  "expectedOutcome",
  "supportingContext",
  "keyArguments",
] as const;

/**
 * Civic/data payload — only fields used by migrated Analysis/Proposal/Revision/Petition slices.
 * Analysis: subject. Proposal: fieldIds. Revision/Petition alignment: title.
 * Petition clarity/context: petitionFieldIds.
 */
export type InitiativeSidebarAdvisoryCivic = {
  readonly subject?: string;
  readonly fieldIds?: readonly ProposalSidebarFieldId[];
  /** Civic Analysis / related title for alignment advisories (not a catalog key). */
  readonly title?: string;
  readonly petitionFieldIds?: readonly PetitionSidebarFieldId[];
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

/** Exact Revision-stage Web-deterministic advisory codes (08E.8c). */
export type RevisionSidebarAdvisoryCode =
  | "revision.sources.summary"
  | "revision.sources.empty"
  | "revision.alignment.with_analysis"
  | "revision.alignment.no_analysis";

export type RevisionSidebarAdvisory = InitiativeSidebarAdvisory<RevisionSidebarAdvisoryCode>;

/** Exact Petition-stage Web-deterministic advisory codes (08E.8c). */
export type PetitionSidebarAdvisoryCode =
  | "petition.sources.summary"
  | "petition.sources.empty"
  | "petition.alignment.with_analysis"
  | "petition.alignment.no_analysis"
  | "petition.clarity.title_empty"
  | "petition.clarity.request_statement_short"
  | "petition.clarity.expected_outcome_empty"
  | "petition.context.supporting_context_empty"
  | "petition.context.key_arguments_empty";

export type PetitionSidebarAdvisory = InitiativeSidebarAdvisory<PetitionSidebarAdvisoryCode>;

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

/** Catalog leaf under author.sidebar.advisories.revision.* */
export const REVISION_ADVISORY_MESSAGE_KEY: Record<RevisionSidebarAdvisoryCode, string> = {
  "revision.sources.summary": "sourcesSummary",
  "revision.sources.empty": "sourcesEmpty",
  "revision.alignment.with_analysis": "alignmentWithAnalysis",
  "revision.alignment.no_analysis": "alignmentNoAnalysis",
};

/** Catalog leaf under author.sidebar.advisories.petition.* */
export const PETITION_ADVISORY_MESSAGE_KEY: Record<PetitionSidebarAdvisoryCode, string> = {
  "petition.sources.summary": "sourcesSummary",
  "petition.sources.empty": "sourcesEmpty",
  "petition.alignment.with_analysis": "alignmentWithAnalysis",
  "petition.alignment.no_analysis": "alignmentNoAnalysis",
  "petition.clarity.title_empty": "clarityTitleEmpty",
  "petition.clarity.request_statement_short": "clarityRequestStatementShort",
  "petition.clarity.expected_outcome_empty": "clarityExpectedOutcomeEmpty",
  "petition.context.supporting_context_empty": "contextSupportingContextEmpty",
  "petition.context.key_arguments_empty": "contextKeyArgumentsEmpty",
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

export function isRevisionSidebarAdvisoryCode(
  code: string,
): code is RevisionSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(REVISION_ADVISORY_MESSAGE_KEY, code);
}

export function isPetitionSidebarAdvisoryCode(
  code: string,
): code is PetitionSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(PETITION_ADVISORY_MESSAGE_KEY, code);
}

export function isProposalSidebarFieldId(value: string): value is ProposalSidebarFieldId {
  return (PROPOSAL_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isPetitionSidebarFieldId(value: string): value is PetitionSidebarFieldId {
  return (PETITION_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isProposalTreatmentSuggestionCode(
  value: string,
): value is ProposalTreatmentSuggestionCode {
  return (PROPOSAL_TREATMENT_SUGGESTION_CODES as readonly string[]).includes(value);
}
