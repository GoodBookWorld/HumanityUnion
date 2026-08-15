import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type {
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
  participantId: MemberId;
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
  /** Voluntary proposal lifecycle (Part I §6). Absent on legacy records. */
  proposalStatus?: InitiativeImplementationCommitmentProposalStatus | null;
  suggestedResponsibleRole?: string | null;
  priority?: string | null;
  requiredResources?: string[] | null;
  relatedRisks?: string[] | null;
  references?: string[] | null;
  proposedByParticipantId?: MemberId | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  /** Permanent provenance for "which Collective Decision Action created this?". */
  traceability?: ImplementationCommitmentTraceability | null;
  createdAt: string;
  updatedAt: string;
}
