import type { DecisionId } from "../collective-decision/collective-decision.js";
import type { InitiativeId } from "../initiative.js";
import type { MemberId } from "../member.js";
import type { PetitionId } from "../petition/petition.js";
import type {
  FrozenPolicyId,
  ImplementationCommitmentId,
} from "../implementation-commitment/identifiers.js";

export type ImplementationId = string;

export type ImplementationPhaseId = string;

export type MilestoneId = string;

export type AchievementId = string;

export type EvidenceId = string;

/** Reference to an originating Initiative — not an embedded aggregate. */
export type { InitiativeId };

/** Reference to an approved Collective Decision — not an embedded aggregate. */
export type CollectiveDecisionId = DecisionId;

/** Reference to a related Petition — not an embedded aggregate. */
export type { PetitionId };

/** Reference to preceding Implementation Commitment — not an embedded aggregate. */
export type { ImplementationCommitmentId };

/** Reference to governing Frozen Policy — not an embedded aggregate. */
export type { FrozenPolicyId };

/** Reference to a participant who recorded under policy — operational accountability only. */
export type ParticipantId = MemberId;
