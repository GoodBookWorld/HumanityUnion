import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type { MemberId } from "./member.js";

/**
 * Initiative Lifecycle — Part I, Section 2/9. Read-only reference into the
 * Published (closed) Collective Decision — the stage's one mandatory source.
 */
export interface InitiativeImplementationCommitmentDecisionReference {
  readonly decisionId: InitiativeCollectiveDecisionId;
  readonly question: string;
  readonly sequenceNumber: number;
  readonly closedAt: string | null;
  readonly title: string;
  readonly decisionSummary: string;
  readonly approvedActions: readonly string[];
  readonly rejectedAlternatives: readonly string[];
  readonly responsibleRoles: readonly string[];
  readonly implementationPriorities: readonly string[];
  readonly implementationTimeline: string;
  readonly decisionRisks: readonly string[];
  readonly successCriteria: readonly string[];
  readonly requiredResources: readonly string[];
  readonly supportingReferences: readonly string[];
  readonly decisionSessionId: string | null;
  readonly decisionSessionVersion: number | null;
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

/**
 * Initiative Lifecycle — Part I, Section 4. Deterministic advisory check —
 * never an automatic assignment or publish.
 */
export interface InitiativeImplementationCommitmentConsistencyCheck {
  readonly checkId: string;
  readonly label: string;
  readonly status: "ok" | "warning";
  readonly detail: string;
}

/**
 * Initiative Lifecycle — Part I, Section 2/3. Read-only aggregation of the
 * Published Collective Decision and its upstream Traceability.
 */
export interface InitiativeImplementationCommitmentIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly decisionReference: InitiativeImplementationCommitmentDecisionReference | null;
  readonly activeAllyCount: number;
  readonly consistencyChecks: readonly InitiativeImplementationCommitmentConsistencyCheck[];
  /** `false` until a closed Collective Decision exists — the one mandatory source. */
  readonly isCollectiveDecisionAvailable: boolean;
  readonly isEmpty: boolean;
}

/** Working-draft status for one Action-linked Commitment Candidate. */
export type InitiativeImplementationCommitmentCandidateDraftStatus = "draft";

/**
 * Initiative Lifecycle — Part I, Section 3/7. One Candidate per Approved
 * Action — generated deterministically, edited by the Author, never itself
 * a public record until Package Publish.
 */
export interface InitiativeImplementationCommitmentCandidate {
  candidateId: string;
  approvedAction: string;
  description: string;
  suggestedResponsibleRole: string;
  suggestedTimeline: string;
  priority: string;
  requiredResources: string[];
  relatedRisks: string[];
  references: string[];
  /** Author-proposed responsible Participant — voluntary Accept/Decline after publish. */
  proposedParticipantId: string | null;
  status: InitiativeImplementationCommitmentCandidateDraftStatus;
}

/**
 * Initiative Lifecycle — Part I, Section 5/6. Author Workspace working draft.
 */
export interface InitiativeImplementationCommitmentLifecycleDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: string;
  summary: string;
  decisionId: string | null;
  candidates: InitiativeImplementationCommitmentCandidate[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeImplementationCommitmentLifecycleDraftContext {
  draft: InitiativeImplementationCommitmentLifecycleDraft | null;
  intelligenceSnapshot: InitiativeImplementationCommitmentIntelligenceSnapshot;
  /** Non-null once a Commitment Package has been published for this Initiative. */
  publishedPackageId: string | null;
}

/**
 * Proposal lifecycle after Package Publish (Part I, Section 6).
 * Distinct from the aggregate's draft/published/withdrawn/completed status.
 */
export type InitiativeImplementationCommitmentProposalStatus =
  | "unassigned"
  | "proposed"
  | "accepted"
  | "declined";

/**
 * Pack 19A.5 — append-only proposal/responsibility history.
 * Preserves declined proposals and previous acceptances across re-propose/transfer.
 */
export type ImplementationCommitmentProposalHistoryOutcome =
  | "declined"
  | "accepted"
  | "superseded_by_reproposal"
  | "transferred_away"
  | "transfer_declined";

export interface ImplementationCommitmentProposalHistoryEntry {
  readonly participantId: string;
  readonly outcome: ImplementationCommitmentProposalHistoryOutcome;
  readonly resolvedAt: string;
  readonly proposedByParticipantId?: string | null;
  readonly proposedAt?: string | null;
  /** Present when this entry records a prior acceptance that later ended. */
  readonly acceptedAt?: string | null;
}

/**
 * Initiative Lifecycle — Part I, Section 9. Permanent answer to
 * "which Collective Decision Action created this Commitment?".
 */
export interface ImplementationCommitmentTraceability {
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
  readonly approvedAction: string;
  readonly actionIndex: number;
  readonly participantSignatures: number;
  readonly memberSignatures: number;
  readonly visitorSignals: number;
}

/**
 * Initiative Lifecycle — Part I. Published package grouping every
 * Action-linked Commitment created from one Collective Decision.
 */
export interface InitiativeImplementationCommitmentPackage {
  packageId: string;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  stewardId: MemberId;
  title: string;
  summary: string;
  commitmentIds: string[];
  status: "published";
  publishedAt: string;
  traceability: ImplementationCommitmentTraceability | null;
  createdAt: string;
  updatedAt: string;
}
