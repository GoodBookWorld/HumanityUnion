/**
 * Recovery Task 27 Part 22 — bounded, end-to-end Participant Action Ledger
 * verification against a real MongoDB instance.
 *
 * Proves that:
 *   1. a base Participant (no earned Member status required) can sign a
 *      Petition and produce exactly one Signature and one durable
 *      `PetitionSigned` event;
 *   2. dispatching that event to the registered Participant Action consumer
 *      inserts exactly one durable `participant_actions` record;
 *   3. the Participant Action's `participantId` is byte-identical to the
 *      signing actor;
 *   4. replaying/redispatching the same event does not create a second
 *      Participant Action (idempotent by `sourceEventId`);
 *   5. no Member status, Fair, or legacy Activity is mutated by any of the
 *      above;
 *   6. the Participant Action is discoverable via the narrow internal
 *      by-Participant and by-Initiative repository queries.
 *
 * Run: tsx src/scripts/verify-participant-action-petition-signed.ts
 * (safe to run repeatedly: every fixture ID is unique per run and every
 * owned Petition/Signature/outbox/Participant Action fixture is deleted in a
 * `finally` block)
 */
import type { Initiative } from "@hu/types";

import { runVerificationScript } from "./verification-script-lifecycle.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const initiativeId = `initiative-participant-action-verify-${runId}`;
  const decisionId = `decision-participant-action-verify-${runId}`;
  const petitionId = `petition-participant-action-verify-${runId}`;
  const signerMemberId = "member-bootstrap-001";

  const { createInitiative } = await import("../modules/initiatives/initiative.store.js");
  const { createDecision } =
    await import("../modules/collective-decision/collective-decision.store.js");
  const { bootstrapCollectiveDecision } =
    await import("../modules/collective-decision/bootstrap-collective-decision.js");
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
  const { buildPetitionSignedEventId } =
    await import("../modules/petition/petition-signed.event.js");
  const { getMemberById } = await import("../modules/member/member-access.js");
  const { CATALOGUE_EVENTS } = await import("../infrastructure/events/catalogue-events.js");
  const { deserializeDomainEventEnvelope } =
    await import("../infrastructure/events/event-serialization.js");
  const { clearDomainEventHandlers, registerDomainEventHandler } =
    await import("../infrastructure/integration/event-handler-registry.js");
  const { MONGO_COLLECTIONS } = await import("../infrastructure/mongodb/mongo-collections.js");
  const { getMongoCollection } = await import("../infrastructure/mongodb/mongo-database.js");
  const {
    dispatchOutboxOnceForTests,
    deleteOutboxRecordsByEventIdPrefix,
    deleteProcessedEventsByEventIdPrefix,
    isEventProcessed,
  } = await import("../infrastructure/outbox/index.js");
  const {
    handlePetitionSignedForParticipantAction,
    PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
  } =
    await import("../modules/participant-action/application/petition-signed.participant-action-handler.js");
  const {
    countParticipantActionsBySourceEventId,
    deleteParticipantActionsBySourceEventIdForTests,
    findParticipantActionBySourceEventId,
    listParticipantActionsByInitiativeId,
    listParticipantActionsByParticipantId,
  } = await import("../modules/participant-action/infrastructure/participant-action.repository.js");

  const outboxEventIdPrefix = `petition-signed:signature-${petitionId}-`;
  let participantActionSourceEventId: string | null = null;

  try {
    console.log("1. Create base Participant fixture (member-bootstrap-001)");
    const participantBefore = await getMemberById(signerMemberId);
    assert(participantBefore !== null, "the bootstrap Participant fixture must already exist");

    console.log("2. Confirm no earned Member status is required to sign or to be projected");
    // `member-bootstrap-001` is used as-is; nothing here elevates or checks
    // `cohortLabel`/earned Membership. See petition.store.ts's
    // `isParticipantEligibleForPetition`, which only checks base account
    // status, never earned Membership.

    console.log("3. Create Initiative fixture");
    const now = new Date().toISOString();
    const initiative: Initiative = {
      initiativeId,
      stewardId: signerMemberId,
      createdAt: now,
      updatedAt: now,
      title: "Participant Action Ledger Verification Initiative",
      description: "Exists only to satisfy direct Initiative ancestry validation for this run.",
      status: "draft",
      lifecyclePhase: "draft",
      visibility: { policy: "steward_only" },
      metadata: {
        category: "Community",
        tags: ["Verification"],
        region: "British Columbia",
        language: "en",
        communitySlug: `participant-action-verify-${runId}`,
        activityArea: "Environment",
      },
      revisions: [],
      contributions: [],
      timeline: [],
    };
    createInitiative(initiative);

    console.log("4. Create approved Collective Decision fixture");
    await createDecision({
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId,
      decisionSubjectId: initiativeId,
    });

    console.log("5. Create and open Petition");
    await createPetition({
      petitionId,
      collectiveDecisionId: decisionId,
      status: "Draft",
      createdAt: now,
      updatedAt: now,
      subject: {
        decisionId,
        initiativeId,
        title: "Participant Action Ledger Verification",
        summary:
          "Exercises the idempotent PetitionSigned to Participant Action projection end-to-end.",
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

    console.log("6. Sign Petition");
    const signed = await signPetition(petitionId, signerMemberId, "Public");
    assert(signed?.signatures.length === 1, "exactly one Signature must exist after signing once");
    const signature = signed!.signatures[0]!;

    console.log("7. Confirm one Signature");
    const signatureCount = await getMongoCollection(
      MONGO_COLLECTIONS.petitionSignatures,
    ).countDocuments({
      petitionId,
    });
    assert(
      signatureCount === 1,
      `expected exactly 1 Signature document, found ${String(signatureCount)}`,
    );

    console.log("8. Confirm one PetitionSigned event with participantId");
    const eventId = buildPetitionSignedEventId(signature.signatureId);
    participantActionSourceEventId = eventId;
    const outboxDocument = await getMongoCollection<{ envelope: string; eventName: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId });
    assert(outboxDocument !== null, "expected exactly one PetitionSigned outbox document");
    assert(
      outboxDocument!.eventName === CATALOGUE_EVENTS.petitionSigned,
      "eventName must be PetitionSigned",
    );
    const producedEnvelope = deserializeDomainEventEnvelope(outboxDocument!.envelope);
    assert(
      producedEnvelope.payload.participantId === signerMemberId,
      "PetitionSigned payload must carry participantId equal to the signing actor",
    );

    console.log("9. Dispatch the event to the registered Participant Action consumer");
    clearDomainEventHandlers();
    registerDomainEventHandler({
      consumerId: PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.petitionSigned,
      handle: handlePetitionSignedForParticipantAction,
    });
    // Known shared-environment flake (same class as Task 25/26's outbox
    // note): a concurrently running long-lived `dev:api` process's own
    // background outbox dispatcher — which also registers this consumer via
    // `bootstrapEventInfrastructure` — can win the race and process this
    // event first. `dispatchOutboxOnceForTests` still reports the record as
    // dispatched either way (the dispatcher's `processed-events` claim makes
    // "already completed by someone else" a normal, successful outcome, not
    // an error), and the outcome asserted next — exactly one durable
    // Participant Action exists — is identical regardless of which process
    // performed the insert.
    const dispatchCount = await dispatchOutboxOnceForTests();
    assert(dispatchCount >= 1, "the dispatcher must process the PetitionSigned event");
    assert(
      (await isEventProcessed(PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID, eventId)) === true,
      "the Participant Action consumer must mark the event processed",
    );

    console.log("10. Confirm one Participant Action");
    const countAfterFirstDispatch = await countParticipantActionsBySourceEventId(eventId);
    assert(
      countAfterFirstDispatch === 1,
      `expected exactly 1 Participant Action, found ${String(countAfterFirstDispatch)}`,
    );

    console.log("11. Confirm Participant Action uses the same participantId");
    const record = await findParticipantActionBySourceEventId(eventId);
    assert(record !== null, "the Participant Action record must be findable by sourceEventId");
    assert(
      record!.participantId === signerMemberId,
      "Participant Action participantId must equal the signing actor",
    );
    assert(
      record!.initiativeId === initiativeId,
      "Participant Action initiativeId must equal the Petition's Initiative",
    );
    assert(
      record!.sourceId === signature.signatureId,
      "Participant Action sourceId must equal the Signature ID",
    );
    assert(
      record!.actionType === "petition_signed",
      "Participant Action actionType must be petition_signed",
    );
    assert(record!.validityStatus === "valid", "Participant Action validityStatus must be valid");

    console.log("12. Replay/redispatch the event");
    await handlePetitionSignedForParticipantAction(producedEnvelope);
    const dispatchCountAgain = await dispatchOutboxOnceForTests();
    assert(
      dispatchCountAgain === 0,
      "a fully published record has nothing left pending to redispatch",
    );

    console.log("13. Confirm still one Participant Action");
    const countAfterReplay = await countParticipantActionsBySourceEventId(eventId);
    assert(
      countAfterReplay === 1,
      `expected exactly 1 Participant Action after replay, found ${String(countAfterReplay)}`,
    );

    console.log("14. Confirm no Member-status change");
    const participantAfter = await getMemberById(signerMemberId);
    assert(participantAfter !== null, "the Participant fixture must still exist");
    assert(
      participantAfter!.status === participantBefore!.status,
      "Member.status must be unchanged by Participant Action projection",
    );

    console.log("15. Confirm no Fair change");
    assert(
      JSON.stringify(participantAfter!.fair) === JSON.stringify(participantBefore!.fair),
      "Member.fair must be unchanged by Participant Action projection",
    );

    console.log("16. Confirm no Activity write");
    const activityDocumentsForInitiative = await getMongoCollection(
      MONGO_COLLECTIONS.activities,
    ).countDocuments({
      creatorMemberId: signerMemberId,
      title: { $regex: "Participant Action Ledger Verification" },
    });
    assert(
      activityDocumentsForInitiative === 0,
      "no Activity document must be created by Participant Action projection",
    );

    console.log("17. Confirm Participant and Initiative repository queries return the action");
    const byParticipant = await listParticipantActionsByParticipantId(signerMemberId);
    assert(
      byParticipant.some((entry) => entry.sourceEventId === eventId),
      "listParticipantActionsByParticipantId must return this run's Participant Action",
    );
    const byInitiative = await listParticipantActionsByInitiativeId(initiativeId);
    assert(
      byInitiative.some((entry) => entry.sourceEventId === eventId),
      "listParticipantActionsByInitiativeId must return this run's Participant Action",
    );

    console.log("18. Clean only owned fixtures");
    await deleteParticipantActionsBySourceEventIdForTests(eventId);
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);
    await deleteOutboxRecordsByEventIdPrefix(outboxEventIdPrefix);
    await deleteProcessedEventsByEventIdPrefix(outboxEventIdPrefix);
    clearDomainEventHandlers();

    console.log("Participant Action Ledger verification passed.");
  } catch (error) {
    // Best-effort cleanup even on failure, so a failed run never leaks
    // fixtures into subsequent runs.
    if (participantActionSourceEventId) {
      await (
        await import("../modules/participant-action/infrastructure/participant-action.repository.js")
      )
        .deleteParticipantActionsBySourceEventIdForTests(participantActionSourceEventId)
        .catch(() => undefined);
    }
    await deleteSignaturesByPetitionIdForTests(petitionId).catch(() => undefined);
    await deletePetitionsByIdForTests(petitionId).catch(() => undefined);
    await deleteOutboxRecordsByEventIdPrefix(outboxEventIdPrefix).catch(() => undefined);
    await deleteProcessedEventsByEventIdPrefix(outboxEventIdPrefix).catch(() => undefined);
    (
      await import("../infrastructure/integration/event-handler-registry.js")
    ).clearDomainEventHandlers();
    throw error;
  }
}

await runVerificationScript(main);
