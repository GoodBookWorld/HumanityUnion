/**
 * Recovery Task 32 Part 25 — bounded Initiative Decision Vote durable event
 * producer verification.
 *
 * Like `verify-initiative-decision-vote-mongo-persistence.ts` (Recovery
 * Task 31), this script exercises the store layer directly with plain
 * string fixture IDs rather than full Participant/Member/Initiative/
 * Collective-Decision documents: Initiative ancestry and voting
 * eligibility validation are the application-service layer's
 * responsibility, already covered end-to-end by
 * `verify-vote-casting-e2e.ts`. This script's sole job is to prove the
 * durable `InitiativeDecisionVoteCast`/`InitiativeDecisionVoteChanged`
 * event producer added by Task 32, atomically layered on top of Task 31's
 * persistence guarantees.
 *
 * Proves, end-to-end against a real MongoDB instance, that:
 *   1-3.   baseline Vote/history/outbox/Participant-Action counts are
 *          captured before any mutation;
 *   4-9.   a first cast inserts exactly one Vote, one cast history row, and
 *          exactly one `InitiativeDecisionVoteCast` outbox event, whose
 *          envelope/payload are valid and whose eventId is the exact
 *          deterministic formula;
 *   10-13. a sequential retry of the identical first cast, and a further
 *          same-choice re-submit, are both true no-ops: no second Cast
 *          event and no Changed event is ever produced;
 *   14-19. a real choice change mutates the same Vote (same voteId, version
 *          increments, one new history row) and enqueues exactly one
 *          `InitiativeDecisionVoteChanged` event with the exact
 *          deterministic eventId and a valid previous/new choice+version
 *          transition;
 *   20-21. retrying the identical changed command produces no duplicate
 *          Changed event;
 *   22-23. a second real change produces a distinct Changed event for the
 *          next committed version;
 *   24-25. forcing an outbox-insert failure on a separate fixture rolls
 *          back the entire transaction — no partial Vote, no partial
 *          history, no partial outbox;
 *   26.    no Vote event consumer is registered for either event name;
 *   27.    Participant Action remains completely untouched by every Vote
 *          mutation above;
 *   28.    the Petition durable event catalogue entry remains intact and
 *          unaffected by Vote event registration;
 *   29.    the Cast event survives a freshly-started OS process (real
 *          durability, not just in-process memory);
 *   30.    only owned fixtures are cleaned up.
 *
 * No Vote event consumer/handler is implemented or registered — Task 32
 * explicitly stops at the outbox.
 *
 * Run: tsx src/scripts/verify-initiative-decision-vote-events.ts
 * (safe to run repeatedly: every fixture ID is unique per run and every
 * owned fixture is deleted in a `finally` block)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runVerificationScript } from "./verification-script-lifecycle.js";
import {
  assertVerificationSubprocessSucceeded,
  runVerificationSubprocess,
} from "./run-verification-subprocess.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

/**
 * Pre-existing, verified-unrelated race in `finalizeVerificationResources()`
 * (shared by every `runVerificationScript` caller, not introduced by
 * Task 32 — see the identical guard and rationale in
 * `verify-initiative-decision-vote-mongo-persistence.ts`, Recovery
 * Task 31): merely importing the notification/email modules it drains
 * kicks off a fire-and-forget Member lookup that is not awaited by
 * anything this script controls, and can still be in flight when
 * `disconnectMongoClient()` closes the shared Mongo client after this
 * script's own assertions have already passed.
 */
let verificationOutcomeDecided = false;
process.on("unhandledRejection", (error) => {
  const isKnownPostCompletionMongoCloseRace =
    verificationOutcomeDecided &&
    error instanceof Error &&
    (error.name === "MongoServerClosedError" || error.name === "MongoExpiredSessionError");

  if (isKnownPostCompletionMongoCloseRace) {
    console.warn(
      "Ignoring known pre-existing post-completion Mongo-close race in finalizeVerificationResources() " +
        `(unrelated to Vote event production): ${error.name}: ${error.message}`,
    );
    return;
  }

  throw error;
});

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const decisionId = `decision-vote-events-verify-${runId}`;
  const participantId = `participant-vote-events-verify-${runId}`;
  const initiativeId = `initiative-vote-events-verify-${runId}`;
  const rollbackDecisionId = `decision-rollback-vote-events-verify-${runId}`;
  const rollbackParticipantId = `participant-rollback-vote-events-verify-${runId}`;

  const { connectMongoClient } = await import("../infrastructure/mongodb/mongo-connection.js");
  const { ensureMongoIndexes } = await import("../infrastructure/mongodb/mongo-indexes.js");
  const { MONGO_COLLECTIONS } = await import("../infrastructure/mongodb/mongo-collections.js");
  const { getMongoCollection } = await import("../infrastructure/mongodb/mongo-database.js");
  const { CATALOGUE_EVENTS } = await import("../infrastructure/events/catalogue-events.js");
  const { deserializeDomainEventEnvelope } = await import("../infrastructure/events/event-serialization.js");
  const { getHandlersForEvent } = await import("../infrastructure/integration/event-handler-registry.js");
  const {
    setForceEnqueueFailureForTests,
    deleteOutboxRecordsByEventIdPrefix,
  } = await import("../infrastructure/outbox/index.js");
  const {
    castOrChangeInitiativeDecisionVote,
    getVoteById,
    listVoteHistoryForDecision,
    deleteVotesByDecisionIdForTests,
  } = await import("../modules/initiative-decision-vote/initiative-decision-vote.store.js");
  const { buildInitiativeDecisionVoteId } = await import(
    "../modules/initiative-decision-vote/persistence/initiative-decision-vote.mongo-document.js"
  );
  const { buildInitiativeDecisionVoteCastEventId } = await import(
    "../modules/initiative-decision-vote/initiative-decision-vote-cast.event.js"
  );
  const { buildInitiativeDecisionVoteChangedEventId } = await import(
    "../modules/initiative-decision-vote/initiative-decision-vote-changed.event.js"
  );

  const voteId = buildInitiativeDecisionVoteId(decisionId, participantId);
  const rollbackVoteId = buildInitiativeDecisionVoteId(rollbackDecisionId, rollbackParticipantId);
  const ownedDecisionIds = [decisionId, rollbackDecisionId];

  await connectMongoClient();
  await ensureMongoIndexes();

  try {
    console.log("1-2. Participant/Initiative/Decision fixtures");
    console.log(
      "    (this script exercises the store layer directly; ancestry and eligibility",
    );
    console.log("    validation are already covered by verify-vote-casting-e2e.ts)");

    console.log("3. Record baseline Vote, history, outbox, and Participant Action counts");
    const baselineVotes = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).countDocuments({
      decisionId,
    });
    const baselineHistory = await getMongoCollection(
      MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
    ).countDocuments({ decisionId });
    const baselineOutbox = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: voteId,
    });
    const baselineParticipantActions = await getMongoCollection(
      MONGO_COLLECTIONS.participantActions,
    ).countDocuments({ participantId });
    assert(baselineVotes === 0, "baseline Vote count must be zero for a fresh fixture");
    assert(baselineHistory === 0, "baseline history count must be zero for a fresh fixture");
    assert(baselineOutbox === 0, "baseline outbox count must be zero for a fresh fixture");
    assert(baselineParticipantActions === 0, "baseline Participant Action count must be zero for a fresh fixture");

    console.log("4. Cast first Vote");
    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    assert(cast.voteId === voteId, "the committed Vote must use the deterministic voteId");
    assert(cast.version === 1, "first cast must have version 1");

    console.log("5. Verify exactly one Vote");
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).countDocuments({ decisionId })) === 1,
      "exactly one Vote row must exist after first cast",
    );

    console.log("6. Verify exactly one cast history row");
    const historyAfterCast = await listVoteHistoryForDecision(decisionId);
    assert(historyAfterCast.length === 1, "exactly one history row must exist after first cast");
    assert(historyAfterCast[0]?.newChoice === "support", "history row must record the cast choice");

    console.log("7. Verify exactly one InitiativeDecisionVoteCast outbox event");
    const castEventId = buildInitiativeDecisionVoteCastEventId(voteId);
    const castOutboxDocument = await getMongoCollection<{
      _id: string;
      eventId: string;
      eventName: string;
      aggregateType: string;
      aggregateId: string;
      envelope: string;
    }>(MONGO_COLLECTIONS.outbox).findOne({ eventId: castEventId });
    assert(castOutboxDocument !== null, "expected exactly one InitiativeDecisionVoteCast outbox document");
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ aggregateId: voteId })) === 1,
      "exactly one outbox event must exist for this Vote after first cast",
    );

    console.log("8. Validate Cast payload and envelope");
    assert(
      castOutboxDocument!.eventName === CATALOGUE_EVENTS.initiativeDecisionVoteCast,
      "eventName must be InitiativeDecisionVoteCast",
    );
    assert(castOutboxDocument!.aggregateType === "InitiativeDecisionVote", "aggregateType must be InitiativeDecisionVote");
    assert(castOutboxDocument!.aggregateId === voteId, "aggregateId must equal the committed voteId");
    const castEnvelope = deserializeDomainEventEnvelope(castOutboxDocument!.envelope);
    assert(castEnvelope.payload.voteId === voteId, "Cast payload voteId must equal the committed voteId");
    assert(castEnvelope.payload.decisionId === decisionId, "Cast payload decisionId must match");
    assert(castEnvelope.payload.participantId === participantId, "Cast payload participantId must match");
    assert(castEnvelope.payload.initiativeId === initiativeId, "Cast payload initiativeId must match");
    assert(castEnvelope.payload.choice === "support", "Cast payload choice must match the committed choice");
    assert(castEnvelope.payload.voteVersion === 1, "Cast payload voteVersion must be 1");
    assert(castEnvelope.payload.votedAt === cast.castAt, "Cast payload votedAt must equal the committed Vote timestamp");
    assert(castEnvelope.metadata.occurredAt === cast.castAt, "Cast envelope occurredAt must equal votedAt");
    assert("memberId" in castEnvelope.payload === false, "Cast payload must never carry memberId");

    console.log("9. Verify Cast event ID determinism");
    assert(castOutboxDocument!.eventId === `initiative-decision-vote-cast:${voteId}`, "Cast eventId must match the documented formula");

    console.log("10. Retry same cast (sequential)");
    const retriedCast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    assert(retriedCast.voteId === voteId, "a retried cast must resolve to the same Vote");
    assert(retriedCast.version === 1, "a retried cast must not bump version");

    console.log("11. Verify no second Cast event");
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ eventId: castEventId })) === 1,
      "still exactly one Cast outbox document after a sequential retry",
    );

    console.log("12. Re-submit same choice again");
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    console.log("13. Verify no Changed event and unchanged history/outbox counts");
    assert(
      (await listVoteHistoryForDecision(decisionId)).length === 1,
      "same-choice re-submit must not add a history row",
    );
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ aggregateId: voteId })) === 1,
      "same-choice re-submit must not enqueue any event",
    );

    console.log("14. Change choice");
    const changed = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });

    console.log("15. Verify same Vote ID");
    assert(changed.voteId === voteId, "changed choice must reuse the same voteId");

    console.log("16. Verify version increment");
    assert(changed.version === 2, "version must increment exactly once");

    console.log("17. Verify exactly one Changed history row");
    const historyAfterChange = await listVoteHistoryForDecision(decisionId);
    assert(historyAfterChange.length === 2, "exactly one new history row must be added");
    assert(historyAfterChange[1]?.previousChoice === "support", "history must record the previous choice");
    assert(historyAfterChange[1]?.newChoice === "do_not_support", "history must record the new choice");

    console.log("18. Verify exactly one InitiativeDecisionVoteChanged event");
    const changedEventIdV2 = buildInitiativeDecisionVoteChangedEventId(voteId, 2);
    const changedOutboxDocumentV2 = await getMongoCollection<{
      eventId: string;
      eventName: string;
      aggregateId: string;
      envelope: string;
    }>(MONGO_COLLECTIONS.outbox).findOne({ eventId: changedEventIdV2 });
    assert(changedOutboxDocumentV2 !== null, "expected exactly one InitiativeDecisionVoteChanged outbox document for v2");
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ aggregateId: voteId })) === 2,
      "exactly two outbox events (1 cast + 1 changed) must exist for this Vote so far",
    );

    console.log("19. Validate Changed payload and version transition");
    assert(
      changedOutboxDocumentV2!.eventName === CATALOGUE_EVENTS.initiativeDecisionVoteChanged,
      "eventName must be InitiativeDecisionVoteChanged",
    );
    assert(
      changedOutboxDocumentV2!.eventId === `initiative-decision-vote-changed:${voteId}:v2`,
      "Changed eventId must match the documented formula",
    );
    const changedEnvelopeV2 = deserializeDomainEventEnvelope(changedOutboxDocumentV2!.envelope);
    assert(changedEnvelopeV2.payload.previousChoice === "support", "Changed payload previousChoice must match");
    assert(changedEnvelopeV2.payload.newChoice === "do_not_support", "Changed payload newChoice must match");
    assert(changedEnvelopeV2.payload.previousVoteVersion === 1, "Changed payload previousVoteVersion must be 1");
    assert(changedEnvelopeV2.payload.newVoteVersion === 2, "Changed payload newVoteVersion must be 2");
    assert(
      changedEnvelopeV2.payload.changedAt === changed.updatedAt,
      "Changed payload changedAt must equal the committed Vote update timestamp",
    );
    assert("memberId" in changedEnvelopeV2.payload === false, "Changed payload must never carry memberId");

    console.log("20. Retry the changed command (re-submit the same target choice)");
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });

    console.log("21. Verify no duplicate Changed event");
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ eventId: changedEventIdV2 })) === 1,
      "still exactly one v2 Changed outbox document after retrying the same target choice",
    );
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ aggregateId: voteId })) === 2,
      "still exactly two total outbox events after the retried changed command",
    );

    console.log("22. Perform a second real change");
    const secondChange = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });
    assert(secondChange.version === 3, "the second real change must reach version 3");

    console.log("23. Verify a distinct Changed event for the next version");
    const changedEventIdV3 = buildInitiativeDecisionVoteChangedEventId(voteId, 3);
    const changedOutboxDocumentV3 = await getMongoCollection<{
      eventId: string;
      envelope: string;
    }>(MONGO_COLLECTIONS.outbox).findOne({ eventId: changedEventIdV3 });
    assert(changedOutboxDocumentV3 !== null, "expected a distinct InitiativeDecisionVoteChanged outbox document for v3");
    assert(changedEventIdV3 !== changedEventIdV2, "v2 and v3 Changed event IDs must be distinct");
    const changedEnvelopeV3 = deserializeDomainEventEnvelope(changedOutboxDocumentV3!.envelope);
    assert(changedEnvelopeV3.payload.previousChoice === "do_not_support", "v3 Changed payload previousChoice must match");
    assert(changedEnvelopeV3.payload.newChoice === "abstain", "v3 Changed payload newChoice must match");
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ aggregateId: voteId })) === 3,
      "exactly three total outbox events (1 cast + 2 changed) must exist for this Vote",
    );

    console.log("24-25. Force an outbox-insert failure on a separate fixture — confirm full rollback");
    setForceEnqueueFailureForTests(true);
    let rollbackAttemptFailed = false;
    try {
      await castOrChangeInitiativeDecisionVote({
        decisionId: rollbackDecisionId,
        participantId: rollbackParticipantId,
        initiativeId,
        choice: "support",
        transparencyCohort: "verified",
      });
    } catch {
      rollbackAttemptFailed = true;
    } finally {
      setForceEnqueueFailureForTests(false);
    }
    assert(rollbackAttemptFailed, "the forced outbox failure must propagate to the caller");
    assert(
      (await getVoteById(rollbackVoteId)) === null,
      "no partial Vote may exist after a forced outbox-insert failure",
    );
    assert(
      (await listVoteHistoryForDecision(rollbackDecisionId)).length === 0,
      "no partial history row may exist after a forced outbox-insert failure",
    );
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ aggregateId: rollbackVoteId })) === 0,
      "no partial outbox event may exist after a forced outbox-insert failure",
    );

    console.log("26. Confirm no Vote event consumer/handler is registered");
    assert(
      getHandlersForEvent(CATALOGUE_EVENTS.initiativeDecisionVoteCast).length === 0,
      "no InitiativeDecisionVoteCast consumer may be registered in this task",
    );
    assert(
      getHandlersForEvent(CATALOGUE_EVENTS.initiativeDecisionVoteChanged).length === 0,
      "no InitiativeDecisionVoteChanged consumer may be registered in this task",
    );

    console.log("27. Confirm Participant Action count remains unchanged");
    const finalParticipantActions = await getMongoCollection(MONGO_COLLECTIONS.participantActions).countDocuments({
      participantId,
    });
    assert(finalParticipantActions === 0, "no Participant Action may be produced by any Vote mutation");

    console.log("28. Confirm Petition durable event registration remains intact");
    assert(
      typeof CATALOGUE_EVENTS.petitionSigned === "string" && CATALOGUE_EVENTS.petitionSigned === "PetitionSigned",
      "the PetitionSigned catalogue entry must remain exactly as registered by Recovery Task 25",
    );

    console.log("29. Reconstruct: read the Cast outbox record from a freshly-started OS process");
    const reloadScriptPath = path.resolve(
      path.dirname(SCRIPT_PATH),
      "verify-initiative-decision-vote-events-reload.ts",
    );
    const reloadResult = runVerificationSubprocess(reloadScriptPath, [
      castOutboxDocument!._id,
      CATALOGUE_EVENTS.initiativeDecisionVoteCast,
      voteId,
    ]);
    assertVerificationSubprocessSucceeded(
      reloadResult,
      "verify-initiative-decision-vote-events-reload.ts",
    );

    console.log("30. Clean only owned fixtures");
    for (const ownedDecisionId of ownedDecisionIds) {
      await deleteVotesByDecisionIdForTests(ownedDecisionId);
    }
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-cast:${voteId}`);
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-changed:${voteId}:`);
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-cast:${rollbackVoteId}`);
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-changed:${rollbackVoteId}:`);

    console.log("Initiative Decision Vote durable event verification passed.");
    // Flip the flag here, inside `main()`, *before* `runVerificationScript`'s
    // `finally` block calls `finalizeVerificationResources()` (which is what
    // actually closes the shared Mongo client) — not after `main()` returns.
    // The fire-and-forget notification-module race this guards against can
    // reject essentially synchronously with the client close, so flipping
    // the flag only after the whole `runVerificationScript(main)` call
    // resolves (i.e. after cleanup has already run) is too late and lets the
    // known race escape as an uncaught exception despite every assertion
    // above already having passed.
    verificationOutcomeDecided = true;
  } catch (error) {
    setForceEnqueueFailureForTests(false);
    // Best-effort cleanup even on failure, so a failed run never leaks
    // fixtures into subsequent runs.
    for (const ownedDecisionId of ownedDecisionIds) {
      await deleteVotesByDecisionIdForTests(ownedDecisionId).catch(() => undefined);
    }
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-cast:${voteId}`).catch(() => undefined);
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-changed:${voteId}:`).catch(() => undefined);
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-cast:${rollbackVoteId}`).catch(
      () => undefined,
    );
    await deleteOutboxRecordsByEventIdPrefix(`initiative-decision-vote-changed:${rollbackVoteId}:`).catch(
      () => undefined,
    );
    throw error;
  }
}

await runVerificationScript(main);
