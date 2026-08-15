import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { createDomainEvent } from "../../src/infrastructure/events/event-envelope.js";
import { deserializeDomainEventEnvelope } from "../../src/infrastructure/events/event-serialization.js";
import {
  clearDomainEventHandlers,
  getHandlersForEvent,
} from "../../src/infrastructure/integration/event-handler-registry.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  dispatchOutboxOnceForTests,
  enqueueDomainEvent,
  findOutboxRecordById,
} from "../../src/infrastructure/outbox/index.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { drainPendingOutboxForTests, resetEventInfrastructureForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

/**
 * Recovery Task 22 — Part 12/13 experimental confirmation.
 *
 * Task 22 requires confirming, before any production `PetitionSigned` event is
 * added, that an event with no Member Action consumer:
 *   - can be persisted;
 *   - does not break the request that produced it;
 *   - does not cause a retry loop or poison unrelated outbox processing;
 *   - is retained/replayable and does not require fake consumer registration.
 *
 * This uses an event name that is deliberately NOT in CATALOGUE_EVENTS and has
 * NO registered handler, standing in for a hypothetical `PetitionSigned`
 * pilot event dispatched before any Member Action consumer exists. It does not
 * add any production catalogue entry or consumer.
 */

const TEST_PREFIX = createTestId("petition-pilot-safety");
const PROBE_EVENT_NAME = "PetitionSignedPilotSafetyProbe";

describe("outbox dispatch of an event with zero registered consumers (Task 22 Part 12/13 finding)", () => {
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

  it("persists, dispatches without error, and marks published an event no consumer is registered for", async () => {
    clearDomainEventHandlers();

    assert.deepEqual(
      getHandlersForEvent(PROBE_EVENT_NAME),
      [],
      "expected zero handlers to be registered for the probe event name",
    );

    const eventId = `${TEST_PREFIX}-event`;

    const event = createDomainEvent({
      eventId,
      eventName: PROBE_EVENT_NAME,
      aggregateType: "PetitionSignaturePilotSafetyProbe",
      aggregateId: `${TEST_PREFIX}-signature`,
      payload: { note: "Task 22 unconsumed-event safety probe." },
      correlationId: `${TEST_PREFIX}-corr`,
    });

    const enqueued = await enqueueDomainEvent(event);
    assert.equal(enqueued.status, "pending");

    // Dispatch must not throw, must not retry indefinitely, and must not
    // affect any unrelated pending record (there are none from this test).
    const dispatchCount = await dispatchOutboxOnceForTests();
    assert.equal(dispatchCount, 1, "expected the unconsumed event to still count as dispatched");

    const afterFirstDispatch = await findOutboxRecordById(enqueued.outboxId);
    assert.equal(
      afterFirstDispatch?.status,
      "published",
      "an event with zero matching handlers is marked published on its first dispatch cycle, " +
        "not left pending and not marked failed",
    );
    assert.equal(afterFirstDispatch?.attempts, 0, "no handler failure occurred, so no attempt was recorded");

    // A second dispatch cycle must not re-process it or error — it is no
    // longer in the "pending" query set.
    const secondDispatchCount = await dispatchOutboxOnceForTests();
    assert.equal(secondDispatchCount, 0);

    // Retention/replay: the record itself is never deleted by ordinary
    // dispatch — it remains directly queryable by outboxId (and, by the same
    // mechanism, by a future backfill query against the outbox collection),
    // even though it has fallen out of the "pending" dispatch queue.
    const stillQueryable = await findOutboxRecordById(enqueued.outboxId);
    assert.ok(stillQueryable, "expected the published record to remain queryable for future replay/backfill");
    assert.equal(stillQueryable?.eventName, PROBE_EVENT_NAME);

    // The full original fact — not just its identity — is still recoverable
    // from the retained envelope, which is what a future Phase 2 backfill
    // consumer would need to read.
    const recoveredEnvelope = deserializeDomainEventEnvelope(stillQueryable!.envelope);
    assert.deepEqual(recoveredEnvelope.payload, { note: "Task 22 unconsumed-event safety probe." });
  });
});
