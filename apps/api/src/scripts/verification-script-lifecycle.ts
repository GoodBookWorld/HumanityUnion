import "./verification-environment.bootstrap.js";

import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";

/**
 * Ensures verification scripts exit deterministically after civic workflows that
 * may trigger background notification delivery or incidental Mongo connections.
 */
export async function finalizeVerificationResources(): Promise<void> {
  const { drainCivicNotificationEventsForTests } =
    await import("../modules/notifications/notification.service.js");
  const { drainEmailQueueForTests, disposeEmailWorkersForTests } =
    await import("../modules/email/email-test-helpers.js");

  await drainCivicNotificationEventsForTests();
  await drainEmailQueueForTests();
  disposeEmailWorkersForTests();

  if (isMongoConfigured()) {
    await disconnectMongoClient().catch(() => undefined);
  }
}

export async function runVerificationScript(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await finalizeVerificationResources();
  }
}
