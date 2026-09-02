import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type {
  InitiativeLifecycleConsistencyCivic,
  InitiativeLifecycleConsistencyParams,
  InitiativeLifecycleConsistencyStatus,
} from "./initiative-lifecycle-consistency.js";
import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";
import type { MemberId } from "./member.js";
import type {
  InitiativeOfficialResponseNoResponseDetail,
  InitiativeOfficialResponseOutcomeKind,
} from "./initiative-official-response-lifecycle.js";

/** Finite Civic Archive consistency check IDs (08E.9b). */
export type InitiativeCivicArchiveConsistencyCheckId =
  | "public-impact-available"
  | "tracking-resolved"
  | "evidence-visible"
  | "optional-stages-missing";

/**
 * Initiative Lifecycle — Part M. Canonical Archive Document disclaimer
 * (Part 12). Not an official governmental record.
 *
 * @deprecated 08G — English DOMAIN skew fallback for PDF/API transport.
 * Prefer Web catalog `author.archive.document.disclaimer` and API
 * `archive-document-copy` locale maps for presentation.
 */
export const INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER =
  "This document records civic participation and Initiative activity on the Humanity Union platform. It is not an official governmental or legally binding record unless independently recognized by the relevant institution.";

/** Finite completeness summary descriptor codes (08G type A). */
export type InitiativeCivicArchiveCompletenessSummaryCode =
  | "stages_published"
  | "public_impact_available"
  | "public_impact_missing"
  | "public_impact_available_optional"
  | "public_impact_not_required_public_choice"
  | "tracking_unresolved"
  | "tracking_resolved"
  | "commitments_unfinished"
  | "commitments_finished";

export interface InitiativeCivicArchiveCompletenessSummaryDescriptor {
  readonly code: string;
  readonly params?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Initiative Lifecycle — Part M, Section 3. Assembled Archive section ids
 * in lifecycle order.
 */
export type InitiativeCivicArchiveSectionId =
  | "archive_overview"
  | "original_initiative"
  | "discussion_and_participation"
  | "collaborative_analysis"
  | "improvement_proposals"
  | "revision_and_change_history"
  | "petition_and_public_participation"
  | "decision_session"
  | "collective_decision"
  | "approved_actions"
  | "implementation_commitments"
  | "implementation_tracking"
  | "official_responses"
  | "public_impact"
  | "final_results"
  | "outstanding_work"
  | "lessons_learned"
  | "knowledge_contribution"
  | "lifecycle_timeline"
  | "sources_and_traceability";

export const INITIATIVE_CIVIC_ARCHIVE_SECTION_IDS: readonly InitiativeCivicArchiveSectionId[] = [
  "archive_overview",
  "original_initiative",
  "discussion_and_participation",
  "collaborative_analysis",
  "improvement_proposals",
  "revision_and_change_history",
  "petition_and_public_participation",
  "decision_session",
  "collective_decision",
  "approved_actions",
  "implementation_commitments",
  "implementation_tracking",
  "official_responses",
  "public_impact",
  "final_results",
  "outstanding_work",
  "lessons_learned",
  "knowledge_contribution",
  "lifecycle_timeline",
  "sources_and_traceability",
] as const;

/**
 * Initiative Lifecycle — Part M. One assembled Archive section. Historical
 * bodies are generated from published Lifecycle records; Author final fields
 * are overlaid into lessons_learned / knowledge_contribution / overview.
 */
export interface InitiativeCivicArchiveSection {
  sectionId: InitiativeCivicArchiveSectionId;
  title: string;
  body: string;
  sourceRecordIds: string[];
  sourceStageId: InitiativeLifecycleStageId | null;
}

export type InitiativeCivicArchiveTimelineStatus =
  | "published"
  | "finalized"
  | "completed"
  | "partial"
  | "missing"
  | "archived";

/**
 * Initiative Lifecycle — Part M, Section 9. Compact chronological timeline
 * derived from Lifecycle stage metadata — never from Initiative.status.
 */
export interface InitiativeCivicArchiveTimelineEntry {
  stageId: InitiativeLifecycleStageId;
  label: string;
  status: InitiativeCivicArchiveTimelineStatus;
  publishedAt: string | null;
  version: number | null;
  sectionAnchor: string;
}

/**
 * Initiative Lifecycle — Part M, Section 6. Informational completeness —
 * never blocks publication for imperfect implementation.
 */
export interface InitiativeCivicArchiveCompleteness {
  stagesFound: string[];
  stagesPublished: string[];
  missingOptionalStages: string[];
  unresolvedTrackingCount: number;
  unfinishedCommitmentCount: number;
  missingEvidenceCount: number;
  officialResponseCount: number;
  publicImpactAvailable: boolean;
  traceabilityComplete: boolean;
  /** Finite semantic descriptors — Web localizes via catalog keys. */
  readonly summaryDescriptors: readonly InitiativeCivicArchiveCompletenessSummaryDescriptor[];
  /**
   * @deprecated 08G — English join for skew; prefer `summaryDescriptors`.
   * Still seeded into Archive overview DOCUMENT_CONTENT bodies.
   */
  readonly summary: string;
}

export interface InitiativeCivicArchiveParticipationStatistics {
  signatureCount: number;
  supportCount: number;
  reactionCount: number;
  activeAllyCount: number;
}

export interface InitiativeCivicArchiveConsistencyCheck {
  readonly checkId: InitiativeCivicArchiveConsistencyCheckId;
  /**
   * @deprecated 08E.9c — transport-only compatibility English chrome.
   * Prefer Web localization of `checkId`. Remove after coordinated
   * staging acceptance + production rollout of semantic Web/API.
   */
  readonly label: string;
  readonly status: InitiativeLifecycleConsistencyStatus;
  /**
   * @deprecated 08E.9c — transport-only compatibility English body.
   * Prefer `params` + Web presentation. Remove after coordinated
   * staging acceptance + production rollout of semantic Web/API.
   */
  readonly detail: string;
  readonly params: InitiativeLifecycleConsistencyParams;
  readonly civic?: InitiativeLifecycleConsistencyCivic;
}

/** Read-only published upstream references for Archive Sources. */
export interface InitiativeCivicArchiveSourceReference {
  readonly recordId: string;
  readonly label: string;
  readonly summary: string;
  readonly publishedAt: string | null;
  readonly version: number | null;
  /** Present when this reference is an Official Response Package. */
  readonly outcomeKind?: InitiativeOfficialResponseOutcomeKind;
  readonly noResponseDetail?: InitiativeOfficialResponseNoResponseDetail;
}

export interface InitiativeCivicArchiveIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly analysisReference: InitiativeCivicArchiveSourceReference | null;
  readonly proposalReferences: readonly InitiativeCivicArchiveSourceReference[];
  readonly revisionReference: InitiativeCivicArchiveSourceReference | null;
  readonly petitionReference: InitiativeCivicArchiveSourceReference | null;
  readonly decisionSessionReference: InitiativeCivicArchiveSourceReference | null;
  readonly decisionReference: InitiativeCivicArchiveSourceReference | null;
  readonly commitmentPackageReference: InitiativeCivicArchiveSourceReference | null;
  readonly trackingPackageReference: InitiativeCivicArchiveSourceReference | null;
  readonly officialResponsePackageReference: InitiativeCivicArchiveSourceReference | null;
  readonly publicImpactReportReference: InitiativeCivicArchiveSourceReference | null;
  readonly participationStatistics: InitiativeCivicArchiveParticipationStatistics;
  readonly completeness: InitiativeCivicArchiveCompleteness;
  readonly timeline: readonly InitiativeCivicArchiveTimelineEntry[];
  readonly consistencyChecks: readonly InitiativeCivicArchiveConsistencyCheck[];
  /** `false` until a published Public Impact Report exists. */
  readonly isPublicImpactReportAvailable: boolean;
  readonly isEmpty: boolean;
}

/**
 * Initiative Lifecycle — Part M, Section 5/7. Author Workspace draft —
 * only finalArchiveTitle / finalSummary / lessonsLearned /
 * knowledgeContribution are Author-editable. Sections are assembled.
 */
export interface InitiativeCivicArchiveLifecycleDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  finalArchiveTitle: string;
  finalSummary: string;
  lessonsLearned: string;
  knowledgeContribution: string;
  publicImpactReportId: string | null;
  sections: InitiativeCivicArchiveSection[];
  timeline: InitiativeCivicArchiveTimelineEntry[];
  completeness: InitiativeCivicArchiveCompleteness;
  participationStatistics: InitiativeCivicArchiveParticipationStatistics;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeCivicArchiveLifecycleDraftContext {
  draft: InitiativeCivicArchiveLifecycleDraft | null;
  intelligenceSnapshot: InitiativeCivicArchiveIntelligenceSnapshot;
  /** Non-null once at least one Archive version has been published. */
  publishedArchiveVersionId: string | null;
  latestPublishedVersion: number | null;
}

/**
 * Initiative Lifecycle — Part M, Section 17. Complete ancestry chain.
 */
export interface CivicArchiveTraceability {
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
  readonly petitionId: string | null;
  readonly petitionVersion: number | null;
  readonly decisionSessionId: string | null;
  readonly decisionSessionVersion: number | null;
  readonly decisionId: InitiativeCollectiveDecisionId | null;
  readonly commitmentPackageId: string | null;
  readonly trackingPackageId: string | null;
  readonly officialResponsePackageId: string | null;
  readonly publicImpactReportId: string | null;
  readonly relatedTrackingIds: readonly string[];
  readonly relatedCommitmentIds: readonly string[];
  readonly relatedOfficialResponseIds: readonly string[];
  readonly evidenceReferences: readonly string[];
}

/**
 * Initiative Lifecycle — Part M, Section 10. One immutable published
 * Archive version. v2 never mutates v1.
 */
export interface InitiativeCivicArchiveVersion {
  archiveVersionId: string;
  initiativeId: InitiativeId;
  stewardId: MemberId;
  archiveVersion: number;
  finalArchiveTitle: string;
  finalSummary: string;
  lessonsLearned: string;
  knowledgeContribution: string;
  sections: InitiativeCivicArchiveSection[];
  timeline: InitiativeCivicArchiveTimelineEntry[];
  completeness: InitiativeCivicArchiveCompleteness;
  participationStatistics: InitiativeCivicArchiveParticipationStatistics;
  publicImpactReportId: string | null;
  frozenSourceRecordIds: string[];
  traceability: CivicArchiveTraceability;
  status: "published";
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  publicUrlPath: string;
}

/**
 * Initiative Lifecycle — Part M, Section 11. Canonical Archive Document
 * projection — the single structured representation for web rendering,
 * PDF download, print, and future integrations.
 */
export interface InitiativeLifecycleArchiveDocument {
  readonly documentKind: "initiative_lifecycle_archive";
  readonly archiveVersionId: string | null;
  readonly archiveVersion: number | null;
  readonly initiativeId: InitiativeId;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly finalArchiveTitle: string;
  readonly finalSummary: string;
  readonly lessonsLearned: string;
  readonly knowledgeContribution: string;
  readonly stewardDisplayName: string | null;
  readonly publishedAt: string | null;
  readonly publicUrlPath: string;
  readonly disclaimer: string;
  readonly isDraftPreview: boolean;
  readonly timeline: readonly InitiativeCivicArchiveTimelineEntry[];
  readonly sections: readonly InitiativeCivicArchiveSection[];
  readonly participationStatistics: InitiativeCivicArchiveParticipationStatistics;
  readonly completeness: InitiativeCivicArchiveCompleteness;
  readonly traceability: CivicArchiveTraceability | null;
  readonly citations: readonly string[];
}
