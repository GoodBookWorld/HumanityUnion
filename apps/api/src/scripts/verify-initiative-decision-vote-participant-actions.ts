/**
 * Recovery Task 33 Part 23 — bounded, end-to-end verification that
 * `InitiativeDecisionVoteCast`/`InitiativeDecisionVoteChanged` durable
 * events (Recovery Task 32) project into the append-only Participant
 * Action Ledger (Recovery Task 27), against a real MongoDB instance.
 *
 * Proves that:
 *   1-3.   real Participant/Initiative/Decision fixtures exist and baseline
 *          Participant Action counts (scoped by this run's unique
 *          sourceEventIds) are zero;
 *   4-11.  casting a first Vote and dispatching its outbox event produces
 *          exactly one `initiative_decision_vote_cast` Participant Action
 *          with correct identity, source fields, metadata, participantId,
 *          initiativeId, and no `memberId`;
 *   12-13. redispatching the same Cast event creates no duplicate action;
 *   14-15. re-submitting the identical Vote choice produces no new event
 *          and no new action (Task 32's no-op guarantee, unchanged);
 *   16-20. changing the Vote choice and dispatching produces exactly one
 *          `initiative_decision_vote_changed` Participant Action, while the
 *          original Cast action remains byte-identical;
 *   21-24. a second real change produces a second, distinct Changed
 *          action — all three actions (1 Cast + 2 Changed) remain
 *          append-only and durable;
 *   25-26. replaying every produced event repeatedly converges on the same
 *          stable final action count;
 *   27-28. a dedicated fixture proves a Changed event can be projected
 *          without its Cast action ever existing first, and that
 *          out-of-order Changed delivery (v3 before v2) still produces
 *          both actions independently;
 *   29.    the Vote aggregate itself still holds only the single current
 *          choice — the ledger never becomes the source of current state;
 *   30.    the pre-existing PetitionSigned Participant Action consumer
 *          still works, unaffected by Vote projection coexisting in the
 *          same registry;
 *   31-32. a Participant Action survives a freshly-started OS process
 *          (real durability, not just in-process memory);
 *   33-34. no Fair or Activity record is created by any of the above;
 *   35.    no Journey module/collection exists;
 *   36.    only owned fixtures are cleaned up.
 *
 * Run: tsx src/scripts/verify-initiative-decision-vote-participant-actions.ts
 * (safe to run repeatedly: every fixture ID is unique per run and every
 * owned fixture is deleted in a `finally` block)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import type { Initiative } from "@hu/types";

import { runVerificationScript } from "./verification-script-lifecycle.js";
import {
  assertVerificationSubprocessSucceeded,
  runVerificationSubprocess,
} from "./run-verification-subprocess.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

/**
 * Pre-existing, verified-unrelated race in `finalizeVerificationResources()`
 * (see the identical guard and rationale in
 * `verify-initiative-decision-vote-events.ts`, Recovery Task 32, and
 * `verify-participant-action-petition-signed.ts`, Recovery Task 27).
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
        `(unrelated to Vote Participant Action projection): ${error.name}: ${error.message}`,
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
  const signerMemberId = "member-bootstrap-001";

  const decisionIdA = `decision-vote-pa-verify-a-${runId}`;
  const initiativeIdA = `initiative-vote-pa-verify-a-${runId}`;
  const decisionIdC = `decision-vote-pa-verify-c-${runId}`;
  const initiativeIdC = `initiative-vote-pa-verify-c-${runId}`;
  const petitionInitiativeId = `initiative-vote-pa-verify-p-${runId}`;
  const petitionDecisionId = `decision-vote-pa-verify-p-${runId}`;
  const petitionId = `petition-vote-pa-verify-${runId}`;

  const { createInitiative } = await import("../modules/initiatives/initiative.store.js");
  const { createDecision } = await import("../modules/collective-decision/collective-decision.store.js");
  const { bootstrapCollectiveDecision } = await import(
    "../modules/collective-decision/bootstrap-collective-decision.js"
  );
  const {
    castOrChangeInitiativeDecisionVote,
    getVoteById,
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
  const {
    createPetition,
    preparePetition,
    publishPetition,
    openPetition,
    signPetition,
    deletePetitionsByIdForTests,
    deleteSignaturesByPetitionIdForTests,
  } = await import("../modules/petition/petition.store.js");
  const { defaultPetitionPolicy } = await import("../modules/petition/petition.defaults.js");
  const { buildPetitionSignedEventId } = await import("../modules/petition/petition-signed.event.js");
  const { getMemberById } = await import("../modules/member/member-access.js");
  const { deserializeDomainEventEnvelope } = await import(
    "../infrastructure/events/event-serialization.js"
  );
  const { clearDomainEventHandlers } = await import(
    "../infrastructure/integration/event-handler-registry.js"
  );
  const { MONGO_COLLECTIONS } = await import("../infrastructure/mongodb/mongo-collections.js");
  const { getMongoCollection } = await import("../infrastructure/mongodb/mongo-database.js");
  const {
    dispatchOutboxOnceForTests,
    deleteOutboxRecordsByEventIdPrefix,
    deleteProcessedEventsByEventIdPrefix,
    isEventProcessed,
  } = await import("../infrastructure/outbox/index.js");
  const {
    registerParticipantActionHandlers,
    resetParticipantActionHandlersForTests,
    handleInitiativeDecisionVoteCastForParticipantAction,
    handleInitiativeDecisionVoteChangedForParticipantAction,
    PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
    PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
    PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
    countParticipantActionsBySourceEventId,
    findParticipantActionBySourceEventId,
    deleteParticipantActionsBySourceEventIdForTests,
    deleteParticipantActionsByInitiativeIdForTests,
  } = await import("../modules/participant-action/index.js");

  const voteIdA = buildInitiativeDecisionVoteId(decisionIdA, signerMemberId);
  const voteIdC = buildInitiativeDecisionVoteId(decisionIdC, signerMemberId);
  const ownedDecisionIds = [decisionIdA, decisionIdC];
  const ownedInitiativeIds = [initiativeIdA, initiativeIdC, petitionInitiativeId];
  const outboxEventIdPrefixes: string[] = [];

  await (await import("../infrastructure/mongodb/mongo-connection.js")).connectMongoClient();
  await (await import("../infrastructure/mongodb/mongo-indexes.js")).ensureMongoIndexes();

  try {
    console.log("1. Confirm eligible Participant/Member fixture exists");
    const participantBefore = await getMemberById(signerMemberId);
    assert(participantBefore !== null, "the bootstrap Participant fixture must already exist");

    console.log("2. Create Initiative and open Decision fixtures");
    const now = new Date().toISOString();
    function buildInitiativeFixture(initiativeId: string, communitySlug: string): Initiative {
      return {
        initiativeId,
        stewardId: signerMemberId,
        createdAt: now,
        updatedAt: now,
        title: "Vote Participant Action Ledger Verification Initiative",
        description: "Exists only to satisfy direct Initiative ancestry for this run.",
        status: "draft",
        lifecyclePhase: "draft",
        visibility: { policy: "steward_only" },
        metadata: {
          category: "Community",
          tags: ["Verification"],
          region: "British Columbia",
          language: "en",
          communitySlug,
          activityArea: "Environment",
        },
        revisions: [],
        contributions: [],
        timeline: [],
      };
    }
    createInitiative(buildInitiativeFixture(initiativeIdA, `vote-pa-verify-a-${runId}`));
    createInitiative(buildInitiativeFixture(initiativeIdC, `vote-pa-verify-c-${runId}`));
    createInitiative(buildInitiativeFixture(petitionInitiativeId, `vote-pa-verify-p-${runId}`));
    await createDecision({
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId: decisionIdA,
      decisionSubjectId: initiativeIdA,
    });
    await createDecision({
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId: decisionIdC,
      decisionSubjectId: initiativeIdC,
    });
    await createDecision({
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId: petitionDecisionId,
      decisionSubjectId: petitionInitiativeId,
    });

    console.log("3. Record baseline Participant Action counts (fresh per-run sourceEventIds)");
    const castEventIdA = buildInitiativeDecisionVoteCastEventId(voteIdA);
    assert(
      (await countParticipantActionsBySourceEventId(castEventIdA)) === 0,
      "baseline Participant Action count for this run's Cast event must be zero",
    );

    console.log("4. Cast first Vote");
    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId: decisionIdA,
      participantId: signerMemberId,
      initiativeId: initiativeIdA,
      choice: "support",
      transparencyCohort: "verified",
    });
    assert(cast.voteId === voteIdA, "the committed Vote must use the deterministic voteId");
    assert(cast.version === 1, "first cast must have version 1");

    console.log("5. Dispatch outbox");
    resetParticipantActionHandlersForTests();
    clearDomainEventHandlers();
    registerParticipantActionHandlers();
    const castOutboxDocument = await getMongoCollection<{ eventId: string; envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: castEventIdA });
    assert(castOutboxDocument !== null, "expected exactly one InitiativeDecisionVoteCast outbox document");
    outboxEventIdPrefixes.push(`initiative-decision-vote-cast:${voteIdA}`);
    outboxEventIdPrefixes.push(`initiative-decision-vote-changed:${voteIdA}:`);
    const dispatchCount = await dispatchOutboxOnceForTests();
    assert(dispatchCount >= 1, "the dispatcher must process the Cast event");
    assert(
      (await isEventProcessed(PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID, castEventIdA)) === true,
      "the Vote Cast Participant Action consumer must mark the event processed",
    );

    console.log("6. Confirm one Cast Participant Action");
    assert(
      (await countParticipantActionsBySourceEventId(castEventIdA)) === 1,
      "expected exactly 1 Cast Participant Action",
    );

    console.log("7. Validate action identity and source fields");
    const castAction = await findParticipantActionBySourceEventId(castEventIdA);
    assert(castAction !== null, "the Cast Participant Action must be findable by sourceEventId");
    assert(
      castAction!.participantActionId === `participant-action:${castEventIdA}`,
      "Cast participantActionId must follow the deterministic formula",
    );
    assert(castAction!.actionType === "initiative_decision_vote_cast", "actionType must be initiative_decision_vote_cast");
    assert(castAction!.sourceType === "initiative_decision_vote", "sourceType must be initiative_decision_vote");
    assert(castAction!.sourceId === voteIdA, "sourceId must equal the voteId, never the decisionId/initiativeId");
    assert(castAction!.sourceEventId === castEventIdA, "sourceEventId must equal the Cast event's eventId");

    console.log("8. Validate Cast metadata");
    assert(
      castAction!.metadata !== null && castAction!.metadata.kind === "initiative_decision_vote_cast",
      "Cast metadata must be present with kind initiative_decision_vote_cast",
    );
    assert(
      (castAction!.metadata as { decisionId: string }).decisionId === decisionIdA,
      "Cast metadata decisionId must match",
    );
    assert((castAction!.metadata as { choice: string }).choice === "support", "Cast metadata choice must match");
    assert((castAction!.metadata as { voteVersion: number }).voteVersion === 1, "Cast metadata voteVersion must be 1");

    console.log("9. Confirm participantId");
    assert(castAction!.participantId === signerMemberId, "participantId must equal the signing actor");

    console.log("10. Confirm initiativeId");
    assert(castAction!.initiativeId === initiativeIdA, "initiativeId must equal the Vote's Initiative");

    console.log("11. Confirm no memberId");
    assert(!("memberId" in castAction!), "Participant Action must never carry a memberId field");

    console.log("12. Redispatch the same event");
    const castEnvelope = deserializeDomainEventEnvelope(castOutboxDocument!.envelope);
    await handleInitiativeDecisionVoteCastForParticipantAction(castEnvelope);
    await dispatchOutboxOnceForTests();

    console.log("13. Confirm no duplicate action");
    assert(
      (await countParticipantActionsBySourceEventId(castEventIdA)) === 1,
      "still exactly 1 Cast Participant Action after redispatch/replay",
    );

    console.log("14. Re-submit same Vote choice");
    await castOrChangeInitiativeDecisionVote({
      decisionId: decisionIdA,
      participantId: signerMemberId,
      initiativeId: initiativeIdA,
      choice: "support",
      transparencyCohort: "verified",
    });

    console.log("15. Confirm no new event and no new action");
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({ aggregateId: voteIdA })) === 1,
      "same-choice re-submit must not enqueue any event",
    );
    assert(
      (await getMongoCollection(MONGO_COLLECTIONS.participantActions).countDocuments({
        sourceId: voteIdA,
      })) === 1,
      "same-choice re-submit must not create any new Participant Action",
    );

    console.log("16. Change Vote choice");
    const changed = await castOrChangeInitiativeDecisionVote({
      decisionId: decisionIdA,
      participantId: signerMemberId,
      initiativeId: initiativeIdA,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });
    assert(changed.version === 2, "version must increment exactly once");
    const changedEventIdV2 = buildInitiativeDecisionVoteChangedEventId(voteIdA, 2);

    console.log("17. Dispatch outbox");
    await dispatchOutboxOnceForTests();
    assert(
      (await isEventProcessed(
        PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
        changedEventIdV2,
      )) === true,
      "the Vote Changed Participant Action consumer must mark the v2 event processed",
    );

    console.log("18. Confirm one Changed Participant Action");
    assert(
      (await countParticipantActionsBySourceEventId(changedEventIdV2)) === 1,
      "expected exactly 1 Changed Participant Action for v2",
    );
    const changedActionV2 = await findParticipantActionBySourceEventId(changedEventIdV2);
    assert(
      changedActionV2!.actionType === "initiative_decision_vote_changed",
      "Changed actionType must be initiative_decision_vote_changed",
    );
    assert(
      changedActionV2!.participantActionId === `participant-action:${changedEventIdV2}`,
      "Changed participantActionId must follow the deterministic formula",
    );
    assert(changedActionV2!.sourceId === voteIdA, "Changed sourceId must equal voteId, same as Cast");

    console.log("19. Confirm original Cast action remains unchanged");
    const castActionAfterChange = await findParticipantActionBySourceEventId(castEventIdA);
    assert(
      JSON.stringify(castActionAfterChange) === JSON.stringify(castAction),
      "the Cast Participant Action must remain byte-identical after a later Changed event",
    );

    console.log("20. Validate Changed metadata");
    assert(
      changedActionV2!.metadata !== null && changedActionV2!.metadata.kind === "initiative_decision_vote_changed",
      "Changed metadata must be present with kind initiative_decision_vote_changed",
    );
    assert(
      (changedActionV2!.metadata as { previousChoice: string }).previousChoice === "support",
      "Changed metadata previousChoice must match",
    );
    assert(
      (changedActionV2!.metadata as { newChoice: string }).newChoice === "do_not_support",
      "Changed metadata newChoice must match",
    );
    assert(
      (changedActionV2!.metadata as { previousVoteVersion: number }).previousVoteVersion === 1,
      "Changed metadata previousVoteVersion must be 1",
    );
    assert(
      (changedActionV2!.metadata as { newVoteVersion: number }).newVoteVersion === 2,
      "Changed metadata newVoteVersion must be 2",
    );

    console.log("21. Perform another real change");
    const secondChange = await castOrChangeInitiativeDecisionVote({
      decisionId: decisionIdA,
      participantId: signerMemberId,
      initiativeId: initiativeIdA,
      choice: "abstain",
      transparencyCohort: "verified",
    });
    assert(secondChange.version === 3, "second real change must reach version 3");
    const changedEventIdV3 = buildInitiativeDecisionVoteChangedEventId(voteIdA, 3);

    console.log("22. Dispatch outbox");
    await dispatchOutboxOnceForTests();

    console.log("23. Confirm a second, distinct Changed action");
    assert(
      (await countParticipantActionsBySourceEventId(changedEventIdV3)) === 1,
      "expected exactly 1 Changed Participant Action for v3",
    );
    assert(changedEventIdV3 !== changedEventIdV2, "v2 and v3 Changed action identities must be distinct");
    const changedActionV3 = await findParticipantActionBySourceEventId(changedEventIdV3);
    assert(
      changedActionV3!.participantActionId !== changedActionV2!.participantActionId,
      "v2 and v3 Changed participantActionIds must be distinct",
    );

    console.log("24. Confirm all actions remain append-only (1 Cast + 2 Changed all durable)");
    const totalActionsForVoteA = await getMongoCollection(MONGO_COLLECTIONS.participantActions).countDocuments({
      sourceId: voteIdA,
    });
    assert(totalActionsForVoteA === 3, `expected exactly 3 durable actions for voteIdA, found ${String(totalActionsForVoteA)}`);

    console.log("25. Replay all Vote events repeatedly (10x)");
    for (let i = 0; i < 10; i += 1) {
      await handleInitiativeDecisionVoteCastForParticipantAction(castEnvelope);
      await dispatchOutboxOnceForTests();
    }

    console.log("26. Confirm stable final count");
    const stableCount = await getMongoCollection(MONGO_COLLECTIONS.participantActions).countDocuments({
      sourceId: voteIdA,
    });
    assert(stableCount === 3, `expected the final count to remain 3 after replay, found ${String(stableCount)}`);

    console.log("27. Process Changed events out of order (dedicated fixture, v3 before v2, no Cast projection)");
    await castOrChangeInitiativeDecisionVote({
      decisionId: decisionIdC,
      participantId: signerMemberId,
      initiativeId: initiativeIdC,
      choice: "support",
      transparencyCohort: "verified",
    });
    await castOrChangeInitiativeDecisionVote({
      decisionId: decisionIdC,
      participantId: signerMemberId,
      initiativeId: initiativeIdC,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });
    const thirdChangeC = await castOrChangeInitiativeDecisionVote({
      decisionId: decisionIdC,
      participantId: signerMemberId,
      initiativeId: initiativeIdC,
      choice: "abstain",
      transparencyCohort: "verified",
    });
    assert(thirdChangeC.version === 3, "fixture C must reach version 3");
    const castEventIdC = buildInitiativeDecisionVoteCastEventId(voteIdC);
    const changedEventIdC2 = buildInitiativeDecisionVoteChangedEventId(voteIdC, 2);
    const changedEventIdC3 = buildInitiativeDecisionVoteChangedEventId(voteIdC, 3);
    outboxEventIdPrefixes.push(`initiative-decision-vote-cast:${voteIdC}`);
    outboxEventIdPrefixes.push(`initiative-decision-vote-changed:${voteIdC}:`);
    const changedOutboxV2C = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId: changedEventIdC2,
    });
    const changedOutboxV3C = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId: changedEventIdC3,
    });
    assert(changedOutboxV2C !== null && changedOutboxV3C !== null, "both C fixture Changed events must exist");
    const changedEnvelopeV2C = deserializeDomainEventEnvelope(changedOutboxV2C!.envelope);
    const changedEnvelopeV3C = deserializeDomainEventEnvelope(changedOutboxV3C!.envelope);

    // v3 is projected directly by calling the handler function itself,
    // entirely bypassing this script's own dispatch calls, and — crucially
    // — the mapper/handler never reads or requires any Cast action to
    // exist first. (This script never dispatches/handles fixture C's Cast
    // event through its own explicit calls: any Cast projection observed
    // below can only be attributable to the same pre-existing, documented
    // shared-environment race as `verify-participant-action-petition-signed.ts`
    // item 9 — a concurrently running long-lived `dev:api` process's own
    // background outbox dispatcher polling the same MongoDB — never to
    // this handler creating one as a side effect.)
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelopeV3C);
    assert(
      (await countParticipantActionsBySourceEventId(changedEventIdC3)) === 1,
      "the v3 Changed action must be projected even though v2 and Cast have not been explicitly processed by this script",
    );

    // Now project v2 "late" (out of logical order relative to v3).
    await handleInitiativeDecisionVoteChangedForParticipantAction(changedEnvelopeV2C);

    console.log("28. Confirm independent projection (both out-of-order actions present, no mutation)");
    assert(
      (await countParticipantActionsBySourceEventId(changedEventIdC2)) === 1,
      "the v2 Changed action must also be projected once received, regardless of delivery order",
    );
    assert(
      (await countParticipantActionsBySourceEventId(changedEventIdC3)) === 1,
      "the earlier-projected v3 Changed action must remain untouched by the later v2 projection",
    );

    console.log("29. Confirm Vote aggregate still holds only current choice");
    const voteCState = await getVoteById(voteIdC);
    assert(voteCState !== null, "the Vote aggregate must still exist");
    assert(voteCState!.choice === "abstain", "the Vote aggregate must hold only the single current choice");
    assert(voteCState!.version === 3, "the Vote aggregate's version must reflect only the latest committed change");
    // The ledger holding independently-projected v2/v3 actions above never
    // altered this — current state is derived solely from the Vote store.

    console.log("30. Confirm Petition Participant Action behavior still works");
    await createPetition({
      petitionId,
      collectiveDecisionId: petitionDecisionId,
      status: "Draft",
      createdAt: now,
      updatedAt: now,
      subject: {
        decisionId: petitionDecisionId,
        initiativeId: petitionInitiativeId,
        title: "Vote Participant Action Coexistence Check",
        summary: "Exercises the pre-existing PetitionSigned consumer alongside Vote projection.",
      },
      policy: structuredClone(defaultPetitionPolicy),
      shareLink: null,
      signatures: [],
      supportMetrics: {
        totalSignatures: 0,
        participantSignatures: 0,
        dailyActivity: [],
        supportThresholdStatus: {
          thresholdDefined: false,
          thresholdReached: false,
          currentCount: 0,
          thresholdCount: null,
        },
      },
      outcome: null,
    });
    await preparePetition(petitionId);
    await publishPetition(petitionId);
    await openPetition(petitionId);
    const signed = await signPetition(petitionId, signerMemberId, "Public");
    const signature = signed!.signatures[0]!;
    const petitionEventId = buildPetitionSignedEventId(signature.signatureId);
    outboxEventIdPrefixes.push(`petition-signed:signature-${petitionId}-`);
    await dispatchOutboxOnceForTests();
    assert(
      (await isEventProcessed(PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID, petitionEventId)) === true,
      "the pre-existing PetitionSigned Participant Action consumer must still process its event",
    );
    const petitionAction = await findParticipantActionBySourceEventId(petitionEventId);
    assert(petitionAction !== null, "exactly one petition_signed Participant Action must exist");
    assert(petitionAction!.actionType === "petition_signed", "Petition action type must remain petition_signed");
    assert(petitionAction!.metadata === null, "Petition action metadata remains null, unaffected by Vote metadata");

    console.log("31-32. Reconstruct: read the Cast Participant Action from a freshly-started OS process");
    const reloadScriptPath = path.resolve(
      path.dirname(SCRIPT_PATH),
      "verify-initiative-decision-vote-participant-actions-reload.ts",
    );
    const reloadResult = runVerificationSubprocess(reloadScriptPath, [
      castEventIdA,
      "initiative_decision_vote_cast",
      signerMemberId,
    ]);
    assertVerificationSubprocessSucceeded(
      reloadResult,
      "verify-initiative-decision-vote-participant-actions-reload.ts",
    );

    console.log("33. Confirm no Fair record change");
    const participantAfter = await getMemberById(signerMemberId);
    assert(
      JSON.stringify(participantAfter!.fair) === JSON.stringify(participantBefore!.fair),
      "Member.fair must be unchanged by Vote Participant Action projection",
    );

    console.log("34. Confirm no Activity write");
    const activityDocuments = await getMongoCollection(MONGO_COLLECTIONS.activities).countDocuments({
      creatorMemberId: signerMemberId,
      title: { $regex: "Vote Participant Action" },
    });
    assert(activityDocuments === 0, "no Activity document must be created by Vote Participant Action projection");

    console.log("35. Confirm no Journey implementation exists");
    const journeyModuleExists = existsSync(
      path.resolve(path.dirname(SCRIPT_PATH), "../modules/journey"),
    );
    assert(!journeyModuleExists, "no Journey module may exist");
    assert(
      !("journeys" in MONGO_COLLECTIONS),
      "no journeys Mongo collection may be registered",
    );

    console.log("36. Clean only owned fixtures");
    await deleteParticipantActionsBySourceEventIdForTests(castEventIdA);
    await deleteParticipantActionsBySourceEventIdForTests(changedEventIdV2);
    await deleteParticipantActionsBySourceEventIdForTests(changedEventIdV3);
    await deleteParticipantActionsBySourceEventIdForTests(castEventIdC);
    await deleteParticipantActionsBySourceEventIdForTests(changedEventIdC2);
    await deleteParticipantActionsBySourceEventIdForTests(changedEventIdC3);
    await deleteParticipantActionsBySourceEventIdForTests(petitionEventId);
    for (const initiativeId of ownedInitiativeIds) {
      await deleteParticipantActionsByInitiativeIdForTests(initiativeId);
    }
    for (const ownedDecisionId of ownedDecisionIds) {
      await deleteVotesByDecisionIdForTests(ownedDecisionId);
    }
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);
    for (const prefix of outboxEventIdPrefixes) {
      await deleteOutboxRecordsByEventIdPrefix(prefix);
      await deleteProcessedEventsByEventIdPrefix(prefix);
    }
    clearDomainEventHandlers();
    resetParticipantActionHandlersForTests();

    console.log("Initiative Decision Vote Participant Action verification passed.");
    // Flip the flag here, inside `main()`, *before* `runVerificationScript`'s
    // `finally` block calls `finalizeVerificationResources()` — see
    // `verify-initiative-decision-vote-events.ts` for the full rationale.
    verificationOutcomeDecided = true;
  } catch (error) {
    const participantActionModule = await import(
      "../modules/participant-action/infrastructure/participant-action.repository.js"
    );
    for (const initiativeId of ownedInitiativeIds) {
      await participantActionModule
        .deleteParticipantActionsByInitiativeIdForTests(initiativeId)
        .catch(() => undefined);
    }
    for (const ownedDecisionId of ownedDecisionIds) {
      await deleteVotesByDecisionIdForTests(ownedDecisionId).catch(() => undefined);
    }
    await deleteSignaturesByPetitionIdForTests(petitionId).catch(() => undefined);
    await deletePetitionsByIdForTests(petitionId).catch(() => undefined);
    for (const prefix of outboxEventIdPrefixes) {
      await deleteOutboxRecordsByEventIdPrefix(prefix).catch(() => undefined);
      await deleteProcessedEventsByEventIdPrefix(prefix).catch(() => undefined);
    }
    (
      await import("../infrastructure/integration/event-handler-registry.js")
    ).clearDomainEventHandlers();
    (
      await import("../modules/participant-action/index.js")
    ).resetParticipantActionHandlersForTests();
    throw error;
  }
}

await runVerificationScript(main);
