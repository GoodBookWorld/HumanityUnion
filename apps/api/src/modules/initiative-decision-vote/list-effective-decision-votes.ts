import type { InitiativeDecisionVote } from "@hu/types";

import { listVotesForDecision } from "./initiative-decision-vote.store.js";

/**
 * Pack 02B — durable Decision Vote repository is the sole production authority.
 * No pack02a in-memory merge.
 * VISITOR_TO_PARTICIPANT_VOTE_RECONCILIATION_GAP=YES — identities stay separate.
 */
export async function listEffectiveVotesForDecision(
  decisionId: string,
): Promise<InitiativeDecisionVote[]> {
  return listVotesForDecision(decisionId);
}
