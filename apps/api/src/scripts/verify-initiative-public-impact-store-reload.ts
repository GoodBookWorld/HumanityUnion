import type { InitiativePublicImpactStatus } from "@hu/types";

import { getImpactById } from "../modules/initiative-public-impact/initiative-public-impact.store.js";

const impactId = process.argv[2];
const expectedStatus = process.argv[3] as InitiativePublicImpactStatus | undefined;

if (!impactId || !expectedStatus) {
  process.exit(1);
}

const impact = getImpactById(impactId);

if (!impact || impact.status !== expectedStatus) {
  process.exit(1);
}
