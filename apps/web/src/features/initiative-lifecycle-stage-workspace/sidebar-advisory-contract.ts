/**
 * Pack 02G Task 08E.8a–08E.8e — Web-local Working Sidebar advisory descriptors.
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
 * Decision Session catalog field IDs used by deterministic advisories (08E.8d).
 * Maps to author.decisionSession.fields.*.
 */
export type DecisionSessionSidebarFieldId =
  | "question"
  | "options"
  | "arguments"
  | "risks"
  | "timeline"
  | "roles";

export const DECISION_SESSION_SIDEBAR_FIELD_IDS: readonly DecisionSessionSidebarFieldId[] = [
  "question",
  "options",
  "arguments",
  "risks",
  "timeline",
  "roles",
] as const;

/**
 * Collective Decision catalog field IDs used by deterministic advisories (08E.8d).
 * Maps to author.collectiveDecision.fields.*.
 */
export type CollectiveDecisionSidebarFieldId =
  | "summary"
  | "approvedActions"
  | "roles"
  | "timeline"
  | "rationale"
  | "risks"
  | "criteria";

export const COLLECTIVE_DECISION_SIDEBAR_FIELD_IDS: readonly CollectiveDecisionSidebarFieldId[] = [
  "summary",
  "approvedActions",
  "roles",
  "timeline",
  "rationale",
  "risks",
  "criteria",
] as const;

/**
 * Implementation Commitment catalog field IDs (08E.8e).
 * Maps to author.commitment.fields.*.
 */
export type ImplementationCommitmentSidebarFieldId = "title" | "summary";

export const IMPLEMENTATION_COMMITMENT_SIDEBAR_FIELD_IDS: readonly ImplementationCommitmentSidebarFieldId[] =
  ["title", "summary"] as const;

/**
 * Implementation Tracking catalog field IDs (08E.8e).
 * Maps to author.tracking.fields.*.
 */
export type ImplementationTrackingSidebarFieldId = "title" | "summary";

export const IMPLEMENTATION_TRACKING_SIDEBAR_FIELD_IDS: readonly ImplementationTrackingSidebarFieldId[] =
  ["title", "summary"] as const;

/**
 * Official Response catalog field IDs (08E.8f).
 * Maps to author.officialResponse.fields.*.
 */
export type OfficialResponseSidebarFieldId = "title" | "summary";

export const OFFICIAL_RESPONSE_SIDEBAR_FIELD_IDS: readonly OfficialResponseSidebarFieldId[] = [
  "title",
  "summary",
] as const;

/**
 * Public Impact catalog field IDs (08E.8f).
 * Maps to author.publicImpact.fields.*.
 */
export type PublicImpactSidebarFieldId = "title";

export const PUBLIC_IMPACT_SIDEBAR_FIELD_IDS: readonly PublicImpactSidebarFieldId[] = [
  "title",
] as const;

/**
 * Canonical Public Impact section IDs for untitled-section advisories.
 * Maps to author.publicImpact.sections.*.
 */
export type PublicImpactSidebarSectionId =
  | "executive_summary"
  | "objectives"
  | "implemented_actions"
  | "completed_commitments"
  | "implementation_progress"
  | "official_responses"
  | "community_participation"
  | "outstanding_issues"
  | "lessons_learned"
  | "evidence"
  | "impact_references";

export const PUBLIC_IMPACT_SIDEBAR_SECTION_IDS: readonly PublicImpactSidebarSectionId[] = [
  "executive_summary",
  "objectives",
  "implemented_actions",
  "completed_commitments",
  "implementation_progress",
  "official_responses",
  "community_participation",
  "outstanding_issues",
  "lessons_learned",
  "evidence",
  "impact_references",
] as const;

/**
 * Civic Archive catalog field IDs (08E.8f).
 * Maps to author.archive.fields.*.
 */
export type CivicArchiveSidebarFieldId =
  | "finalArchiveTitle"
  | "finalSummary"
  | "lessonsLearned"
  | "knowledgeContribution";

export const CIVIC_ARCHIVE_SIDEBAR_FIELD_IDS: readonly CivicArchiveSidebarFieldId[] = [
  "finalArchiveTitle",
  "finalSummary",
  "lessonsLearned",
  "knowledgeContribution",
] as const;

/**
 * Civic/data payload — only fields used by migrated Analysis→Archive slices.
 */
export type InitiativeSidebarAdvisoryCivic = {
  readonly subject?: string;
  readonly fieldIds?: readonly ProposalSidebarFieldId[];
  /** Civic Analysis / related title for alignment advisories (not a catalog key). */
  readonly title?: string;
  /** Civic suggested/responsible role text (Commitment overload advisories). */
  readonly role?: string;
  /** Truncated civic body excerpt for PI duplicate-claim advisories. */
  readonly excerpt?: string;
  /** Civic Tracking package/source label (Archive sources fragment). */
  readonly trackingTitle?: string;
  readonly petitionFieldIds?: readonly PetitionSidebarFieldId[];
  readonly decisionSessionFieldIds?: readonly DecisionSessionSidebarFieldId[];
  readonly collectiveDecisionFieldIds?: readonly CollectiveDecisionSidebarFieldId[];
  readonly implementationCommitmentFieldIds?: readonly ImplementationCommitmentSidebarFieldId[];
  readonly implementationTrackingFieldIds?: readonly ImplementationTrackingSidebarFieldId[];
  readonly officialResponseFieldIds?: readonly OfficialResponseSidebarFieldId[];
  readonly publicImpactFieldIds?: readonly PublicImpactSidebarFieldId[];
  readonly publicImpactSectionId?: PublicImpactSidebarSectionId;
  readonly civicArchiveFieldIds?: readonly CivicArchiveSidebarFieldId[];
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

/** Exact Decision Session Web-deterministic advisory codes (08E.8d). */
export type DecisionSessionSidebarAdvisoryCode =
  | "decision_session.sources.summary"
  | "decision_session.sources.empty"
  | "decision_session.options.petition_required"
  | "decision_session.options.need_two"
  | "decision_session.options.duplicated"
  | "decision_session.arguments.none"
  | "decision_session.risks.none"
  | "decision_session.feasibility.timeline_empty"
  | "decision_session.feasibility.roles_none"
  | "decision_session.clarity.question_unclear";

export type DecisionSessionSidebarAdvisory =
  InitiativeSidebarAdvisory<DecisionSessionSidebarAdvisoryCode>;

/** Exact Collective Decision Web-deterministic advisory codes (08E.8d). */
export type CollectiveDecisionSidebarAdvisoryCode =
  | "collective_decision.sources.summary"
  | "collective_decision.sources.empty"
  | "collective_decision.actions.need_one"
  | "collective_decision.actions.duplicated"
  | "collective_decision.roles.none"
  | "collective_decision.timeline.empty"
  | "collective_decision.risks.none"
  | "collective_decision.criteria.none"
  | "collective_decision.rationale.empty"
  | "collective_decision.clarity.summary_unclear";

export type CollectiveDecisionSidebarAdvisory =
  InitiativeSidebarAdvisory<CollectiveDecisionSidebarAdvisoryCode>;

/** Exact Implementation Commitment Web-deterministic advisory codes (08E.8e). */
export type ImplementationCommitmentSidebarAdvisoryCode =
  | "implementation_commitment.sources.summary"
  | "implementation_commitment.sources.empty"
  | "implementation_commitment.unassigned.decision_required"
  | "implementation_commitment.unassigned.no_candidates"
  | "implementation_commitment.unassigned.missing_participants"
  | "implementation_commitment.roles.overloaded"
  | "implementation_commitment.resources.missing"
  | "implementation_commitment.timeline.missing"
  | "implementation_commitment.risks.missing"
  | "implementation_commitment.clarity.title_empty"
  | "implementation_commitment.clarity.summary_empty";

export type ImplementationCommitmentSidebarAdvisory =
  InitiativeSidebarAdvisory<ImplementationCommitmentSidebarAdvisoryCode>;

/** Exact Implementation Tracking Web-deterministic advisory codes (08E.8e). */
export type ImplementationTrackingSidebarAdvisoryCode =
  | "implementation_tracking.sources.summary"
  | "implementation_tracking.sources.empty"
  | "implementation_tracking.overdue.count"
  | "implementation_tracking.blocked.count"
  | "implementation_tracking.evidence.missing_at_complete"
  | "implementation_tracking.stalled.not_started"
  | "implementation_tracking.timeline.missing_target_date"
  | "implementation_tracking.clarity.unassigned"
  | "implementation_tracking.clarity.title_empty"
  | "implementation_tracking.clarity.summary_empty";

export type ImplementationTrackingSidebarAdvisory =
  InitiativeSidebarAdvisory<ImplementationTrackingSidebarAdvisoryCode>;

/** Exact Official Response Web-deterministic advisory codes (08E.8f). */
export type OfficialResponseSidebarAdvisoryCode =
  | "official_response.sources.summary"
  | "official_response.sources.empty"
  | "official_response.incomplete.no_candidates"
  | "official_response.incomplete.summary_empty"
  | "official_response.incomplete.summary_empty_untitled"
  | "official_response.duplicate.subject"
  | "official_response.institution.missing"
  | "official_response.institution.missing_untitled"
  | "official_response.reference.unlinked"
  | "official_response.reference.unlinked_untitled"
  | "official_response.reference.no_evidence"
  | "official_response.reference.no_evidence_untitled"
  | "official_response.summary.unsupported"
  | "official_response.summary.unsupported_untitled"
  | "official_response.date.future_received"
  | "official_response.date.future_received_untitled"
  | "official_response.clarity.no_response_note"
  | "official_response.clarity.title_empty"
  | "official_response.clarity.summary_empty"
  | "official_response.note.no_response_outcome"
  | "official_response.note.advisory_only";

export type OfficialResponseSidebarAdvisory =
  InitiativeSidebarAdvisory<OfficialResponseSidebarAdvisoryCode>;

/** Exact Public Impact Web-deterministic advisory codes (08E.8f). */
export type PublicImpactSidebarAdvisoryCode =
  | "public_impact.sources.summary"
  | "public_impact.sources.empty"
  | "public_impact.evidence.package_required"
  | "public_impact.evidence.none_visible"
  | "public_impact.evidence.section_empty"
  | "public_impact.conclusion.unsupported"
  | "public_impact.stats.inconsistent"
  | "public_impact.claims.duplicated"
  | "public_impact.institution.missing_name"
  | "public_impact.institution.missing_summary"
  | "public_impact.clarity.no_sections"
  | "public_impact.clarity.title_empty"
  | "public_impact.clarity.judgment_wording"
  | "public_impact.note.no_response_outcome"
  | "public_impact.note.low_completion"
  | "public_impact.note.advisory_only";

export type PublicImpactSidebarAdvisory =
  InitiativeSidebarAdvisory<PublicImpactSidebarAdvisoryCode>;

/** Exact Civic Archive Web-deterministic advisory codes (08E.8f). */
export type CivicArchiveSidebarAdvisoryCode =
  | "civic_archive.sources.summary"
  | "civic_archive.sources.empty"
  | "civic_archive.completeness.missing_optional_stages"
  | "civic_archive.fields.title_empty"
  | "civic_archive.fields.summary_empty"
  | "civic_archive.fields.lessons_empty"
  | "civic_archive.fields.knowledge_empty"
  | "civic_archive.outstanding.unresolved_tracking"
  | "civic_archive.outstanding.unfinished_commitments"
  | "civic_archive.neutrality.judgment_wording"
  | "civic_archive.clarity.no_response_outcome"
  | "civic_archive.clarity.advisory_only"
  | "civic_archive.clarity.no_sections";

export type CivicArchiveSidebarAdvisory =
  InitiativeSidebarAdvisory<CivicArchiveSidebarAdvisoryCode>;

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

/**
 * Catalog leaf under author.sidebar.advisories.decisionSession.*.
 * sources.summary is assembled from sources.* fragments in the resolver.
 */
export const DECISION_SESSION_ADVISORY_MESSAGE_KEY: Record<
  DecisionSessionSidebarAdvisoryCode,
  string
> = {
  "decision_session.sources.summary": "sourcesSummary",
  "decision_session.sources.empty": "sourcesEmpty",
  "decision_session.options.petition_required": "optionsPetitionRequired",
  "decision_session.options.need_two": "optionsNeedTwo",
  "decision_session.options.duplicated": "optionsDuplicated",
  "decision_session.arguments.none": "argumentsNone",
  "decision_session.risks.none": "risksNone",
  "decision_session.feasibility.timeline_empty": "feasibilityTimelineEmpty",
  "decision_session.feasibility.roles_none": "feasibilityRolesNone",
  "decision_session.clarity.question_unclear": "clarityQuestionUnclear",
};

/**
 * Catalog leaf under author.sidebar.advisories.collectiveDecision.*.
 * sources.summary is assembled from sources.* fragments in the resolver.
 */
export const COLLECTIVE_DECISION_ADVISORY_MESSAGE_KEY: Record<
  CollectiveDecisionSidebarAdvisoryCode,
  string
> = {
  "collective_decision.sources.summary": "sourcesSummary",
  "collective_decision.sources.empty": "sourcesEmpty",
  "collective_decision.actions.need_one": "actionsNeedOne",
  "collective_decision.actions.duplicated": "actionsDuplicated",
  "collective_decision.roles.none": "rolesNone",
  "collective_decision.timeline.empty": "timelineEmpty",
  "collective_decision.risks.none": "risksNone",
  "collective_decision.criteria.none": "criteriaNone",
  "collective_decision.rationale.empty": "rationaleEmpty",
  "collective_decision.clarity.summary_unclear": "claritySummaryUnclear",
};

/** Catalog leaf under author.sidebar.advisories.implementationCommitment.* */
export const IMPLEMENTATION_COMMITMENT_ADVISORY_MESSAGE_KEY: Record<
  ImplementationCommitmentSidebarAdvisoryCode,
  string
> = {
  "implementation_commitment.sources.summary": "sourcesSummary",
  "implementation_commitment.sources.empty": "sourcesEmpty",
  "implementation_commitment.unassigned.decision_required": "unassignedDecisionRequired",
  "implementation_commitment.unassigned.no_candidates": "unassignedNoCandidates",
  "implementation_commitment.unassigned.missing_participants": "unassignedMissingParticipants",
  "implementation_commitment.roles.overloaded": "rolesOverloaded",
  "implementation_commitment.resources.missing": "resourcesMissing",
  "implementation_commitment.timeline.missing": "timelineMissing",
  "implementation_commitment.risks.missing": "risksMissing",
  "implementation_commitment.clarity.title_empty": "clarityTitleEmpty",
  "implementation_commitment.clarity.summary_empty": "claritySummaryEmpty",
};

/** Catalog leaf under author.sidebar.advisories.implementationTracking.* */
export const IMPLEMENTATION_TRACKING_ADVISORY_MESSAGE_KEY: Record<
  ImplementationTrackingSidebarAdvisoryCode,
  string
> = {
  "implementation_tracking.sources.summary": "sourcesSummary",
  "implementation_tracking.sources.empty": "sourcesEmpty",
  "implementation_tracking.overdue.count": "overdueCount",
  "implementation_tracking.blocked.count": "blockedCount",
  "implementation_tracking.evidence.missing_at_complete": "evidenceMissingAtComplete",
  "implementation_tracking.stalled.not_started": "stalledNotStarted",
  "implementation_tracking.timeline.missing_target_date": "timelineMissingTargetDate",
  "implementation_tracking.clarity.unassigned": "clarityUnassigned",
  "implementation_tracking.clarity.title_empty": "clarityTitleEmpty",
  "implementation_tracking.clarity.summary_empty": "claritySummaryEmpty",
};

/** Catalog leaf under author.sidebar.advisories.officialResponse.* */
export const OFFICIAL_RESPONSE_ADVISORY_MESSAGE_KEY: Record<
  OfficialResponseSidebarAdvisoryCode,
  string
> = {
  "official_response.sources.summary": "sourcesSummary",
  "official_response.sources.empty": "sourcesEmpty",
  "official_response.incomplete.no_candidates": "incompleteNoCandidates",
  "official_response.incomplete.summary_empty": "incompleteSummaryEmpty",
  "official_response.incomplete.summary_empty_untitled": "incompleteSummaryEmptyUntitled",
  "official_response.duplicate.subject": "duplicateSubject",
  "official_response.institution.missing": "institutionMissing",
  "official_response.institution.missing_untitled": "institutionMissingUntitled",
  "official_response.reference.unlinked": "referenceUnlinked",
  "official_response.reference.unlinked_untitled": "referenceUnlinkedUntitled",
  "official_response.reference.no_evidence": "referenceNoEvidence",
  "official_response.reference.no_evidence_untitled": "referenceNoEvidenceUntitled",
  "official_response.summary.unsupported": "summaryUnsupported",
  "official_response.summary.unsupported_untitled": "summaryUnsupportedUntitled",
  "official_response.date.future_received": "dateFutureReceived",
  "official_response.date.future_received_untitled": "dateFutureReceivedUntitled",
  "official_response.clarity.no_response_note": "clarityNoResponseNote",
  "official_response.clarity.title_empty": "clarityTitleEmpty",
  "official_response.clarity.summary_empty": "claritySummaryEmpty",
  "official_response.note.no_response_outcome": "noteNoResponseOutcome",
  "official_response.note.advisory_only": "noteAdvisoryOnly",
};

/**
 * Catalog leaf under author.sidebar.advisories.publicImpact.*.
 * sources.summary is assembled from sources.* fragments in the resolver.
 */
export const PUBLIC_IMPACT_ADVISORY_MESSAGE_KEY: Record<PublicImpactSidebarAdvisoryCode, string> = {
  "public_impact.sources.summary": "sourcesSummary",
  "public_impact.sources.empty": "sourcesEmpty",
  "public_impact.evidence.package_required": "evidencePackageRequired",
  "public_impact.evidence.none_visible": "evidenceNoneVisible",
  "public_impact.evidence.section_empty": "evidenceSectionEmpty",
  "public_impact.conclusion.unsupported": "conclusionUnsupported",
  "public_impact.stats.inconsistent": "statsInconsistent",
  "public_impact.claims.duplicated": "claimsDuplicated",
  "public_impact.institution.missing_name": "institutionMissingName",
  "public_impact.institution.missing_summary": "institutionMissingSummary",
  "public_impact.clarity.no_sections": "clarityNoSections",
  "public_impact.clarity.title_empty": "clarityTitleEmpty",
  "public_impact.clarity.judgment_wording": "clarityJudgmentWording",
  "public_impact.note.no_response_outcome": "noteNoResponseOutcome",
  "public_impact.note.low_completion": "noteLowCompletion",
  "public_impact.note.advisory_only": "noteAdvisoryOnly",
};

/**
 * Catalog leaf under author.sidebar.advisories.civicArchive.*.
 * sources.summary is assembled from sources.* fragments in the resolver.
 */
export const CIVIC_ARCHIVE_ADVISORY_MESSAGE_KEY: Record<CivicArchiveSidebarAdvisoryCode, string> = {
  "civic_archive.sources.summary": "sourcesSummary",
  "civic_archive.sources.empty": "sourcesEmpty",
  "civic_archive.completeness.missing_optional_stages": "completenessMissingOptionalStages",
  "civic_archive.fields.title_empty": "fieldsTitleEmpty",
  "civic_archive.fields.summary_empty": "fieldsSummaryEmpty",
  "civic_archive.fields.lessons_empty": "fieldsLessonsEmpty",
  "civic_archive.fields.knowledge_empty": "fieldsKnowledgeEmpty",
  "civic_archive.outstanding.unresolved_tracking": "outstandingUnresolvedTracking",
  "civic_archive.outstanding.unfinished_commitments": "outstandingUnfinishedCommitments",
  "civic_archive.neutrality.judgment_wording": "neutralityJudgmentWording",
  "civic_archive.clarity.no_response_outcome": "clarityNoResponseOutcome",
  "civic_archive.clarity.advisory_only": "clarityAdvisoryOnly",
  "civic_archive.clarity.no_sections": "clarityNoSections",
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

export function isDecisionSessionSidebarAdvisoryCode(
  code: string,
): code is DecisionSessionSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(DECISION_SESSION_ADVISORY_MESSAGE_KEY, code);
}

export function isCollectiveDecisionSidebarAdvisoryCode(
  code: string,
): code is CollectiveDecisionSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(COLLECTIVE_DECISION_ADVISORY_MESSAGE_KEY, code);
}

export function isImplementationCommitmentSidebarAdvisoryCode(
  code: string,
): code is ImplementationCommitmentSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(IMPLEMENTATION_COMMITMENT_ADVISORY_MESSAGE_KEY, code);
}

export function isImplementationTrackingSidebarAdvisoryCode(
  code: string,
): code is ImplementationTrackingSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(IMPLEMENTATION_TRACKING_ADVISORY_MESSAGE_KEY, code);
}

export function isOfficialResponseSidebarAdvisoryCode(
  code: string,
): code is OfficialResponseSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(OFFICIAL_RESPONSE_ADVISORY_MESSAGE_KEY, code);
}

export function isPublicImpactSidebarAdvisoryCode(
  code: string,
): code is PublicImpactSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(PUBLIC_IMPACT_ADVISORY_MESSAGE_KEY, code);
}

export function isCivicArchiveSidebarAdvisoryCode(
  code: string,
): code is CivicArchiveSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(CIVIC_ARCHIVE_ADVISORY_MESSAGE_KEY, code);
}

export function isProposalSidebarFieldId(value: string): value is ProposalSidebarFieldId {
  return (PROPOSAL_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isPetitionSidebarFieldId(value: string): value is PetitionSidebarFieldId {
  return (PETITION_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isDecisionSessionSidebarFieldId(
  value: string,
): value is DecisionSessionSidebarFieldId {
  return (DECISION_SESSION_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isCollectiveDecisionSidebarFieldId(
  value: string,
): value is CollectiveDecisionSidebarFieldId {
  return (COLLECTIVE_DECISION_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isImplementationCommitmentSidebarFieldId(
  value: string,
): value is ImplementationCommitmentSidebarFieldId {
  return (IMPLEMENTATION_COMMITMENT_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isImplementationTrackingSidebarFieldId(
  value: string,
): value is ImplementationTrackingSidebarFieldId {
  return (IMPLEMENTATION_TRACKING_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isOfficialResponseSidebarFieldId(
  value: string,
): value is OfficialResponseSidebarFieldId {
  return (OFFICIAL_RESPONSE_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isPublicImpactSidebarFieldId(value: string): value is PublicImpactSidebarFieldId {
  return (PUBLIC_IMPACT_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isPublicImpactSidebarSectionId(
  value: string,
): value is PublicImpactSidebarSectionId {
  return (PUBLIC_IMPACT_SIDEBAR_SECTION_IDS as readonly string[]).includes(value);
}

export function isCivicArchiveSidebarFieldId(value: string): value is CivicArchiveSidebarFieldId {
  return (CIVIC_ARCHIVE_SIDEBAR_FIELD_IDS as readonly string[]).includes(value);
}

export function isProposalTreatmentSuggestionCode(
  value: string,
): value is ProposalTreatmentSuggestionCode {
  return (PROPOSAL_TREATMENT_SUGGESTION_CODES as readonly string[]).includes(value);
}
