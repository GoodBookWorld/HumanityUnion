import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { connectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import type { InitiativeSupportViewRecord } from "@hu/types";
import {
  countViewRecordsMongo,
  deleteInitiativeSupportRecordsByInitiativePrefix,
  isInitiativeViewUniqueIndexConflict,
  recordViewMongo,
} from "../../../src/modules/initiative-support/initiative-support.mongo.repository.js";
import {
  getInitiativeSupportStatistics,
  recordInitiativeView,
} from "../../../src/modules/initiative-support/initiative-support.service.js";

/**
 * Stability Hotfix — Make Initiative View Recording Idempotent.
 *
 * Focused characterization tests for the atomic
 * `updateOne(..., { upsert: true })` that replaced the previous
 * findOne-then-insertOne race in `recordViewMongo`. Exercises the
 * repository/service layer directly with real initiativeId/viewerKey
 * strings — no Initiative fixtures required, mirroring
 * initiative-discussion-collaboration-mongo-persistence.test.ts's
 * structure.
 *
 * Requires MongoDB; skipped when MONGODB_URI is not configured.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function fixtureInitiativeId(label: string): string {
  return `view-idem-${label}-${testRunId}`;
}

const allFixtureInitiativeIds: string[] = [];

function trackInitiative(initiativeId: string): string {
  allFixtureInitiativeIds.push(initiativeId);
  return initiativeId;
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const initiativeId of allFixtureInitiativeIds) {
    await deleteInitiativeSupportRecordsByInitiativePrefix(initiativeId);
  }
});

describe("Idempotency — one (initiativeId, viewerKey) always means exactly one unique view", () => {
  it("1. first view by one viewer creates one record", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("first-view"));
    const viewerKey = "viewer-first";

    const total = await recordViewMongo({ initiativeId, viewerKey });

    assert.equal(total, 1);
    const count = await countViewRecordsMongo(initiativeId);
    assert.equal(count, 1);
  });

  it("2. a repeated identical view does not throw", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("repeat-no-throw"));
    const viewerKey = "viewer-repeat";

    await recordViewMongo({ initiativeId, viewerKey });

    await assert.doesNotReject(() => recordViewMongo({ initiativeId, viewerKey }));
  });

  it("3. a repeated identical view leaves exactly one record", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("repeat-one-record"));
    const viewerKey = "viewer-repeat-record";

    await recordViewMongo({ initiativeId, viewerKey });
    await recordViewMongo({ initiativeId, viewerKey });
    await recordViewMongo({ initiativeId, viewerKey });

    const count = await countViewRecordsMongo(initiativeId);
    assert.equal(count, 1, "three identical views must still be exactly one unique-view record");
  });

  it("3b. a repeated identical view preserves the original first-view timestamp", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("repeat-preserves-timestamp"));
    const viewerKey = "viewer-preserve-timestamp";
    const viewsCollection = getMongoCollection<InitiativeSupportViewRecord>(
      MONGO_COLLECTIONS.initiativeSupportViews,
    );

    await recordViewMongo({ initiativeId, viewerKey });
    const firstDocument = await viewsCollection.findOne({ initiativeId, viewerKey });
    assert.ok(firstDocument, "first view must persist a document");

    // $setOnInsert means the repeat below must never rewrite viewedAt.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await recordViewMongo({ initiativeId, viewerKey });
    const secondDocument = await viewsCollection.findOne({ initiativeId, viewerKey });

    assert.equal(
      secondDocument?.viewedAt,
      firstDocument?.viewedAt,
      "repeat view must preserve the original first-view timestamp",
    );
  });

  it("4. a repeated identical view does not increase unique-view statistics", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("repeat-no-stat-increase"));
    const viewerKey = "viewer-stat";

    const firstTotal = await recordInitiativeView({ initiativeId, viewerKey });
    const secondTotal = await recordInitiativeView({ initiativeId, viewerKey });
    const thirdTotal = await recordInitiativeView({ initiativeId, viewerKey });

    assert.equal(firstTotal, 1);
    assert.equal(secondTotal, 1, "repeat view must not increment the unique-view count");
    assert.equal(thirdTotal, 1);

    const stats = await getInitiativeSupportStatistics({ initiativeId });
    assert.equal(stats.views.total, 1);
  });

  it("5. a different viewer creates a second record", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("different-viewer"));

    await recordViewMongo({ initiativeId, viewerKey: "viewer-a" });
    const total = await recordViewMongo({ initiativeId, viewerKey: "viewer-b" });

    assert.equal(total, 2);
    const count = await countViewRecordsMongo(initiativeId);
    assert.equal(count, 2);
  });

  it("6. the same viewer can create a view for a different Initiative", async () => {
    const initiativeIdA = trackInitiative(fixtureInitiativeId("same-viewer-a"));
    const initiativeIdB = trackInitiative(fixtureInitiativeId("same-viewer-b"));
    const viewerKey = "viewer-shared-across-initiatives";

    await recordViewMongo({ initiativeId: initiativeIdA, viewerKey });
    await recordViewMongo({ initiativeId: initiativeIdB, viewerKey });

    assert.equal(await countViewRecordsMongo(initiativeIdA), 1);
    assert.equal(await countViewRecordsMongo(initiativeIdB), 1);
  });

  it("7. concurrent identical view requests persist exactly one record and none crash", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("concurrent-identical"));
    const viewerKey = "viewer-concurrent";

    const results = await Promise.all(
      Array.from({ length: 10 }, () => recordViewMongo({ initiativeId, viewerKey })),
    );

    assert.equal(results.length, 10, "every concurrent caller resolves, none crash on the race");

    for (const total of results) {
      assert.equal(total, 1, "every concurrent caller must observe exactly one unique view");
    }

    const count = await countViewRecordsMongo(initiativeId);
    assert.equal(count, 1, "concurrent identical views must converge to exactly one document");
  });

  it("11. no unhandled rejection escapes concurrent fire-and-forget-style calls", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("no-unhandled-rejection"));
    const viewerKey = "viewer-unhandled-rejection-guard";

    let unhandled: unknown = null;
    const onUnhandledRejection = (reason: unknown) => {
      unhandled = reason;
    };
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      // Mirrors the real call site's fire-and-forget shape (no `await`,
      // deliberately not chained) — the point of this test is that even
      // when nothing observes the returned Promise directly, an expected
      // duplicate-view race must never surface as an unhandled rejection.
      for (let index = 0; index < 5; index += 1) {
        void recordViewMongo({ initiativeId, viewerKey });
      }

      // Allow the fire-and-forget microtasks/I/O to fully settle.
      await new Promise((resolve) => setTimeout(resolve, 200));
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }

    assert.equal(unhandled, null, "an expected duplicate-view race must never be an unhandled rejection");
    const count = await countViewRecordsMongo(initiativeId);
    assert.equal(count, 1);
  });

  it("12. the repository remains usable for new writes after a burst of repeated/concurrent views", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("remains-usable-after-burst"));
    const viewerKey = "viewer-burst";

    await Promise.all(
      Array.from({ length: 20 }, () => recordViewMongo({ initiativeId, viewerKey })),
    );

    // A fresh, unrelated write against the same collection/connection must
    // still succeed normally — nothing about the burst leaves the
    // repository/connection in a broken state.
    const freshInitiativeId = trackInitiative(fixtureInitiativeId("remains-usable-fresh"));
    const total = await recordViewMongo({ initiativeId: freshInitiativeId, viewerKey: "viewer-fresh" });
    assert.equal(total, 1);
  });
});

describe("Uniqueness — natural-key duplicate classification", () => {
  it("8. an E11000 with no reported keyPattern is treated as this collection's own (single) unique index", () => {
    const syntheticError = { code: 11_000 };
    assert.equal(isInitiativeViewUniqueIndexConflict(syntheticError), true);
  });

  it("8b. an E11000 whose keyPattern matches (initiativeId, viewerKey) is treated as idempotent", () => {
    const syntheticError = { code: 11_000, keyPattern: { initiativeId: 1, viewerKey: 1 } };
    assert.equal(isInitiativeViewUniqueIndexConflict(syntheticError), true);
  });

  it("9. an E11000 whose keyPattern names an unrelated index is not treated as idempotent (must rethrow)", () => {
    const syntheticError = { code: 11_000, keyPattern: { someOtherUniqueField: 1 } };
    assert.equal(isInitiativeViewUniqueIndexConflict(syntheticError), false);
  });

  it("10. a non-duplicate-key error is never treated as idempotent (must not be swallowed)", () => {
    const networkError = new Error("connection timed out");
    assert.equal(isInitiativeViewUniqueIndexConflict(networkError), false);

    const differentMongoErrorCode = { code: 121 };
    assert.equal(isInitiativeViewUniqueIndexConflict(differentMongoErrorCode), false);
  });

  it("10b. recordViewMongo rethrows a genuinely unrelated error instead of swallowing it", async () => {
    const initiativeId = trackInitiative(fixtureInitiativeId("rethrow-real-failure"));

    // A circular-reference viewerKey cannot be serialized to BSON — the
    // driver rejects with a real (non-duplicate-key, code-less) error,
    // proving the catch block's `if (!isInitiativeViewUniqueIndexConflict)
    // throw` path is reachable and does not silently swallow a genuine
    // database/serialization failure.
    const circularViewerKey: Record<string, unknown> = {};
    circularViewerKey.self = circularViewerKey;

    await assert.rejects(
      () =>
        recordViewMongo({
          initiativeId,
          viewerKey: circularViewerKey as unknown as string,
        }),
      (error: unknown) => !isInitiativeViewUniqueIndexConflict(error),
    );
  });
});
