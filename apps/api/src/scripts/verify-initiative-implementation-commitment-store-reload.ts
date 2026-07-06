import type { InitiativeImplementationCommitmentStatus } from "@hu/types";

import { getCommitmentById } from "../modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";

const commitmentId = process.argv[2];
const expectedStatus = process.argv[3] as InitiativeImplementationCommitmentStatus | undefined;

if (!commitmentId || !expectedStatus) {
  process.exit(1);
}

const commitment = getCommitmentById(commitmentId);

if (!commitment || commitment.status !== expectedStatus) {
  process.exit(1);
}
