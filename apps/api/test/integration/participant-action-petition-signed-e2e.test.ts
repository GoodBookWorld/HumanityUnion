import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { CATALOGUE_EVENTS } from "../../src/infrastructure/events/catalogue-events.js";
import {
  clearDomainEventHandlers,
  registerDomainEventHandler,
} from "../../src/infrastructure/integration/event-handler-registry.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByConsumerIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  dispatchOutboxOnceForTests,
  isEventProcessed,
} from "../../src/infrastructure/outbox/index.js";
import {
  deletePetitionsByIdForTests,
  deleteSignaturesByPetitionIdForTests,
  signPetition,
} from "../../src/modules/petition/petition.store.js";
import { buildPetitionSignedEventId } from "../../src/modules/petition/petition-signed.event.js";
import {
  handlePetitionSignedForParticipantAction,
  PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
} from "../../src/modules/participant-action/application/petition-signed.participant-action-handler.js";
import {
  countParticipantActionsBySourceEventId,
  deleteParticipantActionsBySourceEventIdForTests,
  findParticipantActionBySourceEventId,
  listParticipantActionsByInitiativeId,
  listParticipantActionsByParticipantId,
} from "../../src/modules/participant-action/infrastructure/participant-action.repository.js";
import { getMemberById } from "../../src/modules/member/member-access.js";
import { sampleMember } from "../../src/modules/member/member.sample.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import {
  drainPendingOutboxForTests,
  resetEventInfrastructureForTests,
} from "../helpers/test-events.js";
import { FIXTURE_INITIATIVE_ID, seedOpenPetition } from "../unit/petition/petition-test-helpers.js";

/**
 * Recovery Task 27 Part 21 "End-to-end" (checklist items 54-64).
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdPetitionIds: string[] = [];

function nextId(label: string): string {
  const id = `petition-task27-e2e-${label}-${testRunId}`;
  createdPetitionIds.push(id);
  return id;
}

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

  for (const petitionId of createdPetitionIds) {
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);
    const eventIdPrefix = `petition-signed:signature-${petitionId}-`;
    await deleteOutboxRecordsByEventIdPrefix(eventIdPrefix);
    await deleteProcessedEventsByEventIdPrefix(eventIdPrefix);
  }

  await deleteProcessedEventsByConsumerIdPrefix(PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID);
  await disconnectMongoClient();
});

describe("Recovery Task 27 — PetitionSigned to Participant Action, end-to-end", () => {
  it("54-59. signing a Petition and dispatching the event materializes exactly one Participant Action", async () => {
    clearDomainEventHandlers();
    registerDomainEventHandler({
      consumerId: PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.petitionSigned,
      handle: handlePetitionSignedForParticipantAction,
    });

    const petitionId = nextId("materialize");
    const decisionId = `decision-task27-e2e-materialize-${testRunId}`;
    const initiativeId = FIXTURE_INITIATIVE_ID;
    await seedOpenPetition(petitionId, decisionId, initiativeId);

    const memberBefore = await getMemberById(sampleMember.id);
    const activitiesBefore = await getMongoCollection(
      MONGO_COLLECTIONS.activities,
    ).estimatedDocumentCount();

    // 55. sign as a base Participant.
    const signed = await signPetition(petitionId, sampleMember.id, "Public");
    assert.equal(signed?.signatures.length, 1);
    const signature = signed!.signatures[0]!;

    // 56. confirm PetitionSigned event.
    const eventId = buildPetitionSignedEventId(signature.signatureId);
    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId,
    });
    assert.equal(outboxCount, 1);

    // 57. dispatch to Participant Action consumer.
    const dispatchCount = await dispatchOutboxOnceForTests();
    assert.ok(dispatchCount >= 1);

    // 58. confirm one Participant Action.
    const count = await countParticipantActionsBySourceEventId(eventId);
    assert.equal(count, 1);

    // 59. confirm participantId matches the signing actor.
    const record = await findParticipantActionBySourceEventId(eventId);
    assert.ok(record);
    assert.equal(record.participantId, sampleMember.id);
    assert.equal(record.initiativeId, initiativeId);
    assert.equal(record.sourceId, signature.signatureId);
    assert.equal(
      await isEventProcessed(PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID, eventId),
      true,
    );

    // 60-61. replay the event; confirm still one Participant Action.
    await handlePetitionSignedForParticipantAction(
      // Re-derive the envelope by reading it straight back from the outbox,
      // so this exercises exactly the durable, persisted event, not an
      // in-memory copy.
      (
        await import("../../src/infrastructure/events/event-serialization.js")
      ).deserializeDomainEventEnvelope(
        (await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
          eventId,
        }))!.envelope,
      ),
    );
    const countAfterReplay = await countParticipantActionsBySourceEventId(eventId);
    assert.equal(countAfterReplay, 1);

    // 62. Participant remains non-Member (Fair untouched) if initially non-Member.
    const memberAfter = await getMemberById(sampleMember.id);
    assert.deepEqual(memberAfter?.fair, memberBefore?.fair);

    // 63. Signature remains authoritative and unchanged.
    const finalSignatureCount = await getMongoCollection(
      MONGO_COLLECTIONS.petitionSignatures,
    ).countDocuments({
      petitionId,
    });
    assert.equal(finalSignatureCount, 1);

    const activitiesAfter = await getMongoCollection(
      MONGO_COLLECTIONS.activities,
    ).estimatedDocumentCount();
    assert.equal(activitiesAfter, activitiesBefore, "no Activity write must occur");

    // Internal query readiness (Part 19) — findable by Participant and Initiative.
    const byParticipant = await listParticipantActionsByParticipantId(sampleMember.id);
    assert.ok(byParticipant.some((entry) => entry.sourceEventId === eventId));
    const byInitiative = await listParticipantActionsByInitiativeId(initiativeId);
    assert.ok(byInitiative.some((entry) => entry.sourceEventId === eventId));

    // 64. clean owned fixtures (handled in `after`, plus this record explicitly).
    await deleteParticipantActionsBySourceEventIdForTests(eventId);
  });
});
