import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

import { getLockedMongoConfigForTests, resolveMongoConfig } from "../../src/infrastructure/mongodb/mongo-config.js";
import { connectMongoClient, getMongoClient } from "../../src/infrastructure/mongodb/mongo-connection.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection, getMongoDatabase } from "../../src/infrastructure/mongodb/mongo-database.js";
import {
  dropIsolatedTestDatabase,
  generateIsolatedTestDatabaseName,
  TEST_DATABASE_ENV_VAR,
} from "../../scripts/test-mongo-isolation.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";

/**
 * Short, disposable id for the "external dev-like" probe database used
 * below. Deliberately does NOT use the `hu_test_` naming pattern (it stands
 * in for a database an unrelated process would own), but — like every
 * database name used against this repository's real Mongo Atlas cluster —
 * must still fit Atlas's 38-byte database-name limit (see
 * `scripts/test-mongo-isolation.ts`), hence the short base36/hex encoding
 * rather than `createTestId()`'s longer, human-readable id.
 */
function shortProbeDatabaseName(): string {
  return `hu_probe_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

/**
 * Recovery Task 30 — coverage notes.
 *
 * These tests prove the *actual*, running-Mongo half of the isolation
 * mechanism (the pure name-generation/validation half is covered by
 * `test/unit/scripts/test-mongo-isolation.test.ts`, with no Mongo
 * dependency). Specifically:
 *
 *  - every repository chokepoint (outbox, processed events, workspace
 *    projections, Participant Action, and the generic `getMongoDatabase()`)
 *    actually resolves to the one database `test-setup.ts` locked in for
 *    this run — not the development database (Part 12 items 10–14);
 *  - a fixture written into a *different* ("dev-like") database is
 *    genuinely invisible to the isolated connection (Part 12 item 15);
 *  - `dropIsolatedTestDatabase` removes only the database it is told to
 *    remove, leaving a sibling database untouched (Part 12 items 16–18).
 *
 * Skips itself when `MONGODB_URI` is not configured, exactly like every
 * other Mongo-gated test in this suite.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

describe("Mongo test-database isolation (Recovery Task 30)", () => {
  before(async () => {
    await connectMongoClient();
  });

  it("this run's config is locked to a safe, non-development database name", () => {
    const locked = getLockedMongoConfigForTests();

    assert.ok(locked, "expected test-setup.ts to have locked the Mongo config for this run");
    assert.equal(locked?.database, process.env[TEST_DATABASE_ENV_VAR]);
    assert.notEqual(locked?.database, "humanity_union_dev");
    assert.notEqual(locked?.database, "humanity_union");
    assert.match(locked?.database ?? "", /^hu_test_[a-zA-Z0-9_]+$/);
  });

  it("getMongoDatabase() resolves to the isolated database, not the development database (Part 12 item 10)", () => {
    const db = getMongoDatabase();

    assert.equal(db.databaseName, resolveMongoConfig().database);
    assert.notEqual(db.databaseName, "humanity_union_dev");
  });

  it("outbox, processed events, workspace projections, and Participant Action collections all resolve under the isolated database (Part 12 items 11–14)", () => {
    const isolatedName = resolveMongoConfig().database;

    for (const collectionKey of [
      "outbox",
      "processedEvents",
      "workspaceProjections",
      "participantActions",
    ] as const) {
      const collection = getMongoCollection(MONGO_COLLECTIONS[collectionKey]);
      assert.equal(
        collection.dbName,
        isolatedName,
        `expected collection "${MONGO_COLLECTIONS[collectionKey]}" to resolve under the isolated database`,
      );
    }
  });

  it("shares the single application Mongo client, not a second client, for the isolated database (Part 6)", () => {
    // `getMongoDatabase()`/`getMongoCollection()` must go through the same
    // singleton `MongoClient` as everything else in the app — isolation is
    // achieved purely by which *database name* that shared client is told
    // to use, never by spinning up a parallel client per test file.
    assert.equal(getMongoDatabase().client, getMongoClient());
  });

  describe("external ('dev-like') database fixtures are invisible to the isolated connection (Part 12 item 15)", () => {
    const probeDatabaseName = shortProbeDatabaseName();
    const probeCollectionName = "isolation_probe_fixtures";
    let probeClient: MongoClient;

    before(async () => {
      const uri = resolveMongoConfig().uri;
      assert.ok(uri, "expected MONGODB_URI to be configured for this Mongo-gated test");
      // A deliberately separate, raw client — standing in for an unrelated
      // `dev:api` process that never goes through this app's connection
      // singleton or its locked isolated-database config.
      probeClient = new MongoClient(uri);
      await probeClient.connect();
      await probeClient
        .db(probeDatabaseName)
        .collection(probeCollectionName)
        .insertOne({ marker: "dev-fixture-should-be-invisible-to-isolated-tests" });
    });

    after(async () => {
      await probeClient.db(probeDatabaseName).dropDatabase();
      await probeClient.close();
    });

    it("the isolated connection cannot see the dev-like fixture", async () => {
      const isolatedName = resolveMongoConfig().database;
      assert.notEqual(isolatedName, probeDatabaseName, "test setup error: probe database must differ from the isolated one");

      // Reading the *isolated* database's own collections must never surface
      // documents that only exist in the separate probe database.
      const found = await getMongoDatabase()
        .collection(probeCollectionName)
        .findOne({ marker: "dev-fixture-should-be-invisible-to-isolated-tests" });

      assert.equal(found, null);
    });
  });

  describe("owned cleanup drops only the targeted database (Part 12 items 16–18)", () => {
    it("dropping database A leaves sibling database B untouched", async () => {
      const uri = resolveMongoConfig().uri;
      assert.ok(uri);

      const nameA = generateIsolatedTestDatabaseName();
      const nameB = generateIsolatedTestDatabaseName();
      assert.notEqual(nameA, nameB, "test setup error: expected two distinct generated names");

      const rawClient = new MongoClient(uri as string);
      await rawClient.connect();
      try {
        await rawClient.db(nameA).collection("canary").insertOne({ owner: "a" });
        await rawClient.db(nameB).collection("canary").insertOne({ owner: "b" });

        await dropIsolatedTestDatabase({ uri: uri as string, databaseName: nameA });

        const stillInA = await rawClient.db(nameA).collection("canary").findOne({ owner: "a" });
        const stillInB = await rawClient.db(nameB).collection("canary").findOne({ owner: "b" });

        assert.equal(stillInA, null, "expected database A to have been dropped");
        assert.notEqual(stillInB, null, "expected sibling database B to survive A's drop");
      } finally {
        // Drop B ourselves — it is this test's own fixture, not something
        // `dropIsolatedTestDatabase` was ever asked to touch.
        await rawClient.db(nameB).dropDatabase();
        await rawClient.close();
      }
    });

    it("refuses to drop the actual development database name even if asked", async () => {
      const uri = resolveMongoConfig().uri;
      await assert.rejects(() =>
        dropIsolatedTestDatabase({ uri: uri as string, databaseName: "humanity_union_dev" }),
      );
    });
  });
});
