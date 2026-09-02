import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type {
  InitiativeCollectiveDecisionOutcome,
  InitiativeCollectiveDecisionStatistics,
} from "./initiative-collective-decision.js";
import type {
  InitiativeLifecycleConsistencyCivic,
  InitiativeLifecycleConsistencyParams,
  InitiativeLifecycleConsistencyStatus,
} from "./initiative-lifecycle-consistency.js";

/** Finite Collective Decision consistency check IDs (08E.9b). */
export type InitiativeCollectiveDecisionConsistencyCheckId =
  | "decision-session-available"
  | "options-available"
  | "risks-identified"
  | "roles-assigned"
  | "timeline-defined";

/**
 * Initiative Lifecycle — Part H, Section 4 (Decision Assistant).
 * Deterministic, read-only advisory check — never an automatic edit.
 */
export interface InitiativeCollectiveDecisionConsistencyCheck {
  readonly checkId: InitiativeCollectiveDecisionConsistencyCheckId;
  /** Compatibility English chrome — prefer Web semantic presentation. */
  readonly label: string;
  readonly status: InitiativeLifecycleConsistencyStatus;
  /** Compatibility English body — prefer Web semantic presentation. */
  readonly detail: string;
  readonly params: InitiativeLifecycleConsistencyParams;
  readonly civic?: InitiativeLifecycleConsistencyCivic;
}

/**
 * Initiative Lifecycle — Part H, Section 2/9 (Decision Sources /
 * Traceability). Read-only reference into the Published Decision Session
 * that produced this Collective Decision — the stage's one mandatory source.
 */
export interface InitiativeCollectiveDecisionSessionReference {
  readonly sessionId: string;
  readonly title: string;
  readonly decisionQuestion: string;
  readonly purpose: string;
  readonly publishedAt: string | null;
  readonly status: string;
  readonly version: number;
  readonly objectives: readonly string[];
  readonly options: readonly string[];
  readonly supportingArguments: readonly string[];
  readonly risks: readonly string[];
  readonly requiredResources: readonly string[];
  readonly suggestedTimeline: string | null;
  readonly suggestedResponsibleRoles: readonly string[];
  readonly petitionId: string | null;
  readonly petitionVersion: number | null;
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly participantSignatures: number;
  readonly memberSignatures: number;
  readonly visitorSignals: number;
}

/** Read-only reference into the Published Petition frozen into the Decision Session. */
export interface InitiativeCollectiveDecisionPetitionReference {
  readonly petitionId: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string | null;
  readonly participantSignatures: number;
  readonly memberSignatures: number;
  readonly visitorSignals: number;
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
}

/** Read-only reference into the Published Revision. */
export interface InitiativeCollectiveDecisionRevisionReference {
  readonly revisionId: string;
  readonly version: number;
  readonly revisionSummary: string;
  readonly publishedAt: string;
  readonly title: InitiativeTitle;
  readonly description: InitiativeDescription;
}

/** Read-only reference into the Author's Published Collaborative Analysis. */
export interface InitiativeCollectiveDecisionAnalysisReference {
  readonly analysisId: string;
  readonly title: string;
  readonly summary: string;
  readonly initiativeVersion: number;
}

/** Read-only reference into one Published Improvement Proposal. */
export interface InitiativeCollectiveDecisionProposalReference {
  readonly proposalId: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "accepted" | "partially_accepted";
}

/**
 * Initiative Lifecycle — Part H, Section 2/3 (Decision Sources / Decision
 * Result Builder). All read-only aggregation of upstream Lifecycle stages —
 * never itself an editable record. Deterministically rebuilt on every
 * "Generate" action.
 */
export interface InitiativeCollectiveDecisionIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly decisionSessionReference: InitiativeCollectiveDecisionSessionReference | null;
  readonly petitionReference: InitiativeCollectiveDecisionPetitionReference | null;
  readonly revisionReference: InitiativeCollectiveDecisionRevisionReference | null;
  readonly analysisReference: InitiativeCollectiveDecisionAnalysisReference | null;
  readonly proposalReferences: readonly InitiativeCollectiveDecisionProposalReference[];
  readonly consistencyChecks: readonly InitiativeCollectiveDecisionConsistencyCheck[];
  /** `false` until the Initiative has a Published Decision Session — the Collective Decision's one mandatory source. */
  readonly isDecisionSessionAvailable: boolean;
  readonly isEmpty: boolean;
}

/**
 * Initiative Lifecycle — Part H, Section 3/6 (Decision Result Builder /
 * Structured Decision Model). The Author Workspace's working draft —
 * freely edited before Publish, never itself a public record.
 */
export interface InitiativeCollectiveDecisionLifecycleDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: string;
  title: string;
  decisionSummary: string;
  approvedActions: string[];
  rejectedAlternatives: string[];
  responsibleRoles: string[];
  implementationPriorities: string[];
  implementationTimeline: string;
  decisionRationale: string;
  decisionRisks: string[];
  successCriteria: string[];
  requiredResources: string[];
  supportingReferences: string[];
  participationScope: "world" | "country" | "region" | "community";
  closesAt: string;
  decisionSessionId: string | null;
  decisionSessionVersion: number | null;
  petitionId: string | null;
  petitionVersion: number | null;
  revisionId: string | null;
  revisionVersion: number | null;
  analysisId: string | null;
  analysisVersion: number | null;
  proposalIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeCollectiveDecisionLifecycleDraftContext {
  draft: InitiativeCollectiveDecisionLifecycleDraft | null;
  intelligenceSnapshot: InitiativeCollectiveDecisionIntelligenceSnapshot;
  /** Non-null once a Collective Decision has been published (closed) for this Initiative. */
  publishedDecisionId: string | null;
}

/**
 * Initiative Lifecycle — Part H, Section 6/7. Structured content permanently
 * attached to the published `InitiativeCollectiveDecision`.
 */
export interface CollectiveDecisionStructuredContent {
  readonly title: string;
  readonly decisionSummary: string;
  readonly approvedActions: readonly string[];
  readonly rejectedAlternatives: readonly string[];
  readonly responsibleRoles: readonly string[];
  readonly implementationPriorities: readonly string[];
  readonly implementationTimeline: string;
  readonly decisionRationale: string;
  readonly decisionRisks: readonly string[];
  readonly successCriteria: readonly string[];
  readonly requiredResources: readonly string[];
  readonly supportingReferences: readonly string[];
  readonly votingOutcomeSummary: string | null;
}

/**
 * Initiative Lifecycle — Part H, Section 9 (Traceability). Permanently
 * attached to the published Collective Decision — the platform's durable
 * answer to "which Decision Session produced this Collective Decision?".
 */
export interface CollectiveDecisionTraceability {
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
  readonly petitionId: string | null;
  readonly petitionVersion: number | null;
  /** Null on PUBLIC_CHOICE when no Decision Session substrate exists. */
  readonly decisionSessionId: string | null;
  readonly decisionSessionVersion: number | null;
  readonly participantSignatures: number;
  readonly memberSignatures: number;
  readonly visitorSignals: number;
  readonly votingStatistics: InitiativeCollectiveDecisionStatistics | null;
  readonly votingOutcome: InitiativeCollectiveDecisionOutcome | null;
}
