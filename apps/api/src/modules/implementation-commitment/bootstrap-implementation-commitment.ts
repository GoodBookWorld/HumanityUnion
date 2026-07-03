import type { ImplementationCommitment } from "@hu/types";

import {
  bootstrapCollectiveDecisionId,
  bootstrapInitiativeId,
  bootstrapPetitionId,
} from "../petition/petition.defaults.js";
import { bootstrapFrozenPolicyId } from "./frozen-policy.fixture.js";
import {
  bootstrapCommitmentId,
  BOOTSTRAP_TIMESTAMP,
} from "./implementation-commitment.defaults.js";
import {
  createEmptyCommunityCapacity,
  createEmptyContributionSummary,
  createEmptyImplementationReadiness,
  createEmptyPolicySatisfaction,
  refreshDerivedState,
} from "./implementation-commitment.helpers.js";

export const bootstrapImplementationCommitment: ImplementationCommitment = {
  implementationCommitmentId: bootstrapCommitmentId,
  initiativeId: bootstrapInitiativeId,
  collectiveDecisionId: bootstrapCollectiveDecisionId,
  petitionId: bootstrapPetitionId,
  status: "Draft",
  subjectTitle: "Community Garden Initiative",
  subjectSummary:
    "Establish a shared community garden to improve local food access and neighborhood cooperation.",
  frozenPolicyId: bootstrapFrozenPolicyId,
  createdAt: BOOTSTRAP_TIMESTAMP,
  updatedAt: BOOTSTRAP_TIMESTAMP,
  contributionProfiles: {},
  contributionItems: [],
  communityCapacity: createEmptyCommunityCapacity(BOOTSTRAP_TIMESTAMP),
  implementationReadiness: createEmptyImplementationReadiness(BOOTSTRAP_TIMESTAMP),
  policySatisfaction: createEmptyPolicySatisfaction(BOOTSTRAP_TIMESTAMP),
  contributionSummary: createEmptyContributionSummary(BOOTSTRAP_TIMESTAMP),
};

refreshDerivedState(bootstrapImplementationCommitment);

export { bootstrapCommitmentId };
