import type {
  InitiativeDecisionBallotAggregates,
  InitiativeDecisionSelectOneAggregates,
  InitiativeDecisionVote,
  InitiativeDecisionVoteAggregates,
  InitiativeDecisionVoteCandidateTally,
  InitiativeDecisionVoteChoice,
  InitiativeDecisionVoteChoiceCounts,
  PublicChoiceBallotMode,
  PublicChoiceCandidateId,
  PublicChoiceVoterCategoryBreakdown,
} from "@hu/types";
import {
  createEmptyInitiativeDecisionVoteAggregates,
  createEmptyInitiativeDecisionVoteChoiceCounts,
  createEmptyPublicChoiceVoterCategoryBreakdown,
  percentageOfTotal,
  resolveDecisionVoteVoterCategory,
} from "@hu/types";

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

/**
 * Mutually exclusive participation breakdown.
 * Member increments only Members — never Participants.
 */
export function aggregatePublicChoiceParticipationBreakdown(
  votes: readonly InitiativeDecisionVote[],
): PublicChoiceVoterCategoryBreakdown {
  let visitors = 0;
  let participants = 0;
  let members = 0;

  for (const vote of votes) {
    const category = resolveDecisionVoteVoterCategory(vote);
    if (category === "visitor") {
      visitors += 1;
    } else if (category === "member") {
      members += 1;
    } else {
      participants += 1;
    }
  }

  const totalEffectiveVoters = visitors + participants + members;
  return {
    visitors,
    participants,
    members,
    totalEffectiveVoters,
    visitorPercentage: percentageOfTotal(visitors, totalEffectiveVoters),
    participantPercentage: percentageOfTotal(participants, totalEffectiveVoters),
    memberPercentage: percentageOfTotal(members, totalEffectiveVoters),
  };
}

/** Pure SUPPORT_OPPOSE aggregation from an effective-vote list. */
export function aggregateSupportOpposeVotes(
  votes: readonly InitiativeDecisionVote[],
): InitiativeDecisionVoteAggregates & {
  participationBreakdown: PublicChoiceVoterCategoryBreakdown;
} {
  const aggregates = createEmptyInitiativeDecisionVoteAggregates();

  for (const vote of votes) {
    if (vote.choice === "candidate") {
      continue;
    }

    incrementChoiceCount(aggregates.total, vote.choice);

    if (vote.transparencyCohort === "verified") {
      incrementChoiceCount(aggregates.verified, vote.choice);
    } else {
      incrementChoiceCount(aggregates.unverified, vote.choice);
    }
  }

  return {
    ...aggregates,
    participationBreakdown: aggregatePublicChoiceParticipationBreakdown(votes),
  };
}

/** Pure SELECT_ONE_CANDIDATE aggregation — one effective vote per voter already assumed. */
export function aggregateSelectOneVotes(
  votes: readonly InitiativeDecisionVote[],
  candidateIds: readonly PublicChoiceCandidateId[],
): InitiativeDecisionSelectOneAggregates {
  const counts = new Map<string, number>();
  for (const candidateId of candidateIds) {
    counts.set(candidateId, 0);
  }

  let abstain = 0;

  for (const vote of votes) {
    if (vote.choice === "abstain") {
      abstain += 1;
      continue;
    }

    if (vote.choice === "candidate" && vote.candidateId) {
      counts.set(vote.candidateId, (counts.get(vote.candidateId) ?? 0) + 1);
    }
  }

  const totalEffectiveVoters = votes.length;
  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  const candidates: InitiativeDecisionVoteCandidateTally[] = [];
  let index = 0;
  while (index < sorted.length) {
    const count = sorted[index]![1];
    let end = index + 1;
    while (end < sorted.length && sorted[end]![1] === count) {
      end += 1;
    }

    const group = sorted.slice(index, end);
    const rank = index + 1;
    const isTie = group.length > 1;

    for (const [candidateId, candidateCount] of group) {
      candidates.push({
        candidateId,
        count: candidateCount,
        percentage: percentageOfTotal(candidateCount, totalEffectiveVoters),
        rank,
        isTie,
      });
    }

    index = end;
  }

  return {
    ballotMode: "SELECT_ONE_CANDIDATE",
    candidates,
    abstain,
    abstainPercentage: percentageOfTotal(abstain, totalEffectiveVoters),
    totalEffectiveVoters,
    participationBreakdown: aggregatePublicChoiceParticipationBreakdown(votes),
  };
}

export function buildBallotAggregates(input: {
  ballotMode: PublicChoiceBallotMode;
  votes: readonly InitiativeDecisionVote[];
  candidateIds: readonly PublicChoiceCandidateId[];
}): InitiativeDecisionBallotAggregates {
  if (input.ballotMode === "SELECT_ONE_CANDIDATE") {
    return aggregateSelectOneVotes(input.votes, input.candidateIds);
  }

  return {
    ballotMode: "SUPPORT_OPPOSE",
    ...aggregateSupportOpposeVotes(input.votes),
  };
}

export function createEmptySupportOpposeChoiceCounts(): InitiativeDecisionVoteChoiceCounts {
  return createEmptyInitiativeDecisionVoteChoiceCounts();
}

export { createEmptyPublicChoiceVoterCategoryBreakdown };
