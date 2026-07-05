import type { DecisionSessionStatus } from "@hu/types";

import { getSessionById } from "../modules/decision-session/decision-session.store.js";

const sessionId = process.argv[2];
const expectedStatus = process.argv[3] as DecisionSessionStatus | undefined;

if (!sessionId || !expectedStatus) {
  process.exit(1);
}

const session = getSessionById(sessionId);

if (!session || session.status !== expectedStatus) {
  process.exit(1);
}
