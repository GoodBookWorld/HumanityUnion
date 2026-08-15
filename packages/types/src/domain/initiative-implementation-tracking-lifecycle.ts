import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeImplementationCommitmentId } from "./initiative-implementation-commitment.js";
import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type { MemberId } from "./member.js";

/**
 * Initiative Lifecycle — Part J, Section 2/9. Read-only reference into one
 * Accepted Implementation Commitment — Tracking's mandatory source unit.
 */
export interface InitiativeImplementationTrackingCommitmentReference {
  readonly commitmentId: InitiativeImplementationCommitmentId;
  readonly packageId: string | null;
  readonly decisionId: InitiativeCollectiveDecisionId;
  readonly participantId: MemberId;
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
  readonly checkId: string;
  readonly label: string;
  readonly status: "ok" | "warning";
  readonly detail: string;
}

/**
 * Initiative Lifecycle — Part J, Section 2/3. Read-only aggregation of
 * Published Commitments (Accepted) and their upstream Decision provenance.
 */
export interface InitiativeImplementationTrackingIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly packageReference: InitiativeImplementationTrackingPackageReference | null;
  readonly acceptedCommitments: readonly InitiativeImplementationTrackingCommitmentReference[];
  readonly activeAllyCount: number;
  readonly consistencyChecks: readonly InitiativeImplementationTrackingConsistencyCheck[];
  /** `false` until a published Commitment Package with ≥1 Accepted Commitment exists. */
  readonly isCommitmentPackageAvailable: boolean;
  readonly isEmpty: boolean;
}

/**
 * Initiative Lifecycle — Part J, Section 3/7. One Tracking Candidate per
 * Accepted Commitment — generated deterministically, edited by the Author,
 * never itself a public record until Package Publish.
 */
export interface InitiativeImplementationTrackingCandidate {
  candidateId: string;
  commitmentId: string;
  approvedAction: string;
  responsibleParticipantId: string;
  currentStatus: string;
  progress: number;
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
