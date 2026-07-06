import { getPublicInitiativeCollectiveDecision } from "../modules/initiative-collective-decision/public-initiative-collective-decision.projection.js";

const decisionId = process.argv[2];
const expectedSupport = process.argv[3];
const expectedOutcome = process.argv[4];

if (!decisionId || !expectedSupport || !expectedOutcome) {
  process.exit(1);
}

const projection = getPublicInitiativeCollectiveDecision(decisionId);

if (
  !projection ||
  projection.statistics.supportCount !== Number.parseInt(expectedSupport, 10) ||
  projection.outcome?.outcome !== expectedOutcome
) {
  process.exit(1);
}
