import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCanonicalEnvelope } from "../../../src/infrastructure/events/event-envelope.js";
import type { CanonicalDomainEventEnvelope } from "../../../src/infrastructure/events/domain-event.js";
import { createPetitionSignedEvent } from "../../../src/modules/petition/petition-signed.event.js";
import {
  mapPetitionSignedToParticipantAction,
  validatePetitionSignedEnvelopeForParticipantAction,
} from "../../../src/modules/participant-action/application/petition-signed-to-participant-action.mapper.js";
import { ParticipantActionValidationError } from "../../../src/modules/participant-action/participant-action.errors.js";
import { buildParticipantActionId } from "../../../src/modules/participant-action/domain/participant-action.types.js";

/**
 * Recovery Task 27 Part 21 "Mapping" (10-20) and "Validation" (21-29).
 *
 * Purely exercises the Mongo-independent mapping/validation functions — no
 * MongoDB connection is required for this file.
 */

function buildValidEnvelope(
  overrides: Partial<{
    petitionId: string;
    signatureId: string;
    participantId: string;
    initiativeId: string;
    signedAt: string;
  }> = {},
): CanonicalDomainEventEnvelope {
  const signedAt = overrides.signedAt ?? "2026-07-28T12:00:00.000Z";
  const event = createPetitionSignedEvent({
    petitionId: overrides.petitionId ?? "petition-mapping-fixture",
    signatureId: overrides.signatureId ?? "signature-mapping-fixture",
    participantId: overrides.participantId ?? "member-mapping-fixture",
    initiativeId: overrides.initiativeId ?? "initiative-mapping-fixture",
    participationMode: "Public",
    signedAt,
  });

  return toCanonicalEnvelope(event);
}

describe("10-17. Mapping PetitionSigned to a Participant Action", () => {
  it("10-11-12-13-14-15. maps every field to the documented source", () => {
    const envelope = buildValidEnvelope();
    const record = mapPetitionSignedToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.actionType, "petition_signed");
    assert.equal(record.sourceType, "petition_signature");
    assert.equal(record.participantId, "member-mapping-fixture");
    assert.equal(record.initiativeId, "initiative-mapping-fixture");
    assert.equal(record.sourceId, "signature-mapping-fixture");
    assert.equal(record.sourceEventId, envelope.eventId);
    assert.equal(record.sourceEventName, "PetitionSigned");
    assert.equal(record.occurredAt, "2026-07-28T12:00:00.000Z");
    assert.equal(record.recordedAt, "2026-07-28T12:00:05.000Z");
  });

  it("16. builds a deterministic Participant Action ID from the source event ID", () => {
    const envelope = buildValidEnvelope();
    const record = mapPetitionSignedToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.participantActionId, buildParticipantActionId(envelope.eventId));
  });

  it("17. sets validityStatus to valid", () => {
    const envelope = buildValidEnvelope();
    const record = mapPetitionSignedToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.validityStatus, "valid");
  });

  it("18-19-20. never introduces a Member status, Fair, or Journey field", () => {
    const envelope = buildValidEnvelope();
    const record = mapPetitionSignedToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    const forbiddenKeys = [
      "memberId",
      "memberStatus",
      "cohortLabel",
      "fairValue",
      "score",
      "weight",
      "multiplier",
      "pointsAwarded",
      "journeyState",
      "nextAction",
    ];

    for (const key of forbiddenKeys) {
      assert.equal(key in record, false, `ParticipantActionRecord must not include "${key}"`);
    }
  });
});

describe("21-29. Validation of the durable PetitionSigned contract", () => {
  it("21. rejects wrong event name", () => {
    const envelope = buildValidEnvelope();
    const tampered = { ...envelope, eventName: "SomethingElseHappened" };

    assert.throws(
      () => validatePetitionSignedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("22. rejects unsupported schema version", () => {
    const envelope = buildValidEnvelope();
    const tampered = {
      ...envelope,
      metadata: { ...envelope.metadata, schemaVersion: "2.0" as never },
    };

    assert.throws(
      () => validatePetitionSignedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("23. rejects wrong aggregate type", () => {
    const envelope = buildValidEnvelope();
    const tampered = { ...envelope, aggregateType: "Petition" };

    assert.throws(
      () => validatePetitionSignedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("24. rejects aggregate/signature mismatch", () => {
    const envelope = buildValidEnvelope();
    const tampered = { ...envelope, aggregateId: "signature-someone-elses" };

    assert.throws(
      () => validatePetitionSignedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("25. rejects missing participantId", () => {
    const envelope = buildValidEnvelope();
    const { participantId: _participantId, ...rest } = envelope.payload as Record<string, unknown>;
    const tampered = { ...envelope, payload: rest };

    assert.throws(
      () => validatePetitionSignedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("26. rejects obsolete memberId-only payload", () => {
    const envelope = buildValidEnvelope();
    const { participantId: _participantId, ...rest } = envelope.payload as Record<string, unknown>;
    const tampered = { ...envelope, payload: { ...rest, memberId: "member-legacy-fixture" } };

    assert.throws(
      () => validatePetitionSignedEnvelopeForParticipantAction(tampered),
      /obsolete "memberId"/,
    );
  });

  it("27. rejects missing initiativeId", () => {
    const envelope = buildValidEnvelope();
    const { initiativeId: _initiativeId, ...rest } = envelope.payload as Record<string, unknown>;
    const tampered = { ...envelope, payload: rest };

    assert.throws(
      () => validatePetitionSignedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("28. rejects malformed signedAt", () => {
    const envelope = buildValidEnvelope();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, signedAt: "not-a-timestamp" },
    };

    assert.throws(
      () => validatePetitionSignedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("29. accepts null participation mode", () => {
    const event = createPetitionSignedEvent({
      petitionId: "petition-mapping-fixture-null-mode",
      signatureId: "signature-mapping-fixture-null-mode",
      participantId: "member-mapping-fixture",
      initiativeId: "initiative-mapping-fixture",
      signedAt: "2026-07-28T12:00:00.000Z",
    });
    const envelope = toCanonicalEnvelope(event);

    assert.equal(envelope.payload.participationMode, null);
    assert.doesNotThrow(() => validatePetitionSignedEnvelopeForParticipantAction(envelope));
  });
});
