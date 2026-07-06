import { countUpdatesForTracking } from "../modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js";

const trackingId = process.argv[2];
const expectedCount = Number(process.argv[3]);

if (!trackingId || Number.isNaN(expectedCount)) {
  process.exit(1);
}

if (countUpdatesForTracking(trackingId) !== expectedCount) {
  process.exit(1);
}
