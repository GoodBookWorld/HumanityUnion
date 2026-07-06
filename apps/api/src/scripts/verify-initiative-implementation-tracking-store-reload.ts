import type { InitiativeImplementationTrackingStatus } from "@hu/types";

import { getTrackingById } from "../modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js";

const trackingId = process.argv[2];
const expectedStatus = process.argv[3] as InitiativeImplementationTrackingStatus | undefined;

if (!trackingId || !expectedStatus) {
  process.exit(1);
}

const tracking = getTrackingById(trackingId);

if (!tracking || tracking.status !== expectedStatus) {
  process.exit(1);
}
