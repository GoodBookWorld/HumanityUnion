import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCanonicalEnvelope } from "../../../src/infrastructure/events/event-envelope.js";
import type { CanonicalDomainEventEnvelope } from "../../../src/infrastructure/events/domain-event.js";
import { createInitiativeDecisionVoteCastEvent } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-cast.event.js";
import { createInitiativeDecisionVoteChangedEvent } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-changed.event.js";
import {
  mapInitiativeDecisionVoteCastToParticipantAction,
  validateInitiativeDecisionVoteCastEnvelopeForParticipantAction,
} from "../../../src/modules/participant-action/application/initiative-decision-vote-cast-to-participant-action.mapper.js";
import {
  mapInitiativeDecisionVoteChangedToParticipantAction,
  validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction,
} from "../../../src/modules/participant-action/application/initiative-decision-vote-changed-to-participant-action.mapper.js";
import { ParticipantActionValidationError } from "../../../src/modules/participant-action/participant-action.errors.js";
import { buildParticipantActionId } from "../../../src/modules/participant-action/domain/participant-action.types.js";

/**
 * Recovery Task 33 Part 24 "Cast mapper" (7-17) and "Changed mapper"
 * (18-28) focused characterization tests. Purely exercises the
 * Mongo-independent mapping/validation functions — no MongoDB connection is
 * required for this file, mirroring `petition-signed-mapping.test.ts`.
 */

function buildCastEnvelope(
  overrides: Partial<{
    voteId: string;
    decisionId: string;
    participantId: string;
    initiativeId: string;
    choice: "support" | "do_not_support" | "abstain";
    votedAt: string;
    voteVersion: number;
  }> = {},
): CanonicalDomainEventEnvelope {
  const event = createInitiativeDecisionVoteCastEvent({
    voteId: overrides.voteId ?? "vote-mapping-fixture",
    decisionId: overrides.decisionId ?? "decision-mapping-fixture",
    participantId: overrides.participantId ?? "participant-mapping-fixture",
    initiativeId: overrides.initiativeId ?? "initiative-mapping-fixture",
    choice: overrides.choice ?? "support",
    votedAt: overrides.votedAt ?? "2026-07-28T12:00:00.000Z",
    voteVersion: overrides.voteVersion ?? 1,
  });

  return toCanonicalEnvelope(event);
}

function buildChangedEnvelope(
  overrides: Partial<{
    voteId: string;
    decisionId: string;
    participantId: string;
    initiativeId: string;
    previousChoice: "support" | "do_not_support" | "abstain";
    newChoice: "support" | "do_not_support" | "abstain";
    changedAt: string;
    previousVoteVersion: number;
    newVoteVersion: number;
  }> = {},
): CanonicalDomainEventEnvelope {
  const event = createInitiativeDecisionVoteChangedEvent({
    voteId: overrides.voteId ?? "vote-mapping-fixture",
    decisionId: overrides.decisionId ?? "decision-mapping-fixture",
    participantId: overrides.participantId ?? "participant-mapping-fixture",
    initiativeId: overrides.initiativeId ?? "initiative-mapping-fixture",
    previousChoice: overrides.previousChoice ?? "support",
    newChoice: overrides.newChoice ?? "do_not_support",
    changedAt: overrides.changedAt ?? "2026-07-28T12:05:00.000Z",
    previousVoteVersion: overrides.previousVoteVersion ?? 1,
    newVoteVersion: overrides.newVoteVersion ?? 2,
  });

  return toCanonicalEnvelope(event);
}

describe("7-17. Mapping InitiativeDecisionVoteCast to a Participant Action", () => {
  it("7. builds the deterministic Participant Action ID from sourceEventId", () => {
    const envelope = buildCastEnvelope();
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.participantActionId, buildParticipantActionId(envelope.eventId));
  });

  it("8. correct participantId", () => {
    const envelope = buildCastEnvelope({ participantId: "participant-cast-x" });
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.participantId, "participant-cast-x");
  });

  it("9. correct initiativeId", () => {
    const envelope = buildCastEnvelope({ initiativeId: "initiative-cast-x" });
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.initiativeId, "initiative-cast-x");
  });

  it("10. correct source type", () => {
    const envelope = buildCastEnvelope();
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.sourceType, "initiative_decision_vote");
  });

  it("11. correct source ID (the voteId, never decisionId/initiativeId/participantId/eventId/historyId)", () => {
    const envelope = buildCastEnvelope({ voteId: "vote-cast-source-id-x" });
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.sourceId, "vote-cast-source-id-x");
    assert.notEqual(record.sourceId, record.initiativeId);
    assert.notEqual(record.sourceId, record.participantId);
    assert.notEqual(record.sourceId, record.sourceEventId);
  });

  it("12. correct sourceEventId", () => {
    const envelope = buildCastEnvelope();
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.sourceEventId, envelope.eventId);
  });

  it("13. correct occurredAt", () => {
    const envelope = buildCastEnvelope({ votedAt: "2026-07-28T09:30:00.000Z" });
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.equal(record.occurredAt, "2026-07-28T09:30:00.000Z");
  });

  it("14. correct metadata (decisionId, choice, voteVersion)", () => {
    const envelope = buildCastEnvelope({
      decisionId: "decision-cast-metadata-x",
      choice: "abstain",
      voteVersion: 1,
    });
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    assert.deepEqual(record.metadata, {
      kind: "initiative_decision_vote_cast",
      decisionId: "decision-cast-metadata-x",
      choice: "abstain",
      voteVersion: 1,
    });
  });

  it("15. no Member fields", () => {
    const envelope = buildCastEnvelope();
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    const forbiddenKeys = ["memberId", "memberAction", "memberActivity", "memberStatus", "cohortLabel"];
    for (const key of forbiddenKeys) {
      assert.equal(key in record, false, `record must not include "${key}"`);
      assert.equal(
        record.metadata !== null && key in record.metadata,
        false,
        `metadata must not include "${key}"`,
      );
    }
  });

  it("16. no source lookup (mapper source references no lookup function)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(
        currentDir,
        "../../../src/modules/participant-action/application/initiative-decision-vote-cast-to-participant-action.mapper.ts",
      ),
      "utf8",
    );

    assert.doesNotMatch(source, /getVoteById\(|findInitiativeDecisionVote|getDecisionById\(|getInitiativeById\(|getMemberById\(/);
  });

  it("17. deterministic repeated mapping", () => {
    const envelope = buildCastEnvelope();
    const first = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");
    const second = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:06.000Z");

    // recordedAt is expected to differ (wall clock); every other field must not.
    const { recordedAt: _firstRecordedAt, ...firstRest } = first;
    const { recordedAt: _secondRecordedAt, ...secondRest } = second;
    assert.deepEqual(firstRest, secondRest);
  });
});

describe("Cast mapper validation", () => {
  it("rejects wrong event name", () => {
    const envelope = buildCastEnvelope();
    const tampered = { ...envelope, eventName: "SomethingElseHappened" };

    assert.throws(
      () => validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects unsupported schema version", () => {
    const envelope = buildCastEnvelope();
    const tampered = { ...envelope, metadata: { ...envelope.metadata, schemaVersion: "2.0" as never } };

    assert.throws(
      () => validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects wrong aggregate type", () => {
    const envelope = buildCastEnvelope();
    const tampered = { ...envelope, aggregateType: "InitiativeCollectiveDecision" };

    assert.throws(
      () => validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects aggregate/voteId mismatch", () => {
    const envelope = buildCastEnvelope();
    const tampered = { ...envelope, aggregateId: "vote-someone-elses" };

    assert.throws(
      () => validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects missing participantId", () => {
    const envelope = buildCastEnvelope();
    const { participantId: _participantId, ...rest } = envelope.payload as Record<string, unknown>;
    const tampered = { ...envelope, payload: rest };

    assert.throws(
      () => validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects invalid choice", () => {
    const envelope = buildCastEnvelope();
    const tampered = { ...envelope, payload: { ...envelope.payload, choice: "maybe" } };

    assert.throws(
      () => validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects malformed votedAt", () => {
    const envelope = buildCastEnvelope();
    const tampered = { ...envelope, payload: { ...envelope.payload, votedAt: "not-a-timestamp" } };

    assert.throws(
      () => validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects invalid voteVersion", () => {
    const envelope = buildCastEnvelope();
    const tampered = { ...envelope, payload: { ...envelope.payload, voteVersion: 0 } };

    assert.throws(
      () => validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });
});

describe("18-28. Mapping InitiativeDecisionVoteChanged to a Participant Action", () => {
  it("18. builds the deterministic Participant Action ID from sourceEventId", () => {
    const envelope = buildChangedEnvelope();
    const record = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelope,
      "2026-07-28T12:05:05.000Z",
    );

    assert.equal(record.participantActionId, buildParticipantActionId(envelope.eventId));
  });

  it("19. correct participantId", () => {
    const envelope = buildChangedEnvelope({ participantId: "participant-changed-x" });
    const record = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelope,
      "2026-07-28T12:05:05.000Z",
    );

    assert.equal(record.participantId, "participant-changed-x");
  });

  it("20. correct initiativeId", () => {
    const envelope = buildChangedEnvelope({ initiativeId: "initiative-changed-x" });
    const record = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelope,
      "2026-07-28T12:05:05.000Z",
    );

    assert.equal(record.initiativeId, "initiative-changed-x");
  });

  it("21. correct source identity (sourceType, sourceId = voteId, sourceEventId)", () => {
    const envelope = buildChangedEnvelope({ voteId: "vote-changed-source-id-x" });
    const record = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelope,
      "2026-07-28T12:05:05.000Z",
    );

    assert.equal(record.sourceType, "initiative_decision_vote");
    assert.equal(record.sourceId, "vote-changed-source-id-x");
    assert.equal(record.sourceEventId, envelope.eventId);
  });

  it("22. correct occurredAt", () => {
    const envelope = buildChangedEnvelope({ changedAt: "2026-07-28T10:00:00.000Z" });
    const record = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelope,
      "2026-07-28T12:05:05.000Z",
    );

    assert.equal(record.occurredAt, "2026-07-28T10:00:00.000Z");
  });

  it("23. correct previous/new choice metadata", () => {
    const envelope = buildChangedEnvelope({ previousChoice: "support", newChoice: "abstain" });
    const record = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelope,
      "2026-07-28T12:05:05.000Z",
    );

    assert.ok(record.metadata && "previousChoice" in record.metadata);
    assert.equal((record.metadata as { previousChoice: string }).previousChoice, "support");
    assert.equal((record.metadata as { newChoice: string }).newChoice, "abstain");
  });

  it("24. correct version metadata", () => {
    const envelope = buildChangedEnvelope({ previousVoteVersion: 2, newVoteVersion: 3 });
    const record = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelope,
      "2026-07-28T12:05:05.000Z",
    );

    assert.deepEqual(record.metadata, {
      kind: "initiative_decision_vote_changed",
      decisionId: "decision-mapping-fixture",
      previousChoice: "support",
      newChoice: "do_not_support",
      previousVoteVersion: 2,
      newVoteVersion: 3,
    });
  });

  it("25. distinct versions produce distinct actions", () => {
    const envelopeV2 = buildChangedEnvelope({ previousVoteVersion: 1, newVoteVersion: 2 });
    const envelopeV3 = buildChangedEnvelope({
      previousChoice: "do_not_support",
      newChoice: "abstain",
      previousVoteVersion: 2,
      newVoteVersion: 3,
    });

    const recordV2 = mapInitiativeDecisionVoteChangedToParticipantAction(envelopeV2, "2026-07-28T12:05:05.000Z");
    const recordV3 = mapInitiativeDecisionVoteChangedToParticipantAction(envelopeV3, "2026-07-28T12:05:06.000Z");

    assert.notEqual(recordV2.participantActionId, recordV3.participantActionId);
    assert.notEqual(recordV2.sourceEventId, recordV3.sourceEventId);
  });

  it("26. return-to-prior-choice still produces a distinct action", () => {
    // support -> abstain (v2), then abstain -> support (v3): the third
    // action must not be treated as a duplicate of the first Cast action.
    const envelopeV3 = buildChangedEnvelope({
      previousChoice: "abstain",
      newChoice: "support",
      previousVoteVersion: 2,
      newVoteVersion: 3,
    });
    const castEnvelope = buildCastEnvelope({ choice: "support", voteVersion: 1 });

    const castRecord = mapInitiativeDecisionVoteCastToParticipantAction(castEnvelope, "2026-07-28T12:00:05.000Z");
    const changedRecord = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelopeV3,
      "2026-07-28T12:05:05.000Z",
    );

    assert.notEqual(castRecord.participantActionId, changedRecord.participantActionId);
    assert.notEqual(castRecord.sourceEventId, changedRecord.sourceEventId);
  });

  it("27. no source lookup (mapper source references no lookup function)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(
        currentDir,
        "../../../src/modules/participant-action/application/initiative-decision-vote-changed-to-participant-action.mapper.ts",
      ),
      "utf8",
    );

    assert.doesNotMatch(source, /getVoteById\(|findInitiativeDecisionVote|getDecisionById\(|getInitiativeById\(|getMemberById\(/);
  });

  it("28. deterministic repeated mapping", () => {
    const envelope = buildChangedEnvelope();
    const first = mapInitiativeDecisionVoteChangedToParticipantAction(envelope, "2026-07-28T12:05:05.000Z");
    const second = mapInitiativeDecisionVoteChangedToParticipantAction(envelope, "2026-07-28T12:05:06.000Z");

    const { recordedAt: _firstRecordedAt, ...firstRest } = first;
    const { recordedAt: _secondRecordedAt, ...secondRest } = second;
    assert.deepEqual(firstRest, secondRest);
  });
});

describe("Changed mapper validation", () => {
  it("rejects wrong event name", () => {
    const envelope = buildChangedEnvelope();
    const tampered = { ...envelope, eventName: "SomethingElseHappened" };

    assert.throws(
      () => validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects equal previousChoice/newChoice", () => {
    const envelope = buildChangedEnvelope();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, previousChoice: "support", newChoice: "support" },
    };

    assert.throws(
      () => validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects a non-incrementing version transition", () => {
    const envelope = buildChangedEnvelope();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, previousVoteVersion: 1, newVoteVersion: 5 },
    };

    assert.throws(
      () => validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects aggregate/voteId mismatch", () => {
    const envelope = buildChangedEnvelope();
    const tampered = { ...envelope, aggregateId: "vote-someone-elses" };

    assert.throws(
      () => validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });

  it("rejects malformed changedAt", () => {
    const envelope = buildChangedEnvelope();
    const tampered = { ...envelope, payload: { ...envelope.payload, changedAt: "not-a-timestamp" } };

    assert.throws(
      () => validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction(tampered),
      ParticipantActionValidationError,
    );
  });
});
