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
 *
 * Pack 01 recurrence fix: fire-and-forget Mongo snapshot persists can reject
 * after disconnect and become unhandledRejections that abort the process
 * before `finally` dispose runs. We install process handlers for the duration
 * of the verification script so owned hu_verify_* DBs are still disposed.
 */

let emergencyCleanupInFlight: Promise<void> | null = null;

async function emergencyDisposeOwnedVerificationDatabases(reason: string): Promise<void> {
  if (emergencyCleanupInFlight) {
    await emergencyCleanupInFlight;
    return;
  }

  emergencyCleanupInFlight = (async () => {
    console.error(`[verification-lifecycle] emergency dispose (${reason})`);
    try {
      if (isMongoConfigured()) {
        await disconnectMongoClient().catch(() => undefined);
      }
      const cleanupResults = await disposeActiveVerificationIsolations();
      for (const result of cleanupResults) {
        if (result.attempted && !result.succeeded && result.error) {
          console.error(
            `[verification-lifecycle] WARNING: emergency cleanup failed for "${result.databaseName}": ${result.error.message}`,
          );
        } else if (result.attempted && result.succeeded) {
          console.error(
            `[verification-lifecycle] emergency dropped owned verification database: ${result.databaseName}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[verification-lifecycle] emergency dispose threw: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  })();

  await emergencyCleanupInFlight;
}

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
  let fatalExitRequested = false;

  const onUnhandledRejection = (reason: unknown): void => {
    console.error(
      "[verification-lifecycle] unhandledRejection during verification:",
      reason instanceof Error ? reason.message : String(reason),
    );
    process.exitCode = 1;
    // Prefer allowing runVerificationScript's finally to dispose. Kick emergency
    // dispose only as a safety net if the rejection becomes a fatal exit path.
    void emergencyDisposeOwnedVerificationDatabases("unhandledRejection");
  };

  const onUncaughtException = (error: Error): void => {
    console.error("[verification-lifecycle] uncaughtException during verification:", error.message);
    process.exitCode = 1;
    if (fatalExitRequested) {
      return;
    }
    fatalExitRequested = true;
    // Registering this listener suppresses Node's default abrupt exit; await
    // owned hu_verify_* dispose, then exit explicitly.
    void emergencyDisposeOwnedVerificationDatabases("uncaughtException").finally(() => {
      process.exit(process.exitCode ?? 1);
    });
  };

  process.on("unhandledRejection", onUnhandledRejection);
  process.on("uncaughtException", onUncaughtException);

  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
    process.off("uncaughtException", onUncaughtException);
    if (!fatalExitRequested) {
      await finalizeVerificationResources();
    }
  }
}
