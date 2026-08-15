/**
 * Recovery Task 25 Part 22 — bounded PetitionSigned durable event
 * verification. Extended by Recovery Task 26 Part 12 to assert the
 * corrected participant-first actor field.
 *
 * Proves, end-to-end against a real MongoDB instance, that:
 *   1. signing a Petition inserts exactly one Petition Signature;
 *   2. signing also inserts exactly one durable `PetitionSigned` outbox
 *      event, sharing the Signature's own source identity;
 *   3. dispatching an outbox batch with zero registered `PetitionSigned`
 *      consumers does not error and does not affect signing behavior;
 *   4. the event remains queryable (by outboxId) after dispatch, i.e. is
 *      retained for future replay/backfill, not deleted;
 *   5. concurrent duplicate signing by the same Participant still produces
 *      exactly one stored Signature AND exactly one stored event — no
 *      double-write of either record;
 *   6. (Recovery Task 26) the Signature's own actor identity
 *      (`Signature.participantId`) is byte-identical to the durable event's
 *      actor identity (`PetitionSigned.payload.participantId`) — the
 *      platform is participant-first, so signing never requires or checks
 *      Member status, only the signer's own account existing/eligible.
 *
 * No Participant Action ledger, consumer, or collection is created or
 * exercised — Task 25/26 explicitly do not add one.
 *
 * Run: tsx src/scripts/verify-petition-signed-event.ts
 * (safe to run repeatedly: every fixture ID is unique per run and every
 * owned Petition/Signature/outbox fixture is deleted in a `finally` block)
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
  const initiativeId = `initiative-petition-signed-event-verify-${runId}`;
  const decisionId = `decision-petition-signed-event-verify-${runId}`;
  const petitionId = `petition-petition-signed-event-verify-${runId}`;
  const signerMemberId = "member-bootstrap-001";

  const { createInitiative } = await import("../modules/initiatives/initiative.store.js");
  const { createDecision } = await import("../modules/collective-decision/collective-decision.store.js");
  const { bootstrapCollectiveDecision } = await import(
    "../modules/collective-decision/bootstrap-collective-decision.js"
  );
  const {
    createPetition,
    preparePetition,
    publishPetition,
    openPetition,
    signPetition,
    getPetition,
    deletePetitionsByIdForTests,
    deleteSignaturesByPetitionIdForTests,
  } = await import("../modules/petition/petition.store.js");
  const { defaultPetitionPolicy } = await import("../modules/petition/petition.defaults.js");
  const { buildPetitionSignedEventId } = await import("../modules/petition/petition-signed.event.js");
  const { CATALOGUE_EVENTS } = await import("../infrastructure/events/catalogue-events.js");
  const { deserializeDomainEventEnvelope } = await import("../infrastructure/events/event-serialization.js");
  const { getHandlersForEvent } = await import("../infrastructure/integration/event-handler-registry.js");
  const { MONGO_COLLECTIONS } = await import("../infrastructure/mongodb/mongo-collections.js");
  const { getMongoCollection } = await import("../infrastructure/mongodb/mongo-database.js");
  const {
    dispatchOutboxOnceForTests,
    findOutboxRecordById,
    deleteOutboxRecordsByEventIdPrefix,
  } = await import("../infrastructure/outbox/index.js");

  const outboxEventIdPrefix = `petition-signed:signature-${petitionId}-`;

  try {
    console.log("1. Create valid Initiative fixture");
    const now = new Date().toISOString();
    const initiative: Initiative = {
      initiativeId,
      stewardId: signerMemberId,
      createdAt: now,
      updatedAt: now,
      title: "Petition Signed Event Verification Initiative",
      description: "Exists only to satisfy direct Initiative ancestry validation for this run.",
      status: "draft",
      lifecyclePhase: "draft",
      visibility: { policy: "steward_only" },
      metadata: {
        category: "Community",
        tags: ["Verification"],
        region: "British Columbia",
        language: "en",
        communitySlug: `petition-signed-event-verify-${runId}`,
        activityArea: "Environment",
      },
      revisions: [],
      contributions: [],
      timeline: [],
    };
    createInitiative(initiative);

    console.log("2. Create valid Collective Decision fixture (Approved)");
    await createDecision({
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId,
      decisionSubjectId: initiativeId,
    });

    console.log("3. Create and open Petition");
    await createPetition({
      petitionId,
      collectiveDecisionId: decisionId,
      status: "Draft",
      createdAt: now,
      updatedAt: now,
      subject: {
        decisionId,
        initiativeId,
        title: "Petition Signed Event Verification",
        summary: "Exercises the atomic durable PetitionSigned outbox event end-to-end.",
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

    // Recovery Task 26 Part 12 note: `defaultPetitionPolicy.eligibility
    // .membershipRequired` is `true`, but `isMemberEligibleForPetition`
    // implements it as `member.status !== "active"` — the base account's
    // active/inactive/suspended/archived status — not a check of earned
    // Membership (`MembershipRecord.status === "active_member"`, the
    // separate, independent "cohortLabel: Member" title). Signing therefore
    // requires only that the signer's existing legacy account record exist
    // and be in active account status; it never requires, checks, or
    // depends on earned Member status. This naming ambiguity in the
    // eligibility policy's field name is pre-existing and out of Task 26's
    // bounded scope (it is not part of the PetitionSigned event contract);
    // it is noted here, not fixed here.
    console.log("4. Sign once");
    const signed = await signPetition(petitionId, signerMemberId, "Public");
    assert(signed?.signatures.length === 1, "exactly one Signature must exist after signing once");
    const signature = signed!.signatures[0]!;
    const signatureId = signature.signatureId;
    const eventId = buildPetitionSignedEventId(signatureId);
    assert(
      signature.participantId === signerMemberId,
      "the public Signature response must carry the signing actor as participantId",
    );

    console.log("5. Confirm one Signature");
    const signatureCount = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).countDocuments({
      petitionId,
    });
    assert(signatureCount === 1, `expected exactly 1 Signature document, found ${String(signatureCount)}`);

    console.log("6. Confirm one outbox event, sharing the Signature's source identity");
    const outboxDocument = await getMongoCollection<{
      _id: string;
      eventName: string;
      aggregateType: string;
      aggregateId: string;
      status: string;
    }>(MONGO_COLLECTIONS.outbox).findOne({ eventId });
    assert(outboxDocument !== null, "expected exactly one PetitionSigned outbox document");
    assert(outboxDocument!.eventName === CATALOGUE_EVENTS.petitionSigned, "eventName must be PetitionSigned");
    assert(outboxDocument!.aggregateType === "PetitionSignature", "aggregateType must be PetitionSignature");
    assert(outboxDocument!.aggregateId === signatureId, "aggregateId must equal the Signature's own ID");
    // Known shared-environment flake (unrelated to Task 25/26): this Mongo
    // instance may also be polled by a concurrently running long-lived
    // `dev:api` process's own background outbox dispatcher, which can win
    // the race and mark this record "published" within milliseconds of
    // insert. Both statuses are valid evidence of "exactly one event was
    // enqueued" at this point; only an entirely-missing/duplicated record
    // would indicate an actual defect.
    assert(
      outboxDocument!.status === "pending" || outboxDocument!.status === "published",
      `the freshly-enqueued event must be pending or already published by a concurrent dispatcher, got "${outboxDocument!.status}"`,
    );

    console.log("7. Dispatch an outbox batch with no matching PetitionSigned consumer");
    assert(
      getHandlersForEvent(CATALOGUE_EVENTS.petitionSigned).length === 0,
      "this verification run must have zero PetitionSigned consumers registered",
    );
    const dispatchCount = await dispatchOutboxOnceForTests();
    assert(dispatchCount >= 1, "the dispatcher must process the unconsumed PetitionSigned event without error");

    console.log("8. Confirm signing behavior remains successful (post-dispatch reread)");
    const reread = await getPetition(petitionId);
    assert(reread?.signatures.length === 1, "signing must remain successful after dispatch of the unconsumed event");

    console.log("9. Confirm event remains queryable (retained for replay/backfill)");
    const publishedRecord = await findOutboxRecordById(outboxDocument!._id);
    assert(publishedRecord !== null, "the dispatched record must remain retrievable by outboxId");
    assert(publishedRecord!.status === "published", "the unconsumed event must reach published status");
    const recoveredEnvelope = deserializeDomainEventEnvelope(publishedRecord!.envelope);
    assert(recoveredEnvelope.payload.petitionId === petitionId, "the retained envelope must carry the original fact");
    assert(
      recoveredEnvelope.payload.participantId === signerMemberId,
      "the retained envelope must carry participantId (Recovery Task 26 — corrected from provisional memberId)",
    );
    assert(
      "memberId" in recoveredEnvelope.payload === false,
      "the retained envelope must not expose the provisional memberId field name",
    );
    assert(
      recoveredEnvelope.payload.participantId === signature.participantId,
      "Signature actor (Signature.participantId) must equal PetitionSigned actor (payload.participantId)",
    );
    assert(recoveredEnvelope.payload.initiativeId === initiativeId, "the retained envelope must carry initiativeId");

    console.log("10. Attempt concurrent duplicate signing");
    const concurrentResults = await Promise.allSettled([
      signPetition(petitionId, signerMemberId, "Public"),
      signPetition(petitionId, signerMemberId, "Public"),
    ]);
    const concurrentFulfilled = concurrentResults.filter((result) => result.status === "fulfilled");
    const concurrentRejected = concurrentResults.filter((result) => result.status === "rejected");
    assert(
      concurrentFulfilled.length === 0 && concurrentRejected.length === 2,
      "both concurrent duplicate signing attempts by an already-signed Member must fail",
    );

    console.log("11. Confirm one total Signature");
    const finalSignatureCount = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).countDocuments({
      petitionId,
    });
    assert(
      finalSignatureCount === 1,
      `expected exactly 1 total Signature, found ${String(finalSignatureCount)}`,
    );

    console.log("12. Confirm one total PetitionSigned event");
    const finalOutboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert(
      finalOutboxCount === 1,
      `expected exactly 1 total PetitionSigned event, found ${String(finalOutboxCount)}`,
    );

    console.log("13. Clean owned fixtures");
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);
    await deleteOutboxRecordsByEventIdPrefix(outboxEventIdPrefix);

    console.log("PetitionSigned event verification passed.");
  } catch (error) {
    // Best-effort cleanup even on failure, so a failed run never leaks
    // fixtures into subsequent runs.
    await deleteSignaturesByPetitionIdForTests(petitionId).catch(() => undefined);
    await deletePetitionsByIdForTests(petitionId).catch(() => undefined);
    await deleteOutboxRecordsByEventIdPrefix(outboxEventIdPrefix).catch(() => undefined);
    throw error;
  }
}

await runVerificationScript(main);
