import type {
  InitiativeDecisionVote,
  InitiativeDecisionVoteAggregates,
  InitiativeDecisionVoteChoice,
  InitiativeDecisionVoteChoiceCounts,
} from "@hu/types";
import { createEmptyInitiativeDecisionVoteAggregates } from "@hu/types";

import { listEffectiveVotesForDecision } from "./list-effective-decision-votes.js";
import { listVotesForDecision } from "./initiative-decision-vote.store.js";

function incrementChoiceCount(
  counts: InitiativeDecisionVoteChoiceCounts,
  choice: InitiativeDecisionVoteChoice | "candidate",
): void {
  if (choice === "candidate") {
    return;
  }

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

/**
 * Canonical SUPPORT_OPPOSE / ternary aggregation authority.
 * Pack 02B — reads solely from the durable Decision Vote repository
 * (`listEffectiveVotesForDecision`). SELECT_ONE candidate rows are skipped
 * here; use `computePublicChoiceBallotAggregatesForDecision` /
 * `buildBallotAggregates` for ballot-mode-aware totals.
 */
export async function computeInitiativeDecisionVoteAggregates(
  decisionId: string,
): Promise<InitiativeDecisionVoteAggregates> {
  const aggregates = createEmptyInitiativeDecisionVoteAggregates();

  let votes: InitiativeDecisionVote[];
  try {
    votes = await listEffectiveVotesForDecision(decisionId);
  } catch {
    try {
      votes = await listVotesForDecision(decisionId);
    } catch {
      return aggregates;
    }
  }

  for (const vote of votes) {
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
