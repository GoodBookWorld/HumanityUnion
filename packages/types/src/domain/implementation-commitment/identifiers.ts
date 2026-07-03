import type { DecisionId } from "../collective-decision/collective-decision.js";
import type { InitiativeId } from "../initiative.js";
import type { MemberId } from "../member.js";
import type { PetitionId } from "../petition/petition.js";

export type ImplementationCommitmentId = string;

export type ContributionItemId = string;

export type FrozenPolicyId = string;

export type ReadinessThresholdId = string;

/** Reference to an originating Initiative — not an embedded aggregate. */
export type { InitiativeId };

/** Reference to an approved Collective Decision — not an embedded aggregate. */
export type CollectiveDecisionId = DecisionId;

/** Reference to a related Petition — not an embedded aggregate. */
export type { PetitionId };

/** Reference to a declaring participant — not an embedded aggregate. */
export type ParticipantId = MemberId;
