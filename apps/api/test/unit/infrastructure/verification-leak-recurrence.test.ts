import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { classifyCollectionPressure } from "../../../src/infrastructure/mongodb/ephemeral-mongo-database-safety.js";
import { createMongoSnapshotPersistence } from "../../../src/infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import {
  activateVerificationDatabaseIsolation,
  disposeActiveVerificationIsolations,
} from "../../../src/scripts/verification-database-isolation.js";

afterEach(async () => {
  await disposeActiveVerificationIsolations();
});

type TinySnapshot = {
  version: 1;
  records: Record<string, { id: string; value: string }>;
};

/**
 * Recurrence of Pack 01 leaks after Phase 05A:
 * createMongoSnapshotPersistence.save() fire-and-forget rejects (disconnect race
 * or duplicate-key) → Node treats it as unhandledRejection/uncaughtException →
 * verify:initiative-lifecycle finally dispose never runs → hu_verify_* left on Atlas.
 */
describe("verification leak recurrence — fire-and-forget persist caller pattern", () => {
  it("background persist failure is captured by flush and does not become an unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      const handles = createMongoSnapshotPersistence<TinySnapshot>({
        createEmpty: () => ({ version: 1, records: {} }),
        bindings: [
          {
            collectionName: "tiny",
            idField: "id",
            select: (snapshot) => snapshot.records,
            assign: (snapshot, records) => ({
              ...snapshot,
              records: records as TinySnapshot["records"],
            }),
          },
        ],
        persistSnapshot: async () => {
          throw new Error("MongoDB client is not connected. Call connectMongoClient() first.");
        },
      });

      handles.adapter.save({
        version: 1,
        records: { a: { id: "a", value: "1" } },
      });

      // Allow the chained pendingWrite microtasks to settle without crashing the process.
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));

      assert.equal(unhandled.length, 0, "save() must not emit unhandledRejection");

      await assert.rejects(
        () => handles.flush(),
        /MongoDB client is not connected/,
      );
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("golden-path caller pattern still disposes hu_verify_* after late persist failure + verification throw", async () => {
    const env: NodeJS.ProcessEnv = {
      MONGODB_URI: "mongodb://127.0.0.1:27017/humanity_union_dev",
    };
    const dropped: string[] = [];

    const isolation = activateVerificationDatabaseIsolation("LEAK-RECURRENCE", {
      env,
      skipPressureCheck: true,
      pressureAssessment: classifyCollectionPressure(100),
      dropDatabase: async ({ databaseName }) => {
        dropped.push(databaseName);
      },
    });

    const handles = createMongoSnapshotPersistence<TinySnapshot>({
      createEmpty: () => ({ version: 1, records: {} }),
      bindings: [
        {
          collectionName: "tiny",
          idField: "id",
          select: (snapshot) => snapshot.records,
          assign: (snapshot, records) => ({
            ...snapshot,
            records: records as TinySnapshot["records"],
          }),
        },
      ],
      persistSnapshot: async () => {
        throw new Error("MongoDB client is not connected. Call connectMongoClient() first.");
      },
    });

    let verificationError: Error | null = null;
    try {
      // Simulate revision publish save, then checkpoint disconnect, then a late
      // background persist that would previously crash the process.
      handles.adapter.save({
        version: 1,
        records: { r: { id: "r", value: "revision" } },
      });
      await new Promise<void>((resolve) => setImmediate(resolve));

      try {
        await handles.flush();
      } catch (error) {
        verificationError = error instanceof Error ? error : new Error(String(error));
        throw verificationError;
      }
    } catch (error) {
      verificationError = error instanceof Error ? error : new Error(String(error));
    } finally {
      await isolation.dispose();
    }

    assert.match(verificationError?.message ?? "", /MongoDB client is not connected/);
    assert.deepEqual(dropped, [isolation.databaseName]);
    assert.equal(env.MONGODB_URI, "mongodb://127.0.0.1:27017/humanity_union_dev");
  });

  it("runVerificationScript-shaped finalize still drops leftover active isolations", async () => {
    const env: NodeJS.ProcessEnv = {
      MONGODB_URI: "mongodb://127.0.0.1:27017/humanity_union_dev",
    };
    const dropped: string[] = [];

    activateVerificationDatabaseIsolation("LEAK-FINALIZE", {
      env,
      skipPressureCheck: true,
      pressureAssessment: classifyCollectionPressure(100),
      dropDatabase: async ({ databaseName }) => {
        dropped.push(databaseName);
      },
    });

    // Caller forgot dispose(); finalizeVerificationResources path must still clean up.
    const results = await disposeActiveVerificationIsolations();
    assert.equal(results.length, 1);
    assert.equal(results[0]?.succeeded, true);
    assert.equal(dropped.length, 1);
    assert.match(dropped[0] ?? "", /^hu_verify_/);
  });
});
