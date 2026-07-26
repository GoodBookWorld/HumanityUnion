import type { CivicNomination } from "@hu/types";
import { resolveCivicNominationVotingScope } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";

import { evaluateCivicNominationVoteEligibility } from "./civic-nomination-vote-eligibility.js";
import { getVotingSessionForNomination } from "./civic-nomination-vote.store.js";

export interface CivicNominationVotingAssistantGuidance {
  canVote: boolean;
  votingStatus: string;
  votingScope: string;
  explanation: string;
  recommendsCandidate: false;
}

export async function buildCivicNominationVotingAssistantGuidance(input: {
  nomination: CivicNomination;
  identity?: RequestIdentity;
}): Promise<CivicNominationVotingAssistantGuidance> {
  const session = getVotingSessionForNomination(input.nomination.nominationId);
  const scope = resolveCivicNominationVotingScope(input.nomination.institutionRole);
  const votingStatus = session?.status ?? "not_open";

  if (!input.identity) {
    return {
      canVote: false,
      votingStatus,
      votingScope: scope,
      explanation:
        "Sign in with a registered active participant account to check civic nomination voting eligibility.",
      recommendsCandidate: false,
    };
  }

  try {
    const eligibility = await evaluateCivicNominationVoteEligibility({
      nomination: input.nomination,
      session,
      identity: input.identity,
    });

    return {
      canVote: eligibility.eligible,
      votingStatus,
      votingScope: scope,
      explanation: eligibility.explanation,
      recommendsCandidate: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Civic nomination voting is not available.";

    return {
      canVote: false,
      votingStatus,
      votingScope: scope,
      explanation: message,
      recommendsCandidate: false,
    };
  }
}
