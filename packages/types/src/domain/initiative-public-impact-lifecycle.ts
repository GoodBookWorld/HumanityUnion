import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type {
  InitiativeLifecycleConsistencyCivic,
  InitiativeLifecycleConsistencyParams,
  InitiativeLifecycleConsistencyStatus,
} from "./initiative-lifecycle-consistency.js";
import type { MemberId } from "./member.js";
import type {
  InitiativeOfficialResponseNoResponseDetail,
  InitiativeOfficialResponseOutcomeKind,
} from "./initiative-official-response-lifecycle.js";

/** Finite Public Impact consistency check IDs (08E.9b). */
export type InitiativePublicImpactConsistencyCheckId =
  | "official-response-package-available"
  | "official-response-outcome"
  | "tracking-package-available"
  | "implementation-complete"
  | "evidence-visible";

/**
 * Initiative Lifecycle — Part L. Canonical section ids for the one
 * Public Impact Report per Initiative.
 *
 * Display titles map to the Author-facing structure (Decision / intended
 * outcome, What was implemented, Official response result, etc.) while
 * keeping these stable ids for persistence and validators.
 */
export type InitiativePublicImpactReportSectionId =
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

export const INITIATIVE_PUBLIC_IMPACT_REPORT_SECTION_IDS: readonly InitiativePublicImpactReportSectionId[] =
  [
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
 * Initiative Lifecycle — Part L. One section of the Public Impact Report.
 * Non-empty bodies must cite published lifecycle ids/labels — never invent
 * unsupported paragraphs.
 */
export interface InitiativePublicImpactReportSection {
  sectionId: InitiativePublicImpactReportSectionId;
  title: string;
  body: string;
  evidenceReferences: string[];
}

/**
 * Initiative Lifecycle — Part L. Best-effort participation aggregates —
 * zeros when a source is unavailable; never invents non-zero counts.
 */
export interface InitiativePublicImpactParticipationStatistics {
  signatureCount: number;
  supportCount: number;
  reactionCount: number;
  activeAllyCount: number;
}

/**
 * Initiative Lifecycle — Part L. Deterministic advisory check — never
 * itself edits the Report or invents outcomes.
 */
export interface InitiativePublicImpactConsistencyCheck {
  readonly checkId: InitiativePublicImpactConsistencyCheckId;
  /** Compatibility English chrome — prefer Web semantic presentation. */
  readonly label: string;
  readonly status: InitiativeLifecycleConsistencyStatus;
  /** Compatibility English body — prefer Web semantic presentation. */
  readonly detail: string;
  readonly params: InitiativeLifecycleConsistencyParams & {
    readonly outcomeKind?: InitiativeOfficialResponseOutcomeKind;
  };
  readonly civic?: InitiativeLifecycleConsistencyCivic;
}

/** Read-only published Analysis summary for Impact Sources. */
export interface InitiativePublicImpactAnalysisReference {
  readonly analysisId: string;
  readonly title: string;
  readonly summary: string;
  readonly version: number | null;
}

/** Read-only published Revision summary for Impact Sources. */
export interface InitiativePublicImpactRevisionReference {
  readonly revisionId: string;
  readonly title: string;
  readonly summary: string;
  readonly version: number | null;
}

/** Read-only published Petition summary for Impact Sources. */
export interface InitiativePublicImpactPetitionReference {
  readonly petitionId: string;
  readonly title: string;
  readonly summary: string;
  readonly version: number | null;
}

/** Read-only published Decision Session summary for Impact Sources. */
export interface InitiativePublicImpactDecisionSessionReference {
  readonly sessionId: string;
  readonly title: string;
  readonly summary: string;
  readonly version: number | null;
}

/** Read-only published Collective Decision summary for Impact Sources. */
export interface InitiativePublicImpactDecisionReference {
  readonly decisionId: InitiativeCollectiveDecisionId;
  readonly title: string;
  readonly summary: string;
  readonly question: string;
}

/** Read-only published Commitment Package summary for Impact Sources. */
export interface InitiativePublicImpactCommitmentPackageReference {
  readonly packageId: string;
  readonly title: string;
  readonly summary: string;
  readonly commitmentIds: readonly string[];
  readonly decisionId: InitiativeCollectiveDecisionId | null;
  readonly publishedAt: string;
}

/** Read-only published Tracking Package summary for Impact Sources. */
export interface InitiativePublicImpactTrackingPackageReference {
  readonly packageId: string;
  readonly title: string;
  readonly summary: string;
  readonly trackingIds: readonly string[];
  readonly commitmentPackageId: string | null;
  readonly decisionId: InitiativeCollectiveDecisionId | null;
  readonly publishedAt: string;
}

/** Read-only published Official Response Package summary for Impact Sources. */
export interface InitiativePublicImpactOfficialResponsePackageReference {
  readonly packageId: string;
  readonly title: string;
  readonly summary: string;
  readonly responseIds: readonly string[];
  readonly trackingPackageId: string | null;
  readonly decisionId: InitiativeCollectiveDecisionId | null;
  readonly publishedAt: string;
  /** Defaults to `responses_received` when omitted on legacy packages. */
  readonly outcomeKind: InitiativeOfficialResponseOutcomeKind;
  readonly noResponseDetail: InitiativeOfficialResponseNoResponseDetail;
}

/** One Tracking Record summarised for Impact Sources. */
export interface InitiativePublicImpactTrackingRecordSummary {
  readonly trackingId: string;
  readonly commitmentId: string;
  readonly approvedAction: string | null;
  readonly participantId: string;
  readonly status: string;
  readonly progress: number | null;
  readonly evidenceReferences: readonly string[];
  readonly summary: string;
}

/** One Official Response summarised for Impact Sources. */
export interface InitiativePublicImpactOfficialResponseSummary {
  readonly responseId: string;
  readonly institution: string;
  readonly organization: string;
  readonly subject: string;
  readonly verificationStatus: string;
  readonly summary: string;
}

/**
 * Initiative Lifecycle — Part L, Section 2. Read-only aggregation of every
 * published upstream Lifecycle artifact needed by the Impact Builder.
 * Never invents facts; never mutates a source.
 */
export interface InitiativePublicImpactIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly analysisReference: InitiativePublicImpactAnalysisReference | null;
  readonly revisionReference: InitiativePublicImpactRevisionReference | null;
  readonly petitionReference: InitiativePublicImpactPetitionReference | null;
  readonly decisionSessionReference: InitiativePublicImpactDecisionSessionReference | null;
  readonly decisionReference: InitiativePublicImpactDecisionReference | null;
  readonly commitmentPackageReference: InitiativePublicImpactCommitmentPackageReference | null;
  readonly trackingPackageReference: InitiativePublicImpactTrackingPackageReference | null;
  readonly officialResponsePackageReference: InitiativePublicImpactOfficialResponsePackageReference | null;
  readonly trackingRecords: readonly InitiativePublicImpactTrackingRecordSummary[];
  readonly completedCommitmentCount: number;
  readonly officialResponseSummaries: readonly InitiativePublicImpactOfficialResponseSummary[];
  readonly participationStatistics: InitiativePublicImpactParticipationStatistics;
  readonly evidenceItems: readonly string[];
  readonly consistencyChecks: readonly InitiativePublicImpactConsistencyCheck[];
  /** `false` until a published Official Response Package exists. */
  readonly isOfficialResponsePackageAvailable: boolean;
  readonly isEmpty: boolean;
}

/**
 * Initiative Lifecycle — Part L. Author Workspace working draft — freely
 * edited before Publish, never itself a public record.
 */
export interface InitiativePublicImpactLifecycleDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: string;
  officialResponsePackageId: string | null;
  trackingPackageId: string | null;
  commitmentPackageId: string | null;
  decisionId: string | null;
  sections: InitiativePublicImpactReportSection[];
  participationStatistics: InitiativePublicImpactParticipationStatistics;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativePublicImpactLifecycleDraftContext {
  draft: InitiativePublicImpactLifecycleDraft | null;
  intelligenceSnapshot: InitiativePublicImpactIntelligenceSnapshot;
  /** Non-null once a Public Impact Report has been published. */
  publishedReportId: string | null;
}

/**
 * Initiative Lifecycle — Part L. Permanent answer to "which published
 * Lifecycle artifacts produced this Public Impact Report?".
 */
export interface PublicImpactTraceability {
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
  readonly petitionId: string | null;
  readonly petitionVersion: number | null;
  readonly decisionSessionId: string | null;
  readonly decisionSessionVersion: number | null;
  readonly decisionId: string | null;
  readonly commitmentPackageId: string | null;
  readonly trackingPackageId: string | null;
  readonly officialResponsePackageId: string | null;
  readonly relatedTrackingIds: readonly string[];
  readonly relatedCommitmentIds: readonly string[];
  readonly relatedOfficialResponseIds: readonly string[];
  readonly evidenceReferences: readonly string[];
}

/**
 * Initiative Lifecycle — Part L. The one published Public Impact Report
 * per Initiative — distinct from TASK-033 `InitiativePublicImpact`
 * records, which this Part leaves completely untouched.
 */
export interface InitiativePublicImpactReport {
  reportId: string;
  initiativeId: InitiativeId;
  stewardId: MemberId;
  title: string;
  sections: InitiativePublicImpactReportSection[];
  participationStatistics: InitiativePublicImpactParticipationStatistics;
  officialResponsePackageId: string | null;
  trackingPackageId: string | null;
  commitmentPackageId: string | null;
  decisionId: string | null;
  traceability: PublicImpactTraceability;
  status: "published";
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}
