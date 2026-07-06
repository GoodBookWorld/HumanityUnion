import type {
  InitiativeDecisionVote,
  InitiativeDecisionVoteAggregates,
  InitiativeDecisionVoteChoice,
  InitiativeDecisionVoteChoiceCounts,
} from "@hu/types";
import { createEmptyInitiativeDecisionVoteAggregates } from "@hu/types";

import { listVotesForDecision } from "./initiative-decision-vote.store.js";

function incrementChoiceCount(
  counts: InitiativeDecisionVoteChoiceCounts,
  choice: InitiativeDecisionVoteChoice,
): void {
  counts.totalVotes += 1;

  switch (choice) {
    case "support":
      counts.support += 1;
      break;
    case "do_not_support":
      counts.doNotSupport += 1;
      break;
    case "abstain":
      counts.abstain += 1;
      break;
  }
}

export function computeInitiativeDecisionVoteAggregates(
  decisionId: string,
): InitiativeDecisionVoteAggregates {
  const aggregates = createEmptyInitiativeDecisionVoteAggregates();

  for (const vote of listVotesForDecision(decisionId)) {
    incrementChoiceCount(aggregates.total, vote.choice);

    if (vote.transparencyCohort === "verified") {
      incrementChoiceCount(aggregates.verified, vote.choice);
    } else {
      incrementChoiceCount(aggregates.unverified, vote.choice);
    }
  }

  return aggregates;
}

export function assertUnweightedVoteCounts(
  votes: InitiativeDecisionVote[],
  aggregates: InitiativeDecisionVoteAggregates,
): boolean {
  const manualTotal = createEmptyInitiativeDecisionVoteAggregates();

  for (const vote of votes) {
    incrementChoiceCount(manualTotal.total, vote.choice);

    if (vote.transparencyCohort === "verified") {
      incrementChoiceCount(manualTotal.verified, vote.choice);
    } else {
      incrementChoiceCount(manualTotal.unverified, vote.choice);
    }
  }

  return JSON.stringify(manualTotal) === JSON.stringify(aggregates);
}
