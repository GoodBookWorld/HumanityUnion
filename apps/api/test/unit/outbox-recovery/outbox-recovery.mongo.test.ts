/**
 * Staging Historical Outbox Recovery — Mongo integration (isolated hu_test_*).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  clearDomainEventHandlers,
  registerDomainEventHandler,
} from "../../../src/infrastructure/integration/event-handler-registry.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  enqueueDomainEvent,
  findOutboxRecordById,
  markOutboxRecordFailed,
  requeueFailedOutboxRecordById,
  retryFailedOutboxRecordById,
  OutboxRecoveryNotFailedError,
} from "../../../src/infrastructure/outbox/index.js";
import { resolveOutboxConfig } from "../../../src/infrastructure/outbox/outbox.config.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { resetEventInfrastructureForTests } from "../../helpers/test-events.js";
import { TEST_DATABASE_ENV_VAR } from "../../../scripts/test-mongo-isolation.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("outbox-recovery");

describe("Staging Historical Outbox Recovery — mongo", () => {
  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    resetEventInfrastructureForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
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

  it("cannot requeue pending or published records; failed requeue + dispatcher recovers once", async () => {
    clearDomainEventHandlers();
    const eventId = `${TEST_PREFIX}-recover-event`;
    const consumerId = `${TEST_PREFIX}-recover-consumer`;
    let handlerCalls = 0;

    registerDomainEventHandler({
      consumerId,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: async () => {
        handlerCalls += 1;
      },
    });

    const event = createDomainEvent({
      eventId,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      aggregateType: "Member",
      aggregateId: `${TEST_PREFIX}-member`,
      payload: { email: "outbox-recovery@test.local" },
      correlationId: `${TEST_PREFIX}-corr`,
    });

    const pending = await enqueueDomainEvent(event);
    await assert.rejects(
      () => requeueFailedOutboxRecordById(pending.outboxId),
      OutboxRecoveryNotFailedError,
    );

    const maxAttempts = resolveOutboxConfig().maxAttempts;
    let current = pending;
    for (let i = 0; i < maxAttempts; i += 1) {
      current =
        (await markOutboxRecordFailed(current.outboxId, new Error("synthetic failure"), maxAttempts)) ??
        current;
    }
    assert.equal(current.status, "failed");
    assert.equal(current.attempts, maxAttempts);

    const result = await retryFailedOutboxRecordById({
      outboxId: current.outboxId,
      dispatchNow: true,
    });

    assert.equal(result.beforeStatus, "failed");
    assert.equal(result.afterRequeueStatus, "pending");
    assert.equal(result.dispatchedNow, true);
    assert.equal(result.afterDispatchStatus, "published");
    assert.equal(handlerCalls, 1);

    const published = await findOutboxRecordById(current.outboxId);
    assert.equal(published?.status, "published");
    assert.equal(published?.lastError, null);

    await assert.rejects(
      () => requeueFailedOutboxRecordById(current.outboxId),
      OutboxRecoveryNotFailedError,
    );
    assert.equal(handlerCalls, 1);
  });
});
