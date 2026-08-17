import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { settleOptionalLifecycleLookup } from "../../../src/shared/lifecycle/optional-lifecycle-lookup.js";
import { createTestId, isMongoAvailableForTests } from "../../helpers/test-env.js";

/**
 * Phase 02 — Mongo-backed optional petition lookup.
 *
 * Live Atlas case:
 *   RUN_MONGO_INTEGRATION_TESTS=1 node --import tsx --test \
 *     apps/api/test/unit/initiatives/phase02-mongo-optional-petition.test.ts
 */

const RUN_LIVE_MONGO = process.env.RUN_MONGO_INTEGRATION_TESTS === "1";
const TEST_PREFIX = createTestId("phase02-optional-petition");

describe("Lifecycle Finalization Phase 02 — Mongo optional petition lookup", () => {
  let mongoReady = false;
  let disconnectMongoClient: (() => Promise<void>) | null = null;

  before(async () => {
    if (!RUN_LIVE_MONGO || !isMongoAvailableForTests()) {
      return;
    }

    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const { ensureMongoIndexes } = await import("../../../src/infrastructure/mongodb/mongo-indexes.js");
    await connection.connectMongoClient();
    await ensureMongoIndexes();
    disconnectMongoClient = connection.disconnectMongoClient;
    mongoReady = true;
  });

  after(async () => {
    if (mongoReady && disconnectMongoClient) {
      await disconnectMongoClient();
    }
  });

  it("missing petition for Initiative returns null under Mongo (absence ≠ infrastructure failure)", async (t) => {
    if (!RUN_LIVE_MONGO || !isMongoAvailableForTests()) {
      t.skip("Set RUN_MONGO_INTEGRATION_TESTS=1 with reachable MONGODB_URI");
      return;
    }
    if (!mongoReady) {
      t.skip("Mongo connect failed");
      return;
    }

    const { getPetitionByInitiativeId } = await import(
      "../../../src/modules/petition/petition.store.js"
    );
    const initiativeId = `${TEST_PREFIX}-no-petition`;
    const petition = await getPetitionByInitiativeId(initiativeId);
    assert.equal(petition, null);

    const settled = await settleOptionalLifecycleLookup(
      "petition_by_initiative",
      getPetitionByInitiativeId(initiativeId),
      null,
    );
    assert.equal(settled.classification, "NOT_CREATED_YET");
    assert.equal(settled.degraded, false);
    assert.equal(settled.value, null);
  });

  it("infrastructure rejection is INFRASTRUCTURE_FAILURE (not NOT_CREATED_YET)", async () => {
    const settled = await settleOptionalLifecycleLookup(
      "petition_by_initiative",
      Promise.reject(new Error("simulated Mongo infrastructure failure")),
      null,
    );
    assert.equal(settled.classification, "INFRASTRUCTURE_FAILURE");
    assert.equal(settled.degraded, true);
    assert.equal(settled.reasonCode, "infrastructure_failure");
    assert.equal(settled.value, null);
  });
});
