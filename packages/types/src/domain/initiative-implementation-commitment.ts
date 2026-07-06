import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
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
  createdAt: string;
  updatedAt: string;
}
