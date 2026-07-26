import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  claimEventForProcessing,
  deleteProcessedEventsByConsumerIdPrefix,
  isEventProcessed,
  markEventProcessingCompleted,
  releaseEventProcessingClaim,
} from "../../../src/infrastructure/outbox/processed-events.repository.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("processed-events");

describe("processed event claim semantics", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteProcessedEventsByConsumerIdPrefix(TEST_PREFIX);
    await disconnectMongoClient();
  });

  it("allows retry after handler failure and suppresses completed replays", async () => {
    const consumerId = `${TEST_PREFIX}-consumer`;
    const eventId = `${TEST_PREFIX}-event`;

    const firstClaim = await claimEventForProcessing({
      consumerId,
      eventId,
      correlationId: `${TEST_PREFIX}-corr`,
    });

    assert.equal(firstClaim.claimed, true);

    await releaseEventProcessingClaim({
      consumerId,
      eventId,
      error: new Error("handler failed"),
    });

    assert.equal(await isEventProcessed(consumerId, eventId), false);

    const secondClaim = await claimEventForProcessing({
      consumerId,
      eventId,
      correlationId: `${TEST_PREFIX}-corr`,
    });

    assert.equal(secondClaim.claimed, true);

    await markEventProcessingCompleted({ consumerId, eventId });
    assert.equal(await isEventProcessed(consumerId, eventId), true);

    const replayClaim = await claimEventForProcessing({
      consumerId,
      eventId,
      correlationId: `${TEST_PREFIX}-corr`,
    });

    assert.equal(replayClaim.claimed, false);
    assert.equal(replayClaim.alreadyCompleted, true);
  });
});
