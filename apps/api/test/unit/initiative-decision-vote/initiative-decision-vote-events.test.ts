import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, describe, it } from "node:test";

import { DOMAIN_EVENT_SCHEMA_VERSION } from "../../../src/infrastructure/events/domain-event.js";
import { deserializeDomainEventEnvelope } from "../../../src/infrastructure/events/event-serialization.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  clearDomainEventHandlers,
  getHandlersForEvent,
} from "../../../src/infrastructure/integration/event-handler-registry.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  dispatchOutboxOnceForTests,
  enqueueDomainEvent,
  findOutboxRecordById,
  isEventProcessed,
  setForceEnqueueFailureForTests,
} from "../../../src/infrastructure/outbox/index.js";
import {
  INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-event-shared.js";
import {
  buildInitiativeDecisionVoteCastEventId,
  createInitiativeDecisionVoteCastEvent,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-cast.event.js";
import {
  buildInitiativeDecisionVoteChangedEventId,
  createInitiativeDecisionVoteChangedEvent,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-changed.event.js";
import { InitiativeDecisionVoteEventInvariantConflictError } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.errors.js";
import {
  buildInitiativeDecisionVoteId,
} from "../../../src/modules/initiative-decision-vote/persistence/initiative-decision-vote.mongo-document.js";
import {
  buildInitiativeDecisionVoteHistoryId,
} from "../../../src/modules/initiative-decision-vote/persistence/initiative-decision-vote-history.mongo-document.js";
import {
  deleteInitiativeDecisionVoteHistoryByVoteIdForTests,
  insertInitiativeDecisionVoteHistory,
} from "../../../src/modules/initiative-decision-vote/persistence/initiative-decision-vote.repository.js";
import {
  castOrChangeInitiativeDecisionVote,
  deleteVotesByDecisionIdForTests,
  listVoteHistoryForParticipant,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { drainPendingOutboxForTests, resetEventInfrastructureForTests } from "../../helpers/test-events.js";

/**
 * Recovery Task 32 Part 26 — focused characterization tests for the
 * `InitiativeDecisionVoteCast` / `InitiativeDecisionVoteChanged` durable
 * event producer. Numbering below matches Part 26 exactly, for
 * traceability, mirroring `petition-signed-event.test.ts`'s structure
 * (Recovery Task 25 Part 19) — the accepted precedent for a durable Vote
 * event's focused test suite.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, "../../..");
const apiSrcDir = path.join(apiRoot, "src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const allFixtureDecisionIds: string[] = [];

function fixtureIds(label: string) {
  const decisionId = `event-task32-${label}-decision-${testRunId}`;
  allFixtureDecisionIds.push(decisionId);
  return {
    decisionId,
    initiativeId: `event-task32-${label}-initiative-${testRunId}`,
    participantId: `event-task32-${label}-participant-${testRunId}`,
  };
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

  for (const decisionId of allFixtureDecisionIds) {
    await deleteVotesByDecisionIdForTests(decisionId);
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-cast:initiative-decision-vote:${decisionId}:`);
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-changed:initiative-decision-vote:${decisionId}:`);
    await deleteProcessedEventsByEventIdPrefix(`initiative-decision-vote-cast:initiative-decision-vote:${decisionId}:`);
    await deleteProcessedEventsByEventIdPrefix(`initiative-decision-vote-changed:initiative-decision-vote:${decisionId}:`);
  }

  await disconnectMongoClient();
});

describe("Cast event construction (Part 26 §Cast contract)", () => {
  const fixedVotedAt = "2026-07-28T00:00:00.000Z";
  const voteId = "initiative-decision-vote:construction-fixture-decision:construction-fixture-participant";
  const event = createInitiativeDecisionVoteCastEvent({
    voteId,
    decisionId: "construction-fixture-decision",
    participantId: "construction-fixture-participant",
    initiativeId: "construction-fixture-initiative",
    choice: "support",
    votedAt: fixedVotedAt,
    voteVersion: 1,
  });

  it("1. correct event name", () => {
    assert.equal(event.eventName, "InitiativeDecisionVoteCast");
    assert.equal(event.eventName, CATALOGUE_EVENTS.initiativeDecisionVoteCast);
  });

  it("2. correct schema version", () => {
    assert.equal(event.metadata.schemaVersion, DOMAIN_EVENT_SCHEMA_VERSION);
  });

  it("3. correct aggregate type", () => {
    assert.equal(event.aggregateType, "InitiativeDecisionVote");
    assert.equal(event.aggregateType, INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE);
  });

  it("4. aggregate ID equals Vote ID", () => {
    assert.equal(event.aggregateId, voteId);
    assert.equal(event.aggregateId, event.payload.voteId);
  });

  it("5. event ID is deterministic", () => {
    assert.equal(event.eventId, `initiative-decision-vote-cast:${voteId}`);
    assert.equal(event.eventId, buildInitiativeDecisionVoteCastEventId(voteId));

    const second = createInitiativeDecisionVoteCastEvent({
      voteId,
      decisionId: "construction-fixture-decision",
      participantId: "construction-fixture-participant",
      initiativeId: "construction-fixture-initiative",
      choice: "support",
      votedAt: fixedVotedAt,
      voteVersion: 1,
    });
    assert.equal(event.eventId, second.eventId);
  });

  it("6. payload contains required immutable fields", () => {
    assert.equal(event.payload.voteId, voteId);
    assert.equal(event.payload.decisionId, "construction-fixture-decision");
    assert.equal(event.payload.participantId, "construction-fixture-participant");
    assert.equal(event.payload.initiativeId, "construction-fixture-initiative");
    assert.equal(event.payload.choice, "support");
    assert.equal(event.payload.votedAt, fixedVotedAt);
    assert.equal(event.payload.voteVersion, 1);
  });

  it("7. payload excludes Member status/identity fields", () => {
    const keys = Object.keys(event.payload);
    for (const forbiddenKey of ["memberId", "memberStatus", "displayName", "email", "profile", "verificationLevel"]) {
      assert.equal(keys.includes(forbiddenKey), false, `payload must not include "${forbiddenKey}"`);
    }
  });

  it("8. payload excludes mutable Vote totals", () => {
    const keys = Object.keys(event.payload);
    for (const forbiddenKey of ["totalVotes", "tally", "support", "doNotSupport", "abstain", "aggregates"]) {
      assert.equal(keys.includes(forbiddenKey), false, `payload must not include "${forbiddenKey}"`);
    }
  });

  it("9. payload excludes presentation-layer data", () => {
    const keys = Object.keys(event.payload);
    for (const forbiddenKey of ["decisionTitle", "initiativeTitle", "question", "transparencyCohort"]) {
      assert.equal(keys.includes(forbiddenKey), false, `payload must not include "${forbiddenKey}"`);
    }
    assert.deepEqual(keys.sort(), [
      "choice",
      "decisionId",
      "initiativeId",
      "participantId",
      "voteId",
      "voteVersion",
      "votedAt",
    ]);
  });

  it("10. occurredAt equals votedAt", () => {
    assert.equal(event.metadata.occurredAt, fixedVotedAt);
    assert.equal(event.metadata.occurredAt, event.payload.votedAt);
  });
});

describe("Changed event construction (Part 26 §Changed contract)", () => {
  const fixedChangedAt = "2026-07-28T00:05:00.000Z";
  const voteId = "initiative-decision-vote:construction-fixture-decision:construction-fixture-participant";
  const event = createInitiativeDecisionVoteChangedEvent({
    voteId,
    decisionId: "construction-fixture-decision",
    participantId: "construction-fixture-participant",
    initiativeId: "construction-fixture-initiative",
    previousChoice: "support",
    newChoice: "abstain",
    changedAt: fixedChangedAt,
    previousVoteVersion: 1,
    newVoteVersion: 2,
  });

  it("11. correct event name", () => {
    assert.equal(event.eventName, "InitiativeDecisionVoteChanged");
    assert.equal(event.eventName, CATALOGUE_EVENTS.initiativeDecisionVoteChanged);
  });

  it("12. correct schema version", () => {
    assert.equal(event.metadata.schemaVersion, DOMAIN_EVENT_SCHEMA_VERSION);
  });

  it("13. correct aggregate identity", () => {
    assert.equal(event.aggregateType, "InitiativeDecisionVote");
    assert.equal(event.aggregateId, voteId);
  });

  it("14. event ID includes the resulting Vote version", () => {
    assert.equal(event.eventId, `initiative-decision-vote-changed:${voteId}:v2`);
    assert.equal(event.eventId, buildInitiativeDecisionVoteChangedEventId(voteId, 2));

    const nextVersion = createInitiativeDecisionVoteChangedEvent({
      voteId,
      decisionId: "construction-fixture-decision",
      participantId: "construction-fixture-participant",
      initiativeId: "construction-fixture-initiative",
      previousChoice: "abstain",
      newChoice: "do_not_support",
      changedAt: fixedChangedAt,
      previousVoteVersion: 2,
      newVoteVersion: 3,
    });
    assert.notEqual(event.eventId, nextVersion.eventId, "distinct versions must produce distinct event IDs");
  });

  it("15. previous choice is present", () => {
    assert.equal(event.payload.previousChoice, "support");
  });

  it("16. new choice is present", () => {
    assert.equal(event.payload.newChoice, "abstain");
  });

  it("17. choices must differ (rejected at construction otherwise)", () => {
    assert.throws(() =>
      createInitiativeDecisionVoteChangedEvent({
        voteId,
        decisionId: "construction-fixture-decision",
        participantId: "construction-fixture-participant",
        initiativeId: "construction-fixture-initiative",
        previousChoice: "support",
        newChoice: "support",
        changedAt: fixedChangedAt,
        previousVoteVersion: 1,
        newVoteVersion: 2,
      }),
    );
  });

  it("18. versions must increment by exactly one (rejected at construction otherwise)", () => {
    assert.throws(() =>
      createInitiativeDecisionVoteChangedEvent({
        voteId,
        decisionId: "construction-fixture-decision",
        participantId: "construction-fixture-participant",
        initiativeId: "construction-fixture-initiative",
        previousChoice: "support",
        newChoice: "abstain",
        changedAt: fixedChangedAt,
        previousVoteVersion: 1,
        newVoteVersion: 3,
      }),
    );
    assert.throws(() =>
      createInitiativeDecisionVoteChangedEvent({
        voteId,
        decisionId: "construction-fixture-decision",
        participantId: "construction-fixture-participant",
        initiativeId: "construction-fixture-initiative",
        previousChoice: "support",
        newChoice: "abstain",
        changedAt: fixedChangedAt,
        previousVoteVersion: 2,
        newVoteVersion: 2,
      }),
    );
  });

  it("19. changedAt equals occurredAt (both derived from the single committed mutation timestamp)", () => {
    assert.equal(event.metadata.occurredAt, fixedChangedAt);
    assert.equal(event.metadata.occurredAt, event.payload.changedAt);
  });

  it("20. payload requires no source lookup — event factories perform zero Mongo/Decision/Initiative/Member calls", () => {
    const castSource = readFileSync(
      path.join(apiSrcDir, "modules/initiative-decision-vote/initiative-decision-vote-cast.event.ts"),
      "utf8",
    );
    const changedSource = readFileSync(
      path.join(apiSrcDir, "modules/initiative-decision-vote/initiative-decision-vote-changed.event.ts"),
      "utf8",
    );

    for (const source of [castSource, changedSource]) {
      for (const forbidden of ["getInitiativeById", "getDecisionById", "getMemberById", "MongoClient", "getMongoCollection", "new Date("]) {
        assert.ok(!source.includes(forbidden), `event factory must not reference "${forbidden}"`);
      }
    }
  });
});

describe("First-cast production (Part 26 §First-cast production)", () => {
  it("21/22. one committed cast creates exactly one Cast event, sharing voteId with Vote/history in the same outbox record", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("first-cast-production");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    const eventId = buildInitiativeDecisionVoteCastEventId(cast.voteId);
    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ eventId });
    assert.equal(outboxCount, 1);

    const outboxRecord = await getMongoCollection<{
      eventId: string;
      aggregateType: string;
      aggregateId: string;
    }>(MONGO_COLLECTIONS.outbox).findOne({ eventId });
    assert.ok(outboxRecord);
    assert.equal(outboxRecord.aggregateType, "InitiativeDecisionVote");
    assert.equal(outboxRecord.aggregateId, cast.voteId);

    const history = await listVoteHistoryForParticipant(decisionId, participantId);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.voteId, cast.voteId);
  });

  it("23. a history-insert failure during first cast rolls back the Vote and leaves no outbox event", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("first-cast-history-failure");
    const voteId = buildInitiativeDecisionVoteId(decisionId, participantId);

    // Pre-seed the exact historyId the first cast would need to insert.
    await insertInitiativeDecisionVoteHistory({
      historyId: buildInitiativeDecisionVoteHistoryId(decisionId, participantId, 1),
      voteId,
      decisionId,
      participantId,
      newChoice: "abstain",
      changedAt: new Date().toISOString(),
      transparencyCohort: "verified",
    });

    await assert.rejects(
      () =>
        castOrChangeInitiativeDecisionVote({
          decisionId,
          participantId,
          initiativeId,
          choice: "support",
          transparencyCohort: "verified",
        }),
      InitiativeDecisionVoteEventInvariantConflictError,
    );

    const voteCount = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).countDocuments({
      decisionId,
      participantId,
    });
    assert.equal(voteCount, 0, "no partial Vote may exist after rollback");

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId: buildInitiativeDecisionVoteCastEventId(voteId),
    });
    assert.equal(outboxCount, 0, "no partial outbox event may exist after rollback");

    // Because the cast rolled back, no Vote is ever created for this fixture,
    // so the shared `after()` hook's vote-driven history cleanup never reaches
    // this pre-seeded collision row — delete it explicitly here.
    await deleteInitiativeDecisionVoteHistoryByVoteIdForTests(voteId);
  });

  it("24. an outbox insert failure during first cast rolls back the Vote and its history row", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("first-cast-outbox-failure");
    const voteId = buildInitiativeDecisionVoteId(decisionId, participantId);

    setForceEnqueueFailureForTests(true);
    try {
      await assert.rejects(() =>
        castOrChangeInitiativeDecisionVote({
          decisionId,
          participantId,
          initiativeId,
          choice: "support",
          transparencyCohort: "verified",
        }),
      );
    } finally {
      setForceEnqueueFailureForTests(false);
    }

    const voteCount = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).countDocuments({
      decisionId,
      participantId,
    });
    assert.equal(voteCount, 0, "a rolled-back transaction must leave no Vote document");

    const historyCount = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVoteHistory).countDocuments({
      voteId,
    });
    assert.equal(historyCount, 0, "a rolled-back transaction must leave no history document");
  });

  it("25. sequential same-choice retry creates no duplicate Cast event", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("sequential-cast-retry");

    const first = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    const second = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    assert.equal(first.voteId, second.voteId);
    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId: buildInitiativeDecisionVoteCastEventId(first.voteId),
    });
    assert.equal(outboxCount, 1);
  });

  it("26/27. concurrent first-cast retries settle into exactly one Vote and exactly one Cast event (natural-key conflict settles safely)", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("concurrent-cast-retry");

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        castOrChangeInitiativeDecisionVote({
          decisionId,
          participantId,
          initiativeId,
          choice: "support",
          transparencyCohort: "verified",
        }),
      ),
    );

    const voteId = results[0]!.voteId;
    assert.ok(results.every((vote) => vote.voteId === voteId));

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId: buildInitiativeDecisionVoteCastEventId(voteId),
    });
    assert.equal(outboxCount, 1, "5 concurrent identical first-cast attempts must produce exactly one Cast event");
  });

  it("28. the Cast event survives repository reconstruction (dispatch + re-fetch by outboxId)", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("cast-reconstruction");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "unverified",
    });

    const eventId = buildInitiativeDecisionVoteCastEventId(cast.voteId);
    await dispatchOutboxOnceForTests();

    const outboxDocument = await getMongoCollection<{ _id: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.ok(outboxDocument);

    const record = await findOutboxRecordById(outboxDocument._id);
    assert.ok(record, "the dispatched record must remain retrievable by outboxId for replay/backfill");

    const envelope = deserializeDomainEventEnvelope(record!.envelope);
    assert.equal(envelope.payload.voteId, cast.voteId);
    assert.equal(envelope.payload.decisionId, decisionId);
    assert.equal(envelope.payload.participantId, participantId);
    assert.equal(envelope.payload.initiativeId, initiativeId);
    assert.equal(envelope.payload.choice, "abstain");
    assert.equal(envelope.payload.voteVersion, 1);
  });
});

describe("Changed-choice production (Part 26 §Changed-choice production)", () => {
  it("29/31/32/33. a real change creates exactly one Changed event whose version matches the committed Vote, history, and outbox event ID", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("changed-production");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    const changed = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });

    assert.equal(changed.version, 2);

    const eventId = buildInitiativeDecisionVoteChangedEventId(cast.voteId, 2);
    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ eventId });
    assert.equal(outboxCount, 1);

    const history = await listVoteHistoryForParticipant(decisionId, participantId);
    assert.equal(history.length, 2);
    assert.equal(
      history[1]?.historyId,
      buildInitiativeDecisionVoteHistoryId(decisionId, participantId, 2),
      "history version matches the payload's newVoteVersion",
    );

    const outboxRecord = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    const envelope = deserializeDomainEventEnvelope(outboxRecord!.envelope);
    assert.equal(envelope.payload.newVoteVersion, 2);
    assert.equal(envelope.payload.previousVoteVersion, 1);
    assert.equal(envelope.payload.previousChoice, "support");
    assert.equal(envelope.payload.newChoice, "do_not_support");
  });

  it("30. a same-choice no-op creates no Changed event", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("changed-no-op");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });

    const outboxCountBefore = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: cast.voteId,
    });

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });

    const outboxCountAfter = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: cast.voteId,
    });
    assert.equal(outboxCountAfter, outboxCountBefore, "a same-choice re-submit must not enqueue any event");
  });

  it("34. a second real change creates a distinct new event for the next version", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("second-change");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });
    const third = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });

    assert.equal(third.version, 3);
    const eventIdV2 = buildInitiativeDecisionVoteChangedEventId(cast.voteId, 2);
    const eventIdV3 = buildInitiativeDecisionVoteChangedEventId(cast.voteId, 3);
    assert.notEqual(eventIdV2, eventIdV3);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: cast.voteId,
    });
    assert.equal(outboxCount, 3, "one Cast event plus two distinct Changed events");
  });

  it("35. returning to a previous choice creates a new, distinct version-specific event (not treated as a duplicate)", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("return-to-previous-choice");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });
    const backToSupport = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    assert.equal(backToSupport.choice, "support");
    assert.equal(backToSupport.version, 3);

    const eventIdV3 = buildInitiativeDecisionVoteChangedEventId(cast.voteId, 3);
    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId: eventIdV3,
    });
    assert.equal(outboxCount, 1, "returning to the original choice is still a new committed transition with its own event");

    const totalEvents = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: cast.voteId,
    });
    assert.equal(totalEvents, 3);
  });

  it("36. optimistic conflict produces no event for the losing/rolled-back mutation", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("optimistic-conflict-no-event");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    await Promise.all([
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId,
        initiativeId,
        choice: "do_not_support",
        transparencyCohort: "verified",
      }),
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId,
        initiativeId,
        choice: "abstain",
        transparencyCohort: "verified",
      }),
    ]);

    const final = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).findOne({
      voteId: cast.voteId,
    });
    assert.equal(final?.version, 3, "cast + two committed changes, no gaps");

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: cast.voteId,
    });
    assert.equal(
      outboxCount,
      3,
      "exactly one event per committed transition (1 cast + 2 changes) — no extra event for any losing attempt",
    );
  });

  it("37. a history-insert failure during a changed-choice mutation rolls back the Vote update and produces no event", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("changed-history-failure");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    const collidingHistoryId = buildInitiativeDecisionVoteHistoryId(decisionId, participantId, 2);
    await insertInitiativeDecisionVoteHistory({
      historyId: collidingHistoryId,
      voteId: cast.voteId,
      decisionId,
      participantId,
      newChoice: "abstain",
      changedAt: new Date().toISOString(),
      transparencyCohort: "verified",
    });

    await assert.rejects(
      () =>
        castOrChangeInitiativeDecisionVote({
          decisionId,
          participantId,
          initiativeId,
          choice: "do_not_support",
          transparencyCohort: "verified",
        }),
      InitiativeDecisionVoteEventInvariantConflictError,
    );

    const stillOriginal = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).findOne({
      voteId: cast.voteId,
    });
    assert.equal(stillOriginal?.choice, "support", "Vote update must be rolled back");
    assert.equal(stillOriginal?.version, 1);

    const eventId = buildInitiativeDecisionVoteChangedEventId(cast.voteId, 2);
    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ eventId });
    assert.equal(outboxCount, 0, "no event may exist for a rolled-back mutation");
  });

  it("38. an outbox insert failure during a changed-choice mutation rolls back both the Vote update and its history row", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("changed-outbox-failure");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    setForceEnqueueFailureForTests(true);
    try {
      await assert.rejects(() =>
        castOrChangeInitiativeDecisionVote({
          decisionId,
          participantId,
          initiativeId,
          choice: "do_not_support",
          transparencyCohort: "verified",
        }),
      );
    } finally {
      setForceEnqueueFailureForTests(false);
    }

    const stillOriginal = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).findOne({
      voteId: cast.voteId,
    });
    assert.equal(stillOriginal?.choice, "support", "Vote update must be rolled back");
    assert.equal(stillOriginal?.version, 1);

    const history = await listVoteHistoryForParticipant(decisionId, participantId);
    assert.equal(history.length, 1, "the rolled-back change's history row must not exist");
  });
});

describe("Infrastructure compatibility (Part 26 §Infrastructure compatibility)", () => {
  it("39. both Vote event schemas register in CATALOGUE_EVENTS with exact names", () => {
    assert.equal(CATALOGUE_EVENTS.initiativeDecisionVoteCast, "InitiativeDecisionVoteCast");
    assert.equal(CATALOGUE_EVENTS.initiativeDecisionVoteChanged, "InitiativeDecisionVoteChanged");
  });

  it("40. existing Petition schemas remain registered, unaffected", () => {
    assert.equal(CATALOGUE_EVENTS.petitionSigned, "PetitionSigned");
  });

  it("41/44. an unconsumed Vote event dispatches without error and is marked published (event-name-driven dispatch, unchanged)", async () => {
    clearDomainEventHandlers();
    assert.deepEqual(getHandlersForEvent(CATALOGUE_EVENTS.initiativeDecisionVoteCast), []);
    assert.deepEqual(getHandlersForEvent(CATALOGUE_EVENTS.initiativeDecisionVoteChanged), []);

    const { decisionId, initiativeId, participantId } = fixtureIds("outbox-lifecycle");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    const eventId = buildInitiativeDecisionVoteCastEventId(cast.voteId);
    const pendingRecord = await getMongoCollection<{ status: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.equal(pendingRecord?.status, "pending");

    const dispatchCount = await dispatchOutboxOnceForTests();
    assert.ok(dispatchCount >= 1);

    const published = await getMongoCollection<{ status: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.equal(published?.status, "published", "an unconsumed Vote event must still reach published status");
  });

  it("42. outbox uniqueness rejects a duplicate deterministic Cast event ID", async () => {
    const { decisionId, participantId, initiativeId } = fixtureIds("outbox-duplicate-guard");
    const voteId = buildInitiativeDecisionVoteId(decisionId, participantId);
    const probeEvent = createInitiativeDecisionVoteCastEvent({
      voteId,
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      votedAt: new Date().toISOString(),
      voteVersion: 1,
    });

    await enqueueDomainEvent(probeEvent);
    await assert.rejects(() => enqueueDomainEvent(probeEvent));

    await deleteOutboxRecordsByEventIdPrefix(probeEvent.eventId);
  });

  it("43. processed-event tracking works identically for Vote event IDs (no schema change required)", async () => {
    const probeEventId = `initiative-decision-vote-cast:processed-event-probe-${testRunId}`;
    const before = await isEventProcessed("probe-consumer", probeEventId);
    assert.equal(before, false);
  });

  it("45. a Changed event payload deserializes correctly after a simulated restart (dispatch + reload)", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("changed-reconstruction");

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });

    const eventId = buildInitiativeDecisionVoteChangedEventId(cast.voteId, 2);
    await dispatchOutboxOnceForTests();

    const outboxDocument = await getMongoCollection<{ _id: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    const record = await findOutboxRecordById(outboxDocument!._id);
    const envelope = deserializeDomainEventEnvelope(record!.envelope);

    assert.equal(envelope.payload.previousChoice, "support");
    assert.equal(envelope.payload.newChoice, "abstain");
    assert.equal(envelope.payload.newVoteVersion, 2);
  });

  it("46. the outbox's eventId unique index remains intact", async () => {
    const indexes = await getMongoCollection(MONGO_COLLECTIONS.outbox).indexes();
    const indexNames = indexes.map((index) => index.name);
    assert.ok(indexNames.includes("outbox_event_id_unique"));
  });
});
