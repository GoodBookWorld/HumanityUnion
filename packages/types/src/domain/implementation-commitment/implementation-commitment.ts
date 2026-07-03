import type { CommitmentState } from "./commitment-state.js";
import type { CommunityCapacity } from "./community-capacity.js";
import type { ContributionItem } from "./contribution-item.js";
import type { ContributionProfile } from "./contribution-profile.js";
import type { ContributionSummary } from "./contribution-summary.js";
import type { ImplementationReadiness } from "./implementation-readiness.js";
import type {
  CollectiveDecisionId,
  FrozenPolicyId,
  ImplementationCommitmentId,
  InitiativeId,
  ParticipantId,
  PetitionId,
} from "./identifiers.js";
import type { PolicySatisfaction } from "./policy-satisfaction.js";

/** Aggregate root for Stage 6 — Implementation Commitment. */
export interface ImplementationCommitment {
  implementationCommitmentId: ImplementationCommitmentId;
  initiativeId: InitiativeId;
  collectiveDecisionId: CollectiveDecisionId;
  petitionId: PetitionId;
  status: CommitmentState;
  subjectTitle: string;
  subjectSummary: string;
  frozenPolicyId: FrozenPolicyId;
  createdAt: string;
  updatedAt: string;
  contributionProfiles: Record<ParticipantId, ContributionProfile>;
  contributionItems: ContributionItem[];
  communityCapacity: CommunityCapacity;
  implementationReadiness: ImplementationReadiness;
  policySatisfaction: PolicySatisfaction;
  contributionSummary: ContributionSummary;
}
