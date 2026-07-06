import type {
  DecisionParticipationEligibilityInput,
  DecisionParticipationEligibilityResult,
  InitiativeCollectiveDecisionStatus,
  ParticipationScope,
} from "@hu/types";
import {
  evaluateDecisionParticipationEligibility,
  getTransparencyCohort,
  isParticipationAreaMatch,
} from "@hu/types";

import type { MemberStatus } from "@hu/types";
import { resolveInitiativeParticipationScopeMetadata } from "../initiatives/initiative-communities.js";
import {
  getPendingParticipationAreaTransitionForParticipant,
  resolveActiveParticipationArea,
} from "../participation-area/participation-area.store.js";

export {
  evaluateDecisionParticipationEligibility,
  getTransparencyCohort,
  isParticipationAreaMatch,
  resolveActiveParticipationArea,
};

export interface EvaluateStoredParticipationEligibilityInput {
  participantId: string;
  isRegistered: boolean;
  participantStatus: MemberStatus | "unregistered";
  decisionParticipationScope: ParticipationScope;
  initiativeCommunitySlug: string;
  initiativeIsGlobal?: boolean;
  decisionStatus: InitiativeCollectiveDecisionStatus;
  openedAt?: string;
  closesAt: string;
  currentTime: string;
  priorVoteExists: boolean;
}

export function buildDecisionParticipationEligibilityInput(
  input: EvaluateStoredParticipationEligibilityInput,
): DecisionParticipationEligibilityInput {
  const activeArea = resolveActiveParticipationArea(input.participantId, input.currentTime);
  const pendingTransition = getPendingParticipationAreaTransitionForParticipant(
    input.participantId,
  );

  return {
    participantId: input.participantId,
    isRegistered: input.isRegistered,
    participantStatus: input.participantStatus,
    activeParticipationArea: activeArea
      ? {
          countrySlug: activeArea.countrySlug,
          regionSlug: activeArea.regionSlug,
          communitySlug: activeArea.communitySlug,
        }
      : null,
    verificationStatus: activeArea?.verificationStatus ?? "unverified",
    pendingTransition,
    decisionParticipationScope: input.decisionParticipationScope,
    initiativeScopeMetadata: resolveInitiativeParticipationScopeMetadata({
      communitySlug: input.initiativeCommunitySlug,
      isGlobal: input.initiativeIsGlobal,
    }),
    decisionStatus: input.decisionStatus,
    openedAt: input.openedAt,
    closesAt: input.closesAt,
    currentTime: input.currentTime,
    priorVoteExists: input.priorVoteExists,
  };
}

export function evaluateStoredDecisionParticipationEligibility(
  input: EvaluateStoredParticipationEligibilityInput,
): DecisionParticipationEligibilityResult {
  return evaluateDecisionParticipationEligibility(
    buildDecisionParticipationEligibilityInput(input),
  );
}
