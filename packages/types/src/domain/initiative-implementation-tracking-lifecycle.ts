import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeImplementationCommitmentId } from "./initiative-implementation-commitment.js";
import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type {
  InitiativeLifecycleConsistencyCivic,
  InitiativeLifecycleConsistencyParams,
  InitiativeLifecycleConsistencyStatus,
} from "./initiative-lifecycle-consistency.js";
import type { MemberId } from "./member.js";

/** Finite Implementation Tracking consistency check IDs (08E.9b). */
export type InitiativeImplementationTrackingConsistencyCheckId =
  | "commitment-package-available"
  | "accepted-commitments-available"
  | "decision-actions-available"
  | "timelines-visible";

/**
 * Initiative Lifecycle — Part J, Section 2/9. Read-only reference into one
 * Accepted Implementation Commitment — Tracking's mandatory source unit.
 */
export interface InitiativeImplementationTrackingCommitmentReference {
  readonly commitmentId: InitiativeImplementationCommitmentId;
  readonly packageId: string | null;
  readonly decisionId: InitiativeCollectiveDecisionId;
  /** Null only if data is inconsistent; accepted refs should always carry a Participant. */
  readonly participantId: MemberId | null;
  readonly approvedAction: string;
  readonly commitmentTitle: string;
  readonly commitmentSummary: string;
  readonly proposalStatus: string | null;
  readonly priority: string | null;
  readonly suggestedResponsibleRole: string | null;
  readonly expectedCompletionDate: string | null;
  readonly requiredResources: readonly string[];
  readonly relatedRisks: readonly string[];
  readonly references: readonly string[];
  readonly publishedAt: string | null;
}

/**
 * Initiative Lifecycle — Part J, Section 2. Read-only reference into the
 * Commitment Package that unlocked Tracking.
 */
export interface InitiativeImplementationTrackingPackageReference {
  readonly packageId: string;
  readonly decisionId: InitiativeCollectiveDecisionId;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly commitmentIds: readonly string[];
  readonly acceptedCommitmentCount: number;
}

/**
 * Initiative Lifecycle — Part J, Section 4. Deterministic advisory check —
 * never an automatic progress or completion change.
 */
export interface InitiativeImplementationTrackingConsistencyCheck {
  readonly checkId: InitiativeImplementationTrackingConsistencyCheckId;
  /** Compatibility English chrome — prefer Web semantic presentation. */
  readonly label: string;
  readonly status: InitiativeLifecycleConsistencyStatus;
  /** Compatibility English body — prefer Web semantic presentation. */
  readonly detail: string;
  readonly params: InitiativeLifecycleConsistencyParams;
  readonly civic?: InitiativeLifecycleConsistencyCivic;
}

/**
 * Initiative Lifecycle — Part J, Section 2/3. Read-only aggregation of
 * Commitment Package (optional), Accepted Commitments (optional), and
 * Collective Decision / Initiative scope for automatic plan generation.
 */
export interface InitiativeImplementationTrackingIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly packageReference: InitiativeImplementationTrackingPackageReference | null;
  readonly acceptedCommitments: readonly InitiativeImplementationTrackingCommitmentReference[];
  /** Approved actions from the closed Collective Decision when available. */
  readonly decisionApprovedActions: readonly string[];
  readonly activeAllyCount: number;
  readonly consistencyChecks: readonly InitiativeImplementationTrackingConsistencyCheck[];
  /**
   * True when a published Commitment Package with ≥1 Accepted Commitment exists.
   * Advisory for Sources UI — Generate does NOT require this (zero-commitment path).
   */
  readonly isCommitmentPackageAvailable: boolean;
  /** True when the Initiative record itself is missing. */
  readonly isEmpty: boolean;
}

/**
 * Initiative Lifecycle — Part J, Section 3/7. One Tracking milestone /
 * Candidate — generated from Accepted Commitments when present, otherwise
 * from Collective Decision / Initiative scope with Unassigned ownership.
 * Never itself a public record until Package Publish.
 */
export interface InitiativeImplementationTrackingCandidate {
  candidateId: string;
  /** Empty string when milestone is Author-originated (no accepted commitment). */
  commitmentId: string;
  /** Milestone title (also mirrored to approvedAction for published records). */
  title: string;
  description: string;
  approvedAction: string;
  /** Empty string means Unassigned — never invent a Participant. */
  responsibleParticipantId: string;
  currentStatus: string;
  progress: number;
  plannedStartDate: string | null;
  targetDate: string | null;
  startedDate: string | null;
  completedDate: string | null;
  dependencies: string[];
  obstacles: string[];
  evidenceReferences: string[];
  notes: string;
}

/**
 * Initiative Lifecycle — Part J, Section 5. Author Workspace working draft.
 */
export interface InitiativeImplementationTrackingLifecycleDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: string;
  summary: string;
  packageId: string | null;
  candidates: InitiativeImplementationTrackingCandidate[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeImplementationTrackingLifecycleDraftContext {
  draft: InitiativeImplementationTrackingLifecycleDraft | null;
  intelligenceSnapshot: InitiativeImplementationTrackingIntelligenceSnapshot;
  /** Non-null once a Tracking Package has been published for this Initiative. */
  publishedPackageId: string | null;
}

/**
 * Initiative Lifecycle — Part J, Section 9. Permanent answer to
 * "which Commitment produced this Tracking Record?".
 */
export interface ImplementationTrackingTraceability {
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
  readonly petitionId: string | null;
  readonly petitionVersion: number | null;
  readonly decisionSessionId: string | null;
  readonly decisionSessionVersion: number | null;
  readonly decisionId: string;
  /** Empty when the Tracking Record is Author-originated without an Accepted Commitment. */
  readonly commitmentId: string;
  readonly commitmentPackageId: string | null;
  readonly approvedAction: string;
  readonly actionIndex: number | null;
}

/**
 * Initiative Lifecycle — Part J. Published package grouping every Tracking
 * Record created from Accepted Commitments.
 */
export interface InitiativeImplementationTrackingPackage {
  packageId: string;
  initiativeId: InitiativeId;
  commitmentPackageId: string | null;
  decisionId: InitiativeCollectiveDecisionId | null;
  stewardId: MemberId;
  title: string;
  summary: string;
  trackingIds: string[];
  status: "published";
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}
