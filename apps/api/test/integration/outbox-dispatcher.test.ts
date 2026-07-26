import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { createDomainEvent } from "../../src/infrastructure/events/event-envelope.js";
import { CATALOGUE_EVENTS } from "../../src/infrastructure/events/catalogue-events.js";
import {
  clearDomainEventHandlers,
  registerDomainEventHandler,
} from "../../src/infrastructure/integration/event-handler-registry.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  dispatchOutboxOnceForTests,
  enqueueDomainEvent,
  findOutboxRecordById,
  isEventProcessed,
} from "../../src/infrastructure/outbox/index.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("outbox-test");

async function drainPendingOutboxForTests(): Promise<void> {
  const collection = getMongoCollection<{ status: string; publishedAt?: string }>(
    MONGO_COLLECTIONS.outbox,
  );

  await collection.updateMany(
    { status: { $in: ["pending", "failed"] } },
    {
      $set: {
        status: "published",
        publishedAt: new Date().toISOString(),
      },
    },
  );
}

describe("outbox dispatcher integration", () => {
  before(async () => {
    resetEventInfrastructureForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
    await drainPendingOutboxForTests();
  });

  beforeEach(() => {
    resetEventInfrastructureForTests();
  });

  after(async () => {
    resetEventInfrastructureForTests();
    await deleteProcessedEventsByEventIdPrefix(TEST_PREFIX);
    await deleteOutboxRecordsByEventIdPrefix(TEST_PREFIX);
    await disconnectMongoClient();
  });

  it("dispatches pending outbox events to registered handlers idempotently", async () => {
    clearDomainEventHandlers();

    const eventId = `${TEST_PREFIX}-event`;
    const consumerId = `${TEST_PREFIX}-consumer`;
    let handlerCalls = 0;

    registerDomainEventHandler({
      consumerId,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: async (envelope) => {
        handlerCalls += 1;
        assert.equal(envelope.eventId, eventId);
        assert.equal(envelope.eventName, "MemberRegistered");
      },
    });

    const event = createDomainEvent({
      eventId,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      aggregateType: "Member",
      aggregateId: `${TEST_PREFIX}-member`,
      payload: { email: "outbox@test.local" },
      correlationId: `${TEST_PREFIX}-corr`,
    });

    const record = await enqueueDomainEvent(event);
    assert.equal(record.status, "pending");

    const firstDispatchCount = await dispatchOutboxOnceForTests();
    assert.equal(firstDispatchCount, 1);
    assert.equal(handlerCalls, 1);

    const published = await findOutboxRecordById(record.outboxId);
    assert.equal(published?.status, "published");

    const alreadyProcessed = await isEventProcessed(consumerId, eventId);
    assert.equal(alreadyProcessed, true);

    const secondDispatchCount = await dispatchOutboxOnceForTests();
    assert.equal(handlerCalls, 1);
    assert.equal(await isEventProcessed(consumerId, eventId), true);
    void secondDispatchCount;
  });
});
