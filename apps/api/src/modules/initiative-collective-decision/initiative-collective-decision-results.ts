import type { InitiativeCollectiveDecision } from "@hu/types";
import { buildTransparentCollectiveDecisionResults } from "@hu/types";

import { computeInitiativeDecisionVoteAggregates } from "../initiative-decision-vote/initiative-decision-vote-aggregates.js";

export async function buildPublicCollectiveDecisionResults(decision: InitiativeCollectiveDecision) {
  const aggregates = await computeInitiativeDecisionVoteAggregates(decision.decisionId);

  return buildTransparentCollectiveDecisionResults({
    status: decision.status,
    aggregates,
  });
}
