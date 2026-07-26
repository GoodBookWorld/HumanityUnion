import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import {
  deserializeDomainEventEnvelope,
  EventSerializationError,
  serializeDomainEventEnvelope,
  validateCanonicalDomainEventEnvelope,
} from "../../../src/infrastructure/events/event-serialization.js";

describe("event serialization", () => {
  it("serializes and deserializes a canonical envelope", () => {
    const event = createDomainEvent({
      eventName: CATALOGUE_EVENTS.impactRecorded,
      aggregateType: "ImpactAssessment",
      aggregateId: "impact-1",
      payload: { outcomeStatement: "Observed change" },
      correlationId: "corr-impact",
      causationId: "cause-implementation-complete",
    });

    const serialized = serializeDomainEventEnvelope({
      eventId: event.eventId,
      eventName: event.eventName,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      metadata: event.metadata,
    });

    const restored = deserializeDomainEventEnvelope(serialized);

    assert.equal(restored.eventName, "ImpactRecorded");
    assert.equal(restored.metadata.correlationId, "corr-impact");
    assert.equal(restored.metadata.causationId, "cause-implementation-complete");
  });

  it("rejects invalid envelope JSON", () => {
    assert.throws(
      () => deserializeDomainEventEnvelope("{not-json"),
      EventSerializationError,
    );
  });

  it("rejects unsupported schema versions", () => {
    assert.throws(
      () =>
        validateCanonicalDomainEventEnvelope({
          eventId: "evt-1",
          eventName: "MemberRegistered",
          aggregateType: "Member",
          aggregateId: "member-1",
          payload: {},
          metadata: {
            correlationId: "corr",
            causationId: null,
            actorId: null,
            schemaVersion: "9.9",
            occurredAt: new Date().toISOString(),
          },
        }),
      /Unsupported metadata.schemaVersion/,
    );
  });
});
