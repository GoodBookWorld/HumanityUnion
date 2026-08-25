import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type {
  ImplementationCommitmentProposalHistoryEntry,
  ImplementationCommitmentTraceability,
  InitiativeImplementationCommitmentProposalStatus,
} from "./initiative-implementation-commitment-lifecycle.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

/** TASK-031 Implementation Commitment identifier (Capability 02 pipeline). */
export type InitiativeImplementationCommitmentId = string;

/** Voluntary public accountability lifecycle after a closed collective decision. */
export type InitiativeImplementationCommitmentStatus =
  "draft" | "published" | "withdrawn" | "completed";

export const INITIATIVE_IMPLEMENTATION_COMMITMENT_TRANSITIONS: Record<
  InitiativeImplementationCommitmentStatus,
  readonly InitiativeImplementationCommitmentStatus[]
> = {
  draft: ["published", "withdrawn"],
  published: ["withdrawn", "completed"],
  withdrawn: [],
  completed: [],
};

export function canTransitionInitiativeImplementationCommitment(
  from: InitiativeImplementationCommitmentStatus,
  to: InitiativeImplementationCommitmentStatus,
): boolean {
  return INITIATIVE_IMPLEMENTATION_COMMITMENT_TRANSITIONS[from].includes(to);
}

export function isInitiativeImplementationCommitmentTerminal(
  status: InitiativeImplementationCommitmentStatus,
): boolean {
  return status === "withdrawn" || status === "completed";
}

/** TASK-031 Implementation Commitment aggregate root. */
export interface InitiativeImplementationCommitment {
  commitmentId: InitiativeImplementationCommitmentId;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  /**
   * Responsible / invited Participant.
   *
   * - Package Action-Commitment `unassigned`: `null` (no responsibility).
   * - Package `proposed`: invitee Participant id (not yet accepted).
   * - Package `accepted` (or future Take Commitment): responsible Participant.
   * - Legacy TASK-031 (no `proposalStatus`): self-author Participant id.
   */
  participantId: MemberId | null;
  organizationName?: string;
  commitmentTitle: string;
  commitmentSummary: string;
  commitmentScope: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
  status: InitiativeImplementationCommitmentStatus;
  publishedAt?: string;
  withdrawnAt?: string;
  completedAt?: string;
  /**
   * Initiative Lifecycle — Part I. Package grouping Action-linked Commitments
   * published together from the Author Workspace.
   */
  packageId?: string | null;
  /** Exact Approved Action text from the Published Collective Decision. */
  approvedAction?: string | null;
  actionIndex?: number | null;
  /**
   * Voluntary proposal lifecycle (Part I §6).
   * Absent/null on legacy TASK-031 self-authored commitments (no proposal flow).
   */
  proposalStatus?: InitiativeImplementationCommitmentProposalStatus | null;
  suggestedResponsibleRole?: string | null;
  priority?: string | null;
  requiredResources?: string[] | null;
  relatedRisks?: string[] | null;
  references?: string[] | null;
  proposedByParticipantId?: MemberId | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  /**
   * Pack 19A.5 — while set, an accepted Commitment has a pending transfer
   * invitee. Canonical owner remains `participantId` until they Accept.
   */
  pendingProposedParticipantId?: MemberId | null;
  /** Pack 19A.5 — when the current proposal/transfer invite was issued. */
  proposedAt?: string | null;
  /** Pack 19A.5 — append-only proposal/responsibility history. */
  proposalHistory?: ImplementationCommitmentProposalHistoryEntry[] | null;
  /** Permanent provenance for "which Collective Decision Action created this?". */
  traceability?: ImplementationCommitmentTraceability | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * True when this Commitment uses the Part I package proposal lifecycle
 * (`unassigned` | `proposed` | `accepted` | `declined`).
 * Legacy TASK-031 records have no `proposalStatus` and use self-authorship.
 */
export function isPackageActionImplementationCommitment(
  commitment: Pick<InitiativeImplementationCommitment, "proposalStatus">,
): boolean {
  return commitment.proposalStatus != null;
}

function isValidAcceptedAt(acceptedAt: string | null | undefined): boolean {
  if (typeof acceptedAt !== "string" || acceptedAt.trim().length === 0) {
    return false;
  }

  return !Number.isNaN(Date.parse(acceptedAt));
}

/**
 * Canonical accepted-responsibility predicate for Participant statistics and
 * execution ownership (Complete / Withdraw / Tracking).
 *
 * Package Action-Commitments require explicit Accept (or future Take Commitment):
 * `participantId` match + `proposalStatus === "accepted"` + valid `acceptedAt`.
 *
 * Legacy TASK-031 commitments (null/undefined `proposalStatus`) treat the
 * stored `participantId` as the self-author responsible party.
 *
 * `unassigned` and `proposed` never count as accepted responsibility —
 * including historical steward-placeholder rows that may still carry a
 * non-null `participantId`.
 */
export function hasAcceptedImplementationResponsibility(
  commitment: Pick<
    InitiativeImplementationCommitment,
    "participantId" | "proposalStatus" | "acceptedAt"
  >,
  participantId: string,
): boolean {
  if (!participantId || commitment.participantId !== participantId) {
    return false;
  }

  if (!isPackageActionImplementationCommitment(commitment)) {
    return true;
  }

  return commitment.proposalStatus === "accepted" && isValidAcceptedAt(commitment.acceptedAt);
}
