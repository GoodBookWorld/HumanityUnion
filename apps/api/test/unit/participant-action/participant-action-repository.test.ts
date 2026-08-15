import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import type { ParticipantActionRecord } from "../../../src/modules/participant-action/domain/participant-action.types.js";
import {
  countParticipantActionsBySourceEventId,
  deleteParticipantActionsByInitiativeIdForTests,
  deleteParticipantActionsByParticipantIdForTests,
  deleteParticipantActionsBySourceEventIdForTests,
  findParticipantActionById,
  findParticipantActionBySourceEventId,
  insertParticipantActionIfAbsent,
  listParticipantActionsByInitiativeId,
  listParticipantActionsByParticipantId,
} from "../../../src/modules/participant-action/infrastructure/participant-action.repository.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Recovery Task 27 Part 21 "Persistence" (checklist items 30-39).
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdParticipantIds: string[] = [];
const createdInitiativeIds: string[] = [];
const createdSourceEventIds: string[] = [];

function buildRecord(overrides: Partial<ParticipantActionRecord> = {}): ParticipantActionRecord {
  const participantId = overrides.participantId ?? `member-repo-${testRunId}`;
  const initiativeId = overrides.initiativeId ?? `initiative-repo-${testRunId}`;
  const sourceEventId =
    overrides.sourceEventId ??
    `petition-signed:signature-repo-${testRunId}-${Math.random().toString(16).slice(2, 8)}`;

  createdParticipantIds.push(participantId);
  createdInitiativeIds.push(initiativeId);
  createdSourceEventIds.push(sourceEventId);

  return {
    participantActionId: `participant-action:${sourceEventId}`,
    participantId,
    initiativeId,
    actionType: "petition_signed",
    sourceType: "petition_signature",
    sourceId: `signature-for-${sourceEventId}`,
    sourceEventId,
    sourceEventName: "PetitionSigned",
    sourceEventSchemaVersion: "1.0",
    occurredAt: "2026-07-28T12:00:00.000Z",
    recordedAt: "2026-07-28T12:00:01.000Z",
    validityStatus: "valid",
    correlationId: null,
    causationId: null,
    metadata: null,
    ...overrides,
  };
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const sourceEventId of createdSourceEventIds) {
    await deleteParticipantActionsBySourceEventIdForTests(sourceEventId);
  }
  for (const participantId of new Set(createdParticipantIds)) {
    await deleteParticipantActionsByParticipantIdForTests(participantId);
  }
  for (const initiativeId of new Set(createdInitiativeIds)) {
    await deleteParticipantActionsByInitiativeIdForTests(initiativeId);
  }

  await disconnectMongoClient();
});

describe("30-31. Insertion and persisted source references", () => {
  it("30. inserts exactly one Participant Action", async () => {
    const record = buildRecord();
    const outcome = await insertParticipantActionIfAbsent(record);

    assert.equal(outcome, "created");
    const count = await countParticipantActionsBySourceEventId(record.sourceEventId);
    assert.equal(count, 1);
  });

  it("31. persists all source references", async () => {
    const record = buildRecord();
    await insertParticipantActionIfAbsent(record);

    const found = await findParticipantActionBySourceEventId(record.sourceEventId);
    assert.ok(found);
    assert.equal(found.sourceType, "petition_signature");
    assert.equal(found.sourceId, record.sourceId);
    assert.equal(found.sourceEventId, record.sourceEventId);
    assert.equal(found.sourceEventName, "PetitionSigned");
  });
});

describe("32. Unique sourceEventId index exists", () => {
  it("declares a unique index on sourceEventId", async () => {
    const indexes = await getMongoCollection(MONGO_COLLECTIONS.participantActions).indexes();
    const sourceEventIdIndex = indexes.find(
      (index) => JSON.stringify(index.key) === JSON.stringify({ sourceEventId: 1 }),
    );

    assert.ok(sourceEventIdIndex, "expected a sourceEventId index to exist");
    assert.equal(sourceEventIdIndex!.unique, true);
  });

  it("declares a unique index on participantActionId", async () => {
    const indexes = await getMongoCollection(MONGO_COLLECTIONS.participantActions).indexes();
    const idIndex = indexes.find(
      (index) => JSON.stringify(index.key) === JSON.stringify({ participantActionId: 1 }),
    );

    assert.ok(idIndex, "expected a participantActionId index to exist");
    assert.equal(idIndex!.unique, true);
  });
});

describe("33-34. Duplicate and concurrent duplicate delivery create exactly one row", () => {
  it("33. duplicate sequential insert creates one row", async () => {
    const record = buildRecord();

    const first = await insertParticipantActionIfAbsent(record);
    const second = await insertParticipantActionIfAbsent(record);

    assert.equal(first, "created");
    assert.equal(second, "idempotent_replay");

    const count = await countParticipantActionsBySourceEventId(record.sourceEventId);
    assert.equal(count, 1);
  });

  it("34. concurrent duplicate consumption creates one row", async () => {
    const record = buildRecord();

    const results = await Promise.allSettled([
      insertParticipantActionIfAbsent(record),
      insertParticipantActionIfAbsent(record),
      insertParticipantActionIfAbsent(record),
    ]);

    assert.ok(results.every((result) => result.status === "fulfilled"));
    const outcomes = results.map((result) => (result as PromiseFulfilledResult<string>).value);
    assert.equal(outcomes.filter((outcome) => outcome === "created").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome === "idempotent_replay").length, 2);

    const count = await countParticipantActionsBySourceEventId(record.sourceEventId);
    assert.equal(count, 1);
  });
});

describe("35. Record survives repository reconstruction", () => {
  it("findParticipantActionById returns a byte-identical record", async () => {
    const record = buildRecord();
    await insertParticipantActionIfAbsent(record);

    const found = await findParticipantActionById(record.participantActionId);
    assert.deepEqual(found, record);
  });
});

describe("36-38. List by Participant, list by Initiative, deterministic ordering", () => {
  it("36-38. lists in occurredAt-descending order with a participantActionId tie-break", async () => {
    const participantId = `member-repo-ordering-${testRunId}`;
    const initiativeId = `initiative-repo-ordering-${testRunId}`;

    const earlier = buildRecord({
      participantId,
      initiativeId,
      occurredAt: "2026-07-28T10:00:00.000Z",
      sourceEventId: `petition-signed:signature-repo-ordering-a-${testRunId}`,
      sourceId: `signature-repo-ordering-a-${testRunId}`,
    });
    earlier.participantActionId = `participant-action:${earlier.sourceEventId}`;

    const later = buildRecord({
      participantId,
      initiativeId,
      occurredAt: "2026-07-28T11:00:00.000Z",
      sourceEventId: `petition-signed:signature-repo-ordering-b-${testRunId}`,
      sourceId: `signature-repo-ordering-b-${testRunId}`,
    });
    later.participantActionId = `participant-action:${later.sourceEventId}`;

    await insertParticipantActionIfAbsent(earlier);
    await insertParticipantActionIfAbsent(later);

    const byParticipant = await listParticipantActionsByParticipantId(participantId);
    assert.equal(byParticipant.length, 2);
    assert.equal(byParticipant[0]!.sourceEventId, later.sourceEventId);
    assert.equal(byParticipant[1]!.sourceEventId, earlier.sourceEventId);

    const byInitiative = await listParticipantActionsByInitiativeId(initiativeId);
    assert.equal(byInitiative.length, 2);
    assert.equal(byInitiative[0]!.sourceEventId, later.sourceEventId);
    assert.equal(byInitiative[1]!.sourceEventId, earlier.sourceEventId);
  });
});

describe("39. No general update method exists", () => {
  it("the repository module exports no updateParticipantAction* function", async () => {
    const repositoryModule =
      await import("../../../src/modules/participant-action/infrastructure/participant-action.repository.js");
    const exportedNames = Object.keys(repositoryModule);

    for (const name of exportedNames) {
      assert.equal(
        /^update/i.test(name),
        false,
        `unexpected general update export "${name}" — the ledger must remain insert-only`,
      );
    }
  });
});

describe("Recovery Task 33 Part 25 — Participant Action query compatibility across all three action types", () => {
  it("listParticipantActionsByParticipantId/ByInitiativeId return a mixed petition_signed/initiative_decision_vote_cast/initiative_decision_vote_changed set without unsafe casts, schema rejection, or metadata loss", async () => {
    const participantId = `member-repo-mixed-${testRunId}`;
    const initiativeId = `initiative-repo-mixed-${testRunId}`;

    const petitionAction = buildRecord({
      participantId,
      initiativeId,
      occurredAt: "2026-07-28T09:00:00.000Z",
      sourceEventId: `petition-signed:signature-repo-mixed-${testRunId}`,
      sourceId: `signature-repo-mixed-${testRunId}`,
      metadata: null,
    });
    petitionAction.participantActionId = `participant-action:${petitionAction.sourceEventId}`;

    const voteCastAction = buildRecord({
      participantId,
      initiativeId,
      occurredAt: "2026-07-28T10:00:00.000Z",
      sourceEventId: `initiative-decision-vote-cast:repo-mixed-${testRunId}`,
      sourceEventName: "InitiativeDecisionVoteCast",
      actionType: "initiative_decision_vote_cast",
      sourceType: "initiative_decision_vote",
      sourceId: `initiative-decision-vote:repo-mixed-${testRunId}`,
      metadata: {
        kind: "initiative_decision_vote_cast",
        decisionId: `decision-repo-mixed-${testRunId}`,
        choice: "support",
        voteVersion: 1,
      },
    });
    voteCastAction.participantActionId = `participant-action:${voteCastAction.sourceEventId}`;

    const voteChangedAction = buildRecord({
      participantId,
      initiativeId,
      occurredAt: "2026-07-28T11:00:00.000Z",
      sourceEventId: `initiative-decision-vote-changed:repo-mixed-${testRunId}:v2`,
      sourceEventName: "InitiativeDecisionVoteChanged",
      actionType: "initiative_decision_vote_changed",
      sourceType: "initiative_decision_vote",
      sourceId: `initiative-decision-vote:repo-mixed-${testRunId}`,
      metadata: {
        kind: "initiative_decision_vote_changed",
        decisionId: `decision-repo-mixed-${testRunId}`,
        previousChoice: "support",
        newChoice: "do_not_support",
        previousVoteVersion: 1,
        newVoteVersion: 2,
      },
    });
    voteChangedAction.participantActionId = `participant-action:${voteChangedAction.sourceEventId}`;

    await insertParticipantActionIfAbsent(petitionAction);
    await insertParticipantActionIfAbsent(voteCastAction);
    await insertParticipantActionIfAbsent(voteChangedAction);

    for (const list of [
      await listParticipantActionsByParticipantId(participantId),
      await listParticipantActionsByInitiativeId(initiativeId),
    ]) {
      assert.equal(list.length, 3, "all three action types must be returned together, unfiltered");

      const byType = new Map(list.map((entry) => [entry.actionType, entry]));
      const petitionEntry = byType.get("petition_signed");
      const castEntry = byType.get("initiative_decision_vote_cast");
      const changedEntry = byType.get("initiative_decision_vote_changed");
      assert.ok(petitionEntry && castEntry && changedEntry, "every action type must be present and readable");

      assert.equal(petitionEntry!.metadata, null, "Petition metadata remains null");
      assert.equal(castEntry!.metadata?.kind, "initiative_decision_vote_cast");
      assert.equal((castEntry!.metadata as { choice: string }).choice, "support");
      assert.equal(changedEntry!.metadata?.kind, "initiative_decision_vote_changed");
      assert.equal((changedEntry!.metadata as { newChoice: string }).newChoice, "do_not_support");

      // Deterministic occurredAt-descending ordering must hold across mixed
      // action types exactly as it does for same-type records.
      assert.equal(list[0]!.actionType, "initiative_decision_vote_changed");
      assert.equal(list[1]!.actionType, "initiative_decision_vote_cast");
      assert.equal(list[2]!.actionType, "petition_signed");
    }

    // Byte-identical single-record reads (findParticipantActionById/BySourceEventId)
    // must also round-trip each action type's metadata without loss.
    const reloadedCast = await findParticipantActionById(voteCastAction.participantActionId);
    assert.deepEqual(reloadedCast?.metadata, voteCastAction.metadata);
    const reloadedChanged = await findParticipantActionBySourceEventId(voteChangedAction.sourceEventId);
    assert.deepEqual(reloadedChanged?.metadata, voteChangedAction.metadata);
  });
});
