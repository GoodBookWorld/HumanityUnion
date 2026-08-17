import "./verification-environment.bootstrap.js";

import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { disposeActiveVerificationIsolations } from "./verification-database-isolation.js";

/**
 * Ensures verification scripts exit deterministically after civic workflows that
 * may trigger background notification delivery or incidental Mongo connections.
 *
 * Also disposes any still-active verification database isolations (owned
 * hu_verify_* drop + environment restore). Environment restore alone never
 * substitutes for database cleanup.
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

  // After disconnecting the shared client, drop any run-owned verification DBs
  // that callers forgot to dispose (or only restored environment for).
  const cleanupResults = await disposeActiveVerificationIsolations();
  for (const result of cleanupResults) {
    if (result.attempted && !result.succeeded && result.error) {
      console.error(
        `[verification-lifecycle] WARNING: verification database cleanup failed for "${result.databaseName}": ${result.error.message}`,
      );
    }
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
