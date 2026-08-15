import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { toCanonicalEnvelope } from "../../../src/infrastructure/events/event-envelope.js";
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
  claimEventForProcessing,
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  dispatchOutboxOnceForTests,
  enqueueDomainEvent,
  isEventProcessed,
  releaseEventProcessingClaim,
} from "../../../src/infrastructure/outbox/index.js";
import { createInitiativeDecisionVoteCastEvent } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-cast.event.js";
import { createInitiativeDecisionVoteChangedEvent } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-changed.event.js";
import {
  PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
  handleInitiativeDecisionVoteCastForParticipantAction,
} from "../../../src/modules/participant-action/application/initiative-decision-vote-cast.participant-action-handler.js";
import { mapInitiativeDecisionVoteCastToParticipantAction } from "../../../src/modules/participant-action/application/initiative-decision-vote-cast-to-participant-action.mapper.js";
import {
  handleInitiativeDecisionVoteChangedForParticipantAction,
} from "../../../src/modules/participant-action/application/initiative-decision-vote-changed.participant-action-handler.js";
import {
  ParticipantActionConflictError,
  ParticipantActionValidationError,
} from "../../../src/modules/participant-action/participant-action.errors.js";
import {
  countParticipantActionsBySourceEventId,
  deleteParticipantActionsBySourceEventIdForTests,
  findParticipantActionBySourceEventId,
  insertParticipantActionIfAbsent,
  setForceParticipantActionInsertFailureForTests,
} from "../../../src/modules/participant-action/infrastructure/participant-action.repository.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Recovery Task 33 Part 24 "Failure and retry" (55-62) and "Scope
 * protection" (63-72), plus Part 12 insert-conflict classification and the
 * remaining Part 22 concurrency scenarios not already covered by
 * `initiative-decision-vote-participant-action-consumer.test.ts`.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, "../../..");
const apiSrcDir = path.join(apiRoot, "src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdSourceEventIds: string[] = [];
const createdOutboxEventIdPrefixes: string[] = [];

let counter = 0;

function buildCastEnvelope(overrides: Partial<{ voteId: string; choice: "support" | "do_not_support" | "abstain" }> = {}) {
  counter += 1;
  const voteId = overrides.voteId ?? `vote-failure-${testRunId}-${counter}`;
  const event = createInitiativeDecisionVoteCastEvent({
    voteId,
    decisionId: `decision-failure-${testRunId}-${counter}`,
    participantId: `participant-failure-${testRunId}-${counter}`,
    initiativeId: `initiative-failure-${testRunId}-${counter}`,
    choice: overrides.choice ?? "support",
    votedAt: "2026-07-28T12:00:00.000Z",
    voteVersion: 1,
  });
  const envelope = toCanonicalEnvelope(event);
  createdSourceEventIds.push(envelope.eventId);
  return { envelope, voteId, event };
}

function buildChangedEnvelope(voteId: string, participantId: string, newVoteVersion = 2) {
  counter += 1;
  const event = createInitiativeDecisionVoteChangedEvent({
    voteId,
    decisionId: `decision-failure-changed-${testRunId}-${counter}`,
    participantId,
    initiativeId: `initiative-failure-changed-${testRunId}-${counter}`,
    previousChoice: "support",
    newChoice: "do_not_support",
    changedAt: "2026-07-28T12:05:00.000Z",
    previousVoteVersion: newVoteVersion - 1,
    newVoteVersion,
  });
  const envelope = toCanonicalEnvelope(event);
  createdSourceEventIds.push(envelope.eventId);
  return { envelope, event };
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  setForceParticipantActionInsertFailureForTests(false);
  clearDomainEventHandlers();
  for (const sourceEventId of createdSourceEventIds) {
    await deleteParticipantActionsBySourceEventIdForTests(sourceEventId);
  }
  for (const prefix of createdOutboxEventIdPrefixes) {
    await deleteOutboxRecordsByEventIdPrefix(prefix);
    await deleteProcessedEventsByEventIdPrefix(prefix);
  }
  await disconnectMongoClient();
});

describe("55-62. Failure and retry", () => {
  it("55. Mapper failure creates no action", async () => {
    const { envelope } = buildCastEnvelope();
    const malformed = { ...envelope, eventName: "SomethingElseHappened" };

    await assert.rejects(
      () => handleInitiativeDecisionVoteCastForParticipantAction(malformed),
      ParticipantActionValidationError,
    );

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 0);
  });

  it("56. Insert failure does not create a successful processed projection (full outbox/dispatcher pipeline)", async () => {
    const { event, envelope } = buildCastEnvelope();
    const prefix = `initiative-decision-vote-cast:${event.aggregateId}`;
    createdOutboxEventIdPrefixes.push(prefix);

    await enqueueDomainEvent(event);

    clearDomainEventHandlers();
    registerDomainEventHandler({
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.initiativeDecisionVoteCast,
      handle: handleInitiativeDecisionVoteCastForParticipantAction,
    });

    setForceParticipantActionInsertFailureForTests(true);
    try {
      await dispatchOutboxOnceForTests();
    } finally {
      setForceParticipantActionInsertFailureForTests(false);
    }

    const processedAfterFailure = await isEventProcessed(
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      envelope.eventId,
    );
    assert.equal(processedAfterFailure, false, "a failed insert must never be marked completed");

    const countAfterFailure = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(countAfterFailure, 0);

    // Retry: the outbox record was left pending (not published) by the
    // dispatcher after the handler threw, so a second dispatch cycle
    // succeeds and produces exactly one Participant Action.
    await dispatchOutboxOnceForTests();
    const processedAfterRetry = await isEventProcessed(
      PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      envelope.eventId,
    );
    assert.equal(processedAfterRetry, true);
    const countAfterRetry = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(countAfterRetry, 1);
  });

  it("57. Claim failure (event already in-progress) creates no action", async () => {
    const { envelope } = buildCastEnvelope();

    // Simulate a claim already held by an in-flight worker for this exact
    // (consumerId, eventId) pair — the same signal
    // `outbox.dispatcher.ts` checks (`claim.inProgress`) before ever
    // invoking a handler.
    const claim = await claimEventForProcessing({
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      eventId: envelope.eventId,
      correlationId: envelope.metadata.correlationId,
    });
    assert.equal(claim.claimed, true);

    const reclaimAttempt = await claimEventForProcessing({
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      eventId: envelope.eventId,
      correlationId: envelope.metadata.correlationId,
    });
    assert.equal(reclaimAttempt.claimed, false);
    assert.equal(reclaimAttempt.inProgress, true);

    // No Participant Action exists because no handler was ever invoked
    // while the claim was held.
    const countWhileClaimed = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(countWhileClaimed, 0);

    // Release the claim (as the dispatcher itself would on a real handler
    // failure) — a subsequent legitimate processing attempt now succeeds.
    await releaseEventProcessingClaim({
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
      eventId: envelope.eventId,
      error: new Error("simulated release for test cleanup"),
    });

    await handleInitiativeDecisionVoteCastForParticipantAction(envelope);
    const countAfterRelease = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(countAfterRelease, 1);
  });

  it("58. Compatible duplicate is idempotent (same content re-inserted)", async () => {
    const { envelope } = buildCastEnvelope();
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    const first = await insertParticipantActionIfAbsent(record);
    const second = await insertParticipantActionIfAbsent({ ...record, recordedAt: "2026-07-28T12:00:06.000Z" });

    assert.equal(first, "created");
    assert.equal(second, "idempotent_replay");
  });

  it("59. Incompatible action duplicate is rejected (same participantActionId, different content)", async () => {
    const { envelope } = buildCastEnvelope();
    const record = mapInitiativeDecisionVoteCastToParticipantAction(envelope, "2026-07-28T12:00:05.000Z");

    await insertParticipantActionIfAbsent(record);

    const incompatible = { ...record, initiativeId: `${record.initiativeId}-mutated` };
    await assert.rejects(
      () => insertParticipantActionIfAbsent(incompatible),
      ParticipantActionConflictError,
    );

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 1, "the conflicting insert must never create a second row");
  });

  it("60. Incompatible source-event duplicate is rejected (crafted participantActionId collision without a real replay)", async () => {
    const { envelope: envelopeA } = buildCastEnvelope();
    const { envelope: envelopeB } = buildCastEnvelope();
    const recordA = mapInitiativeDecisionVoteCastToParticipantAction(envelopeA, "2026-07-28T12:00:05.000Z");
    const recordB = mapInitiativeDecisionVoteCastToParticipantAction(envelopeB, "2026-07-28T12:00:06.000Z");

    await insertParticipantActionIfAbsent(recordA);

    // Force a participantActionId collision with genuinely different source
    // content — this must never be silently treated as a replay.
    const forcedCollision = { ...recordB, participantActionId: recordA.participantActionId };
    await assert.rejects(
      () => insertParticipantActionIfAbsent(forcedCollision),
      ParticipantActionConflictError,
    );

    const countA = await countParticipantActionsBySourceEventId(envelopeA.eventId);
    const countB = await countParticipantActionsBySourceEventId(envelopeB.eventId);
    assert.equal(countA, 1);
    assert.equal(countB, 0);
  });

  it("61. Retry after transient failure can retry safely", async () => {
    const { envelope } = buildCastEnvelope();

    setForceParticipantActionInsertFailureForTests(true);
    try {
      await assert.rejects(() => handleInitiativeDecisionVoteCastForParticipantAction(envelope));
    } finally {
      setForceParticipantActionInsertFailureForTests(false);
    }

    const countAfterFailure = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(countAfterFailure, 0);

    await handleInitiativeDecisionVoteCastForParticipantAction(envelope);
    const countAfterRetry = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(countAfterRetry, 1);
  });

  it("62. Restart/reconstruction preserves idempotency (reconnecting the Mongo client does not break replay safety)", async () => {
    const { envelope } = buildCastEnvelope();

    await handleInitiativeDecisionVoteCastForParticipantAction(envelope);

    await disconnectMongoClient();
    await connectMongoClient();
    await ensureMongoIndexes();

    await handleInitiativeDecisionVoteCastForParticipantAction(envelope);
    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 1);
  });
});

describe("Remaining Part 22 concurrency scenarios", () => {
  it("3. Cast and Changed processed concurrently for the same Vote", async () => {
    const { envelope: castEnvelope, voteId } = buildCastEnvelope();
    const { envelope: changedEnvelope } = buildChangedEnvelope(
      voteId,
      castEnvelope.payload.participantId as string,
    );

    await Promise.all([
      handleInitiativeDecisionVoteCastForParticipantAction(castEnvelope),
      handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelope),
    ]);

    assert.equal(await countParticipantActionsBySourceEventId(castEnvelope.eventId), 1);
    assert.equal(await countParticipantActionsBySourceEventId(changedEnvelope.eventId), 1);
  });

  it("4. Two different Changed versions processed concurrently", async () => {
    const { voteId } = buildCastEnvelope();
    const participantId = `participant-concurrent-versions-${testRunId}`;
    const { envelope: envelopeV2 } = buildChangedEnvelope(voteId, participantId, 2);
    const { envelope: envelopeV3 } = buildChangedEnvelope(voteId, participantId, 3);

    await Promise.all([
      handleInitiativeDecisionVoteChangedForParticipantAction(envelopeV2),
      handleInitiativeDecisionVoteChangedForParticipantAction(envelopeV3),
    ]);

    assert.equal(await countParticipantActionsBySourceEventId(envelopeV2.eventId), 1);
    assert.equal(await countParticipantActionsBySourceEventId(envelopeV3.eventId), 1);
    const recordV2 = await findParticipantActionBySourceEventId(envelopeV2.eventId);
    const recordV3 = await findParticipantActionBySourceEventId(envelopeV3.eventId);
    assert.notEqual(recordV2!.participantActionId, recordV3!.participantActionId);
  });

  it("5. Vote events for two Participants processed concurrently", async () => {
    const { envelope: envelopeA } = buildCastEnvelope();
    const { envelope: envelopeB } = buildCastEnvelope();

    await Promise.all([
      handleInitiativeDecisionVoteCastForParticipantAction(envelopeA),
      handleInitiativeDecisionVoteCastForParticipantAction(envelopeB),
    ]);

    const recordA = await findParticipantActionBySourceEventId(envelopeA.eventId);
    const recordB = await findParticipantActionBySourceEventId(envelopeB.eventId);
    assert.notEqual(recordA!.participantId, recordB!.participantId);
  });

  it("6. Vote events for two Decisions processed concurrently", async () => {
    const { envelope: envelopeA } = buildCastEnvelope();
    const { envelope: envelopeB } = buildCastEnvelope();

    await Promise.all([
      handleInitiativeDecisionVoteCastForParticipantAction(envelopeA),
      handleInitiativeDecisionVoteCastForParticipantAction(envelopeB),
    ]);

    const recordA = await findParticipantActionBySourceEventId(envelopeA.eventId);
    const recordB = await findParticipantActionBySourceEventId(envelopeB.eventId);
    assert.notEqual(
      (recordA!.metadata as { decisionId: string }).decisionId,
      (recordB!.metadata as { decisionId: string }).decisionId,
    );
  });
});

describe("63-72. Scope protection", () => {
  function readSource(relativePath: string): string {
    return readFileSync(path.join(apiSrcDir, relativePath), "utf8");
  }

  /**
   * Strips `/** ... *\/` block comments (used throughout this codebase for
   * doc comments that deliberately *mention*, in prose, the things a
   * function does NOT do — e.g. "awards no Fair", "writes no legacy
   * Activity" — mirroring the existing Petition handler's own doc comments)
   * so scope-protection assertions below check actual code references, not
   * explanatory prose.
   */
  function stripBlockComments(source: string): string {
    return source.replace(/\/\*\*[\s\S]*?\*\//g, "");
  }

  it("63-64-65. Vote producer files unchanged: no reverse coupling to the Participant Action module", () => {
    for (const relativePath of [
      "modules/initiative-decision-vote/initiative-decision-vote.store.ts",
      "modules/initiative-decision-vote/initiative-decision-vote-cast.event.ts",
      "modules/initiative-decision-vote/initiative-decision-vote-changed.event.ts",
      "modules/initiative-decision-vote/persistence/initiative-decision-vote.repository.ts",
    ]) {
      const source = readSource(relativePath);
      assert.doesNotMatch(
        source,
        /from ".*\/participant-action\//,
        `Vote producer file "${relativePath}" must never import from the Participant Action module`,
      );
    }
  });

  it("66. Petition producer unchanged: no reverse coupling to the Participant Action module", () => {
    const source = readSource("modules/petition/petition-signed.event.ts");
    assert.doesNotMatch(source, /from ".*\/participant-action\//);
  });

  it("67. Participant Action architecture remains additive: every Task 27 export still exists", async () => {
    const moduleExports = await import("../../../src/modules/participant-action/index.js");

    for (const name of [
      "handlePetitionSignedForParticipantAction",
      "PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID",
      "mapPetitionSignedToParticipantAction",
      "validatePetitionSignedEnvelopeForParticipantAction",
      "buildParticipantActionId",
      "ParticipantActionPersistenceError",
      "ParticipantActionValidationError",
      "countParticipantActionsBySourceEventId",
      "insertParticipantActionIfAbsent",
      "listParticipantActionsByInitiativeId",
      "listParticipantActionsByParticipantId",
    ]) {
      assert.ok(name in moduleExports, `expected pre-existing export "${name}" to still exist`);
    }
  });

  it("68. Fair untouched: no Fair reference in the Vote mapper/handler files", () => {
    for (const relativePath of [
      "modules/participant-action/application/initiative-decision-vote-cast-to-participant-action.mapper.ts",
      "modules/participant-action/application/initiative-decision-vote-changed-to-participant-action.mapper.ts",
      "modules/participant-action/application/initiative-decision-vote-cast.participant-action-handler.ts",
      "modules/participant-action/application/initiative-decision-vote-changed.participant-action-handler.ts",
    ]) {
      const source = stripBlockComments(readSource(relativePath));
      assert.doesNotMatch(source, /\bfair\b/i);
    }
  });

  it("69. Activity untouched: no Activity reference in the Vote mapper/handler files", () => {
    for (const relativePath of [
      "modules/participant-action/application/initiative-decision-vote-cast-to-participant-action.mapper.ts",
      "modules/participant-action/application/initiative-decision-vote-changed-to-participant-action.mapper.ts",
      "modules/participant-action/application/initiative-decision-vote-cast.participant-action-handler.ts",
      "modules/participant-action/application/initiative-decision-vote-changed.participant-action-handler.ts",
    ]) {
      const source = stripBlockComments(readSource(relativePath));
      assert.doesNotMatch(source, /activities|Activity/);
    }
  });

  it("70. Journey unimplemented: no Journey module exists", async () => {
    await assert.rejects(
      () => import("../../../src/modules/journey/index.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/,
    );
  });

  it("71. Member eligibility unchanged: Vote mapper/handler never call membership/eligibility functions", () => {
    for (const relativePath of [
      "modules/participant-action/application/initiative-decision-vote-cast-to-participant-action.mapper.ts",
      "modules/participant-action/application/initiative-decision-vote-changed-to-participant-action.mapper.ts",
      "modules/participant-action/application/initiative-decision-vote-cast.participant-action-handler.ts",
      "modules/participant-action/application/initiative-decision-vote-changed.participant-action-handler.ts",
    ]) {
      const source = readSource(relativePath);
      assert.doesNotMatch(
        source,
        /evaluateDecisionParticipationEligibility|getMembership|getMemberById\(/,
      );
    }
  });

  it("72. No new public API: no HTTP route file exists under the participant-action module", async () => {
    await assert.rejects(
      () => import("../../../src/modules/participant-action/api/participant-action.routes.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/,
    );
    const moduleExports = await import("../../../src/modules/participant-action/index.js");
    assert.equal("router" in moduleExports, false);
  });
});
