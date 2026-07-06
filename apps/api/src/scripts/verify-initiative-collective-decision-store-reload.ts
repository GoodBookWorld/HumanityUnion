import type { InitiativeCollectiveDecisionStatus } from "@hu/types";

import { getDecisionById } from "../modules/initiative-collective-decision/initiative-collective-decision.store.js";

const decisionId = process.argv[2];
const expectedStatus = process.argv[3] as InitiativeCollectiveDecisionStatus | undefined;

if (!decisionId || !expectedStatus) {
  process.exit(1);
}

const decision = getDecisionById(decisionId);

if (!decision || decision.status !== expectedStatus) {
  process.exit(1);
}
