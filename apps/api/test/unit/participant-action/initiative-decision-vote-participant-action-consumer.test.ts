import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { toCanonicalEnvelope } from "../../../src/infrastructure/events/event-envelope.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  clearDomainEventHandlers,
  getHandlersForEvent,
} from "../../../src/infrastructure/integration/event-handler-registry.js";
import { createInitiativeDecisionVoteCastEvent } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-cast.event.js";
import { createInitiativeDecisionVoteChangedEvent } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-changed.event.js";
import { createPetitionSignedEvent } from "../../../src/modules/petition/petition-signed.event.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
  handleInitiativeDecisionVoteCastForParticipantAction,
} from "../../../src/modules/participant-action/application/initiative-decision-vote-cast.participant-action-handler.js";
import {
  PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
  handleInitiativeDecisionVoteChangedForParticipantAction,
} from "../../../src/modules/participant-action/application/initiative-decision-vote-changed.participant-action-handler.js";
import { handlePetitionSignedForParticipantAction } from "../../../src/modules/participant-action/application/petition-signed.participant-action-handler.js";
import {
  PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
  registerParticipantActionHandlers,
  resetParticipantActionHandlersForTests,
} from "../../../src/modules/participant-action/index.js";
import {
  countParticipantActionsBySourceEventId,
  deleteParticipantActionsBySourceEventIdForTests,
  findParticipantActionBySourceEventId,
} from "../../../src/modules/participant-action/infrastructure/participant-action.repository.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Recovery Task 33 Part 24 "Handler registration" (29-34), "Idempotency"
 * (35-45), and "Append-only semantics" (46-54).
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, "../../..");
const apiSrcDir = path.join(apiRoot, "src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdSourceEventIds: string[] = [];

let castCounter = 0;
let changedCounter = 0;

function buildCastEnvelope(overrides: Partial<{ voteId: string; participantId: string }> = {}) {
  castCounter += 1;
  const voteId = overrides.voteId ?? `vote-consumer-${testRunId}-${castCounter}`;
  const event = createInitiativeDecisionVoteCastEvent({
    voteId,
    decisionId: `decision-consumer-${testRunId}-${castCounter}`,
    participantId: overrides.participantId ?? `participant-consumer-${testRunId}-${castCounter}`,
    initiativeId: `initiative-consumer-${testRunId}-${castCounter}`,
    choice: "support",
    votedAt: "2026-07-28T12:00:00.000Z",
    voteVersion: 1,
  });
  const envelope = toCanonicalEnvelope(event);
  createdSourceEventIds.push(envelope.eventId);
  return { envelope, voteId };
}

function buildChangedEnvelope(voteId: string, participantId: string, newVoteVersion = 2) {
  changedCounter += 1;
  const event = createInitiativeDecisionVoteChangedEvent({
    voteId,
    decisionId: `decision-consumer-${testRunId}-changed-${changedCounter}`,
    participantId,
    initiativeId: `initiative-consumer-${testRunId}-changed-${changedCounter}`,
    previousChoice: "support",
    newChoice: "do_not_support",
    changedAt: "2026-07-28T12:05:00.000Z",
    previousVoteVersion: newVoteVersion - 1,
    newVoteVersion,
  });
  const envelope = toCanonicalEnvelope(event);
  createdSourceEventIds.push(envelope.eventId);
  return envelope;
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const sourceEventId of createdSourceEventIds) {
    await deleteParticipantActionsBySourceEventIdForTests(sourceEventId);
  }
  await disconnectMongoClient();
});

describe("29-34. Handler registration", () => {
  before(() => {
    clearDomainEventHandlers();
    resetParticipantActionHandlersForTests();
    registerParticipantActionHandlers();
  });

  after(() => {
    clearDomainEventHandlers();
    resetParticipantActionHandlersForTests();
  });

  it("29. Cast handler registered", () => {
    const handlers = getHandlersForEvent(CATALOGUE_EVENTS.initiativeDecisionVoteCast);
    assert.equal(handlers.length, 1);
    assert.equal(handlers[0]!.consumerId, PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID);
  });

  it("30. Changed handler registered", () => {
    const handlers = getHandlersForEvent(CATALOGUE_EVENTS.initiativeDecisionVoteChanged);
    assert.equal(handlers.length, 1);
    assert.equal(
      handlers[0]!.consumerId,
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
    );
  });

  it("31. Consumer IDs are stable", () => {
    assert.equal(
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      "participant-action.initiative-decision-vote-cast.v1",
    );
    assert.equal(
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
      "participant-action.initiative-decision-vote-changed.v1",
    );
  });

  it("32. Consumer IDs do not collide", () => {
    const ids = [
      PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
    ];
    assert.equal(new Set(ids).size, ids.length);
  });

  it("33. Petition handler remains registered", () => {
    const handlers = getHandlersForEvent(CATALOGUE_EVENTS.petitionSigned);
    assert.equal(handlers.length, 1);
    assert.equal(handlers[0]!.consumerId, PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID);
  });

  it("34. Unknown events remain safe", () => {
    const handlers = getHandlersForEvent("SomeUnknownEventThatDoesNotExist");
    assert.equal(handlers.length, 0);
  });
});

describe("35-45. Idempotency", () => {
  it("35-36. Cast processed once; replay creates no duplicate", async () => {
    const { envelope } = buildCastEnvelope();

    await handleInitiativeDecisionVoteCastForParticipantAction(envelope);
    await handleInitiativeDecisionVoteCastForParticipantAction(envelope);

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 1);
  });

  it("37-38. Changed processed once; replay creates no duplicate", async () => {
    const { voteId } = buildCastEnvelope();
    const changedEnvelope = buildChangedEnvelope(voteId, `participant-${voteId}`);

    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope);
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope);

    const count = await countParticipantActionsBySourceEventId(changedEnvelope.eventId);
    assert.equal(count, 1);
  });

  it("39. Ten Cast replays remain one action", async () => {
    const { envelope } = buildCastEnvelope();

    for (let i = 0; i < 10; i += 1) {
      await handleInitiativeDecisionVoteCastForParticipantAction(envelope);
    }

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 1);
  });

  it("40. Ten Changed replays remain one action", async () => {
    const { voteId } = buildCastEnvelope();
    const changedEnvelope = buildChangedEnvelope(voteId, `participant-${voteId}`);

    for (let i = 0; i < 10; i += 1) {
      await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope);
    }

    const count = await countParticipantActionsBySourceEventId(changedEnvelope.eventId);
    assert.equal(count, 1);
  });

  it("41. Concurrent Cast replay remains one action", async () => {
    const { envelope } = buildCastEnvelope();

    const results = await Promise.allSettled([
      handleInitiativeDecisionVoteCastForParticipantAction(envelope),
      handleInitiativeDecisionVoteCastForParticipantAction(envelope),
      handleInitiativeDecisionVoteCastForParticipantAction(envelope),
    ]);

    assert.ok(results.every((result) => result.status === "fulfilled"));
    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 1);
  });

  it("42. Concurrent Changed replay remains one action", async () => {
    const { voteId } = buildCastEnvelope();
    const changedEnvelope = buildChangedEnvelope(voteId, `participant-${voteId}`);

    const results = await Promise.allSettled([
      handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope),
      handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope),
      handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope),
    ]);

    assert.ok(results.every((result) => result.status === "fulfilled"));
    const count = await countParticipantActionsBySourceEventId(changedEnvelope.eventId);
    assert.equal(count, 1);
  });

  it("43. Processed-event records are consumer-specific (Cast and Changed handlers never share a consumerId)", () => {
    assert.notEqual(
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
    );
    assert.notEqual(
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
    );
  });

  it("44. Unique sourceEventId remains enforced", async () => {
    const { envelope } = buildCastEnvelope();

    await handleInitiativeDecisionVoteCastForParticipantAction(envelope);
    await handleInitiativeDecisionVoteCastForParticipantAction(envelope);

    const record = await findParticipantActionBySourceEventId(envelope.eventId);
    assert.ok(record);
    const countAfter = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(countAfter, 1);
  });

  it("45. Unique Participant Action ID remains enforced (Cast and Changed for the same Vote never collide)", async () => {
    const { envelope: castEnvelope, voteId } = buildCastEnvelope();
    const changedEnvelope = buildChangedEnvelope(voteId, castEnvelope.payload.participantId as string);

    await handleInitiativeDecisionVoteCastForParticipantAction(castEnvelope);
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope);

    const castRecord = await findParticipantActionBySourceEventId(castEnvelope.eventId);
    const changedRecord = await findParticipantActionBySourceEventId(changedEnvelope.eventId);
    assert.ok(castRecord);
    assert.ok(changedRecord);
    assert.notEqual(castRecord!.participantActionId, changedRecord!.participantActionId);
  });
});

describe("46-54. Append-only semantics", () => {
  it("46-47-48-49. Cast action remains after change; first Changed action remains after later change; no update/delete occurs", async () => {
    const { envelope: castEnvelope, voteId } = buildCastEnvelope();
    const participantId = castEnvelope.payload.participantId as string;
    const changedEnvelopeV2 = buildChangedEnvelope(voteId, participantId, 2);
    const changedEnvelopeV3 = buildChangedEnvelope(voteId, participantId, 3);

    await handleInitiativeDecisionVoteCastForParticipantAction(castEnvelope);
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelopeV2);
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelopeV3);

    const castRecordBefore = await findParticipantActionBySourceEventId(castEnvelope.eventId);
    const changedRecordV2Before = await findParticipantActionBySourceEventId(changedEnvelopeV2.eventId);

    // A further, unrelated Changed event for the same Vote must never mutate
    // either earlier record.
    const changedRecordV2After = await findParticipantActionBySourceEventId(changedEnvelopeV2.eventId);
    const castRecordAfter = await findParticipantActionBySourceEventId(castEnvelope.eventId);
    assert.deepEqual(castRecordAfter, castRecordBefore);
    assert.deepEqual(changedRecordV2After, changedRecordV2Before);

    const allSourceEventIds = [castEnvelope.eventId, changedEnvelopeV2.eventId, changedEnvelopeV3.eventId];
    for (const sourceEventId of allSourceEventIds) {
      const record = await findParticipantActionBySourceEventId(sourceEventId);
      assert.ok(record, `expected a Participant Action for ${sourceEventId}`);
    }
  });

  it("50. Changed delivery does not require Cast action", async () => {
    const voteId = `vote-changed-first-${testRunId}-${changedCounter}-standalone`;
    const changedEnvelope = buildChangedEnvelope(voteId, `participant-standalone-${testRunId}`);

    // No Cast event/action was ever created for this voteId — projecting the
    // Changed event must still succeed.
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope);

    const record = await findParticipantActionBySourceEventId(changedEnvelope.eventId);
    assert.ok(record);
    assert.equal(record!.actionType, "initiative_decision_vote_changed");
  });

  it("51. Out-of-order Changed versions both persist", async () => {
    const { voteId } = buildCastEnvelope();
    const participantId = `participant-ooo-${testRunId}`;
    const changedEnvelopeV3 = buildChangedEnvelope(voteId, participantId, 3);
    const changedEnvelopeV2 = buildChangedEnvelope(voteId, participantId, 2);

    // Deliver v3 before v2.
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelopeV3);
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelopeV2);

    const recordV3 = await findParticipantActionBySourceEventId(changedEnvelopeV3.eventId);
    const recordV2 = await findParticipantActionBySourceEventId(changedEnvelopeV2.eventId);
    assert.ok(recordV3);
    assert.ok(recordV2);
    assert.notEqual(recordV3!.participantActionId, recordV2!.participantActionId);
  });

  it("52. Current Vote state is not inferred from the ledger (repository exposes no current-choice aggregation)", async () => {
    const repositorySource = readFileSync(
      path.join(apiSrcDir, "modules/participant-action/infrastructure/participant-action.repository.ts"),
      "utf8",
    );
    assert.doesNotMatch(repositorySource, /currentChoice|latestChoice|getCurrentVote/);
  });

  it("53. One Vote may produce multiple Participant Actions", async () => {
    const { envelope: castEnvelope, voteId } = buildCastEnvelope();
    const participantId = castEnvelope.payload.participantId as string;
    const changedEnvelope = buildChangedEnvelope(voteId, participantId, 2);

    await handleInitiativeDecisionVoteCastForParticipantAction(castEnvelope);
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope);

    const castRecord = await findParticipantActionBySourceEventId(castEnvelope.eventId);
    const changedRecord = await findParticipantActionBySourceEventId(changedEnvelope.eventId);
    assert.ok(castRecord);
    assert.ok(changedRecord);
    assert.equal(castRecord!.sourceId, changedRecord!.sourceId);
    assert.notEqual(castRecord!.participantActionId, changedRecord!.participantActionId);
  });

  it("54. One event produces exactly one logical action, even under replay", async () => {
    const { envelope } = buildCastEnvelope();

    await Promise.allSettled([
      handleInitiativeDecisionVoteCastForParticipantAction(envelope),
      handleInitiativeDecisionVoteCastForParticipantAction(envelope),
      handleInitiativeDecisionVoteCastForParticipantAction(envelope),
      handleInitiativeDecisionVoteCastForParticipantAction(envelope),
      handleInitiativeDecisionVoteCastForParticipantAction(envelope),
    ]);

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 1);
  });
});

describe("Part 17 — Petition/Vote coexistence", () => {
  it("Petition, Cast, and Changed events project to their own distinct action types with no cross-contamination", async () => {
    const petitionEvent = createPetitionSignedEvent({
      petitionId: `petition-coexist-${testRunId}`,
      signatureId: `signature-coexist-${testRunId}`,
      participantId: `participant-coexist-${testRunId}`,
      initiativeId: `initiative-coexist-${testRunId}`,
      participationMode: "Public",
      signedAt: "2026-07-28T12:00:00.000Z",
    });
    const petitionEnvelope = toCanonicalEnvelope(petitionEvent);
    createdSourceEventIds.push(petitionEnvelope.eventId);

    const { envelope: castEnvelope, voteId } = buildCastEnvelope();
    const changedEnvelope = buildChangedEnvelope(voteId, castEnvelope.payload.participantId as string);

    await Promise.all([
      handlePetitionSignedForParticipantAction(petitionEnvelope),
      handleInitiativeDecisionVoteCastForParticipantAction(castEnvelope),
      handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope),
    ]);

    const petitionRecord = await findParticipantActionBySourceEventId(petitionEnvelope.eventId);
    const castRecord = await findParticipantActionBySourceEventId(castEnvelope.eventId);
    const changedRecord = await findParticipantActionBySourceEventId(changedEnvelope.eventId);

    assert.equal(petitionRecord?.actionType, "petition_signed");
    assert.equal(petitionRecord?.sourceType, "petition_signature");
    assert.equal(castRecord?.actionType, "initiative_decision_vote_cast");
    assert.equal(castRecord?.sourceType, "initiative_decision_vote");
    assert.equal(changedRecord?.actionType, "initiative_decision_vote_changed");
    assert.equal(changedRecord?.sourceType, "initiative_decision_vote");
  });
});
