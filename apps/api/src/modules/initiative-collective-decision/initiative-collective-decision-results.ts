import type { InitiativeCollectiveDecision } from "@hu/types";
import { buildTransparentCollectiveDecisionResults } from "@hu/types";

import { computeInitiativeDecisionVoteAggregates } from "../initiative-decision-vote/initiative-decision-vote-aggregates.js";

export function buildPublicCollectiveDecisionResults(decision: InitiativeCollectiveDecision) {
  const aggregates = computeInitiativeDecisionVoteAggregates(decision.decisionId);

  return buildTransparentCollectiveDecisionResults({
    status: decision.status,
    aggregates,
  });
}
