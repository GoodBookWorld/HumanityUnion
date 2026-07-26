import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  createDomainEvent,
  fromCanonicalEnvelope,
  toCanonicalEnvelope,
} from "../../../src/infrastructure/events/event-envelope.js";
import { runWithNewCorrelationContext } from "../../../src/shared/observability/correlation.js";

describe("event envelope", () => {
  it("creates domain events with correlation metadata from context", () => {
    runWithNewCorrelationContext(
      {
        correlationId: "corr-123",
        causationId: "cause-456",
        actorId: "member-789",
      },
      () => {
        const event = createDomainEvent({
          eventName: CATALOGUE_EVENTS.memberRegistered,
          aggregateType: "Member",
          aggregateId: "member-789",
          payload: { email: "test@example.com" },
        });

        assert.equal(event.eventName, "MemberRegistered");
        assert.equal(event.metadata.correlationId, "corr-123");
        assert.equal(event.metadata.causationId, "cause-456");
        assert.equal(event.metadata.actorId, "member-789");
        assert.equal(event.metadata.schemaVersion, "1.0");
        assert.ok(event.eventId.length > 0);
      },
    );
  });

  it("round-trips through canonical envelope helpers", () => {
    const event = createDomainEvent({
      eventName: CATALOGUE_EVENTS.activityCreated,
      aggregateType: "Activity",
      aggregateId: "activity-1",
      payload: { title: "Test activity" },
      correlationId: "corr-abc",
    });

    const envelope = toCanonicalEnvelope(event);
    const restored = fromCanonicalEnvelope(envelope);

    assert.deepEqual(restored, event);
  });
});
