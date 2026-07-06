import type { InitiativeDecisionVoteChoice } from "@hu/types";

import { getActiveVoteForParticipant } from "../modules/initiative-decision-vote/initiative-decision-vote.store.js";

const decisionId = process.argv[2];
const participantId = process.argv[3];
const expectedChoice = process.argv[4] as InitiativeDecisionVoteChoice | undefined;
const expectedVersion = process.argv[5];

if (!decisionId || !participantId || !expectedChoice || !expectedVersion) {
  process.exit(1);
}

const vote = getActiveVoteForParticipant(decisionId, participantId);

if (
  !vote ||
  vote.choice !== expectedChoice ||
  vote.version !== Number.parseInt(expectedVersion, 10)
) {
  process.exit(1);
}
