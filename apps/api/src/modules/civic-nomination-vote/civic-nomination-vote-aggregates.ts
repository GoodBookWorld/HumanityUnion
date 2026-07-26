import type {
  CivicNominationVote,
  CivicNominationVoteChoice,
  CivicNominationVotingResult,
  CivicNominationVotingSessionStatus,
} from "@hu/types";
import {
  computeCivicNominationVotingOutcomeLabel,
  createEmptyCivicNominationVotingResult,
} from "@hu/types";

import { listVotesForNomination } from "./civic-nomination-vote.store.js";

function incrementCounts(
  result: CivicNominationVotingResult,
  choice: CivicNominationVoteChoice,
  cohort: CivicNominationVote["transparencyCohort"],
): void {
  result.totalVotes += 1;

  if (cohort === "verified") {
    result.verifiedVotes += 1;
  } else {
    result.unverifiedVotes += 1;
  }

  switch (choice) {
    case "support":
      result.supportVotes += 1;
      if (cohort === "verified") {
        result.verifiedSupportVotes += 1;
      } else {
        result.unverifiedSupportVotes += 1;
      }
      break;
    case "do_not_support":
      result.doNotSupportVotes += 1;
      if (cohort === "verified") {
        result.verifiedDoNotSupportVotes += 1;
      } else {
        result.unverifiedDoNotSupportVotes += 1;
      }
      break;
    case "abstain":
      result.abstainVotes += 1;
      if (cohort === "verified") {
        result.verifiedAbstainVotes += 1;
      } else {
        result.unverifiedAbstainVotes += 1;
      }
      break;
  }
}

export function computeCivicNominationVotingResult(
  nominationId: string,
  sessionStatus: CivicNominationVotingSessionStatus,
): CivicNominationVotingResult {
  const result = createEmptyCivicNominationVotingResult();

  for (const vote of listVotesForNomination(nominationId)) {
    incrementCounts(result, vote.choice, vote.transparencyCohort);
  }

  result.outcomeLabel = computeCivicNominationVotingOutcomeLabel({
    supportVotes: result.supportVotes,
    doNotSupportVotes: result.doNotSupportVotes,
    sessionStatus,
  });

  return result;
}
