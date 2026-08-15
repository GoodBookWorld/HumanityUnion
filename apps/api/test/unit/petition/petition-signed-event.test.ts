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
  findOutboxRecordById,
  setForceEnqueueFailureForTests,
} from "../../../src/infrastructure/outbox/index.js";
import {
  createPetition,
  deletePetitionsByIdForTests,
  deleteSignaturesByPetitionIdForTests,
  closePetition,
  getPetition,
  signPetition,
} from "../../../src/modules/petition/petition.store.js";
import {
  PETITION_SIGNATURE_AGGREGATE_TYPE,
  buildPetitionSignedEventId,
  createPetitionSignedEvent,
} from "../../../src/modules/petition/petition-signed.event.js";
import { sampleMember } from "../../../src/modules/member/member.sample.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { drainPendingOutboxForTests, resetEventInfrastructureForTests } from "../../helpers/test-events.js";
import {
  FIXTURE_INITIATIVE_ID,
  buildFixturePetition,
  seedApprovedDecision,
  seedOpenPetition,
} from "./petition-test-helpers.js";

/**
 * Recovery Task 25 Part 19 — focused Petition Signed event tests: event
 * construction, success path, failure path, and outbox lifecycle. Numbering
 * below matches Part 19 exactly, for traceability.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, "../../..");
const apiSrcDir = path.join(apiRoot, "src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdPetitionIds: string[] = [];
const NONEXISTENT_MEMBER_ID = `member-does-not-exist-task25-${testRunId}`;

function nextId(label: string): string {
  const id = `petition-task25-event-${label}-${testRunId}`;
  createdPetitionIds.push(id);
  return id;
}

before(async () => {
  resetEventInfrastructureForTests();
  await connectMongoClient();
  await ensureMongoIndexes();
  // Clears ambient pending outbox backlog from unrelated suites so this
  // file's batch-dispatch assertions (#30-34) deterministically observe
  // only the records this file itself creates.
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
    await deleteOutboxRecordsByEventIdPrefix(`petition-signed:signature-${petitionId}-`);
    await deleteProcessedEventsByEventIdPrefix(`petition-signed:signature-${petitionId}-`);
  }

  await disconnectMongoClient();
});

describe("Event construction", () => {
  const fixedSignedAt = "2026-07-28T00:00:00.000Z";
  const event = createPetitionSignedEvent({
    petitionId: "petition-construction-fixture",
    signatureId: "signature-petition-construction-fixture-member-construction-fixture",
    participantId: "member-construction-fixture",
    initiativeId: "initiative-construction-fixture",
    participationMode: "Community",
    signedAt: fixedSignedAt,
  });

  it("1. correct event name", () => {
    assert.equal(event.eventName, "PetitionSigned");
    assert.equal(event.eventName, CATALOGUE_EVENTS.petitionSigned);
  });

  it("2. correct schema version", () => {
    assert.equal(event.metadata.schemaVersion, DOMAIN_EVENT_SCHEMA_VERSION);
  });

  it("3. correct aggregate type", () => {
    assert.equal(event.aggregateType, "PetitionSignature");
    assert.equal(event.aggregateType, PETITION_SIGNATURE_AGGREGATE_TYPE);
  });

  it("4. correct aggregate ID", () => {
    assert.equal(event.aggregateId, "signature-petition-construction-fixture-member-construction-fixture");
    assert.equal(event.aggregateId, event.payload.signatureId);
  });

  it("5. correct Petition ID", () => {
    assert.equal(event.payload.petitionId, "petition-construction-fixture");
  });

  it("6. correct Signature ID", () => {
    assert.equal(
      event.payload.signatureId,
      "signature-petition-construction-fixture-member-construction-fixture",
    );
  });

  it("7. correct Participant ID (Recovery Task 26 — corrected from provisional memberId)", () => {
    assert.equal(event.payload.participantId, "member-construction-fixture");
    assert.equal("memberId" in event.payload, false, "the payload must no longer expose memberId");
  });

  it("8. correct Initiative ID", () => {
    assert.equal(event.payload.initiativeId, "initiative-construction-fixture");
  });

  it("9. correct signed timestamp", () => {
    assert.equal(event.payload.signedAt, fixedSignedAt);
    assert.equal(event.metadata.occurredAt, fixedSignedAt);
  });

  it("10. correct participation mode behavior", () => {
    assert.equal(event.payload.participationMode, "Community");

    const withoutMode = createPetitionSignedEvent({
      petitionId: "petition-construction-fixture",
      signatureId: "signature-construction-fixture-no-mode",
      participantId: "member-construction-fixture",
      initiativeId: "initiative-construction-fixture",
      signedAt: fixedSignedAt,
    });
    assert.equal(withoutMode.payload.participationMode, null);
    assert.equal("participationMode" in withoutMode.payload, true, "field must be present, not omitted");
  });

  it("11. no Petition mutable content", () => {
    const keys = Object.keys(event.payload);
    for (const forbiddenKey of ["title", "summary", "statement", "requestedAction", "supportMetrics", "outcome", "visibility"]) {
      assert.equal(keys.includes(forbiddenKey), false, `payload must not include "${forbiddenKey}"`);
    }
  });

  it("12. no Participant personal/contact data", () => {
    const keys = Object.keys(event.payload);
    for (const forbiddenKey of ["email", "displayName", "ipAddress", "authClaims", "profile"]) {
      assert.equal(keys.includes(forbiddenKey), false, `payload must not include "${forbiddenKey}"`);
    }
  });

  it("13. no Fair or Participant Action fields", () => {
    const keys = Object.keys(event.payload);
    for (const forbiddenKey of ["fairPoints", "socialActivityScore", "actionType", "sourceType"]) {
      assert.equal(keys.includes(forbiddenKey), false, `payload must not include "${forbiddenKey}"`);
    }
    assert.deepEqual(keys.sort(), [
      "initiativeId",
      "participantId",
      "participationMode",
      "petitionId",
      "signatureId",
      "signedAt",
    ]);
  });
});

describe("Success path", () => {
  it("14. successful signing inserts one Signature", async () => {
    const petitionId = nextId("success-signature");
    const decisionId = `decision-task25-event-success-signature-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    await signPetition(petitionId, sampleMember.id);

    const count = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).countDocuments({
      petitionId,
    });
    assert.equal(count, 1);
  });

  it("15. successful signing inserts one outbox record", async () => {
    const petitionId = nextId("success-outbox");
    const decisionId = `decision-task25-event-success-outbox-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    const signatureId = String(signed?.signatures[0]?.signatureId);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId: buildPetitionSignedEventId(signatureId),
    });
    assert.equal(outboxCount, 1);
  });

  it("16. Signature and event share source identity", async () => {
    const petitionId = nextId("shared-identity");
    const decisionId = `decision-task25-event-shared-identity-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    const signatureId = String(signed?.signatures[0]?.signatureId);

    const outboxRecord = await getMongoCollection<{
      eventId: string;
      aggregateType: string;
      aggregateId: string;
    }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId: buildPetitionSignedEventId(signatureId),
    });

    assert.ok(outboxRecord);
    assert.equal(outboxRecord.aggregateType, "PetitionSignature");
    assert.equal(outboxRecord.aggregateId, signatureId);
  });

  it("17. Event uses the validated persisted Initiative ID", async () => {
    const petitionId = nextId("event-initiative-id");
    const decisionId = `decision-task25-event-initiative-id-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    const signatureId = String(signed?.signatures[0]?.signatureId);

    const outboxRecord = await getMongoCollection<{ eventId: string; envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildPetitionSignedEventId(signatureId) });

    assert.ok(outboxRecord);
    const envelope = deserializeDomainEventEnvelope(outboxRecord.envelope);
    assert.equal(envelope.payload.initiativeId, FIXTURE_INITIATIVE_ID);
  });

  it("18. Additional Initiative lookup count is zero", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    const signPetitionBody = source.slice(
      source.indexOf("export async function signPetition"),
      source.indexOf("export async function closePetition"),
    );

    assert.equal(/getInitiativeById\(/.test(signPetitionBody), false);
    assert.equal(/validateDirectInitiativeAncestry\(/.test(signPetitionBody), false);
  });

  it("19. Existing response shape remains unchanged", async () => {
    const petitionId = nextId("response-shape");
    const decisionId = `decision-task25-event-response-shape-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    const signature = signed!.signatures[0]!;

    assert.deepEqual(Object.keys(signature).sort(), [
      "participantId",
      "participationMode",
      "petitionId",
      "signatureId",
      "signedAt",
      "status",
      "visibility",
    ]);
    assert.equal("eventId" in signature, false, "event identity must never leak into the Signature response");
  });
});

describe("Failure path", () => {
  it("20. Validation failure (Petition never opened) inserts no event", async () => {
    const petitionId = nextId("validation-failure");
    const decisionId = `decision-task25-event-validation-failure-${testRunId}`;
    await seedApprovedDecision(decisionId, FIXTURE_INITIATIVE_ID);
    await createPetition(
      buildFixturePetition({ petitionId, decisionId, initiativeId: FIXTURE_INITIATIVE_ID }),
    );

    // Petition is left in Draft — never prepared/published/opened.
    await assert.rejects(() => signPetition(petitionId, sampleMember.id), /not open for signing/);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert.equal(outboxCount, 0);
  });

  it("21. Missing Petition inserts no event", async () => {
    const missingPetitionId = `petition-task25-event-does-not-exist-${testRunId}`;

    const result = await signPetition(missingPetitionId, sampleMember.id);
    assert.equal(result, null);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${missingPetitionId}-` },
    });
    assert.equal(outboxCount, 0);
  });

  it("22. Closed Petition inserts no event", async () => {
    const petitionId = nextId("closed-petition");
    const decisionId = `decision-task25-event-closed-petition-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);
    await closePetition(petitionId);

    await assert.rejects(() => signPetition(petitionId, sampleMember.id), /not open for signing/);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert.equal(outboxCount, 0);
  });

  it("23. Eligibility failure inserts no event", async () => {
    const petitionId = nextId("eligibility-failure");
    const decisionId = `decision-task25-event-eligibility-failure-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    await assert.rejects(() => signPetition(petitionId, NONEXISTENT_MEMBER_ID), /not eligible/);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert.equal(outboxCount, 0);
  });

  it("24. Sequential duplicate inserts no second event", async () => {
    const petitionId = nextId("sequential-duplicate");
    const decisionId = `decision-task25-event-sequential-duplicate-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    await signPetition(petitionId, sampleMember.id);
    await assert.rejects(() => signPetition(petitionId, sampleMember.id), /already signed/);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert.equal(outboxCount, 1);
  });

  it("25. Concurrent duplicate inserts exactly one event", async () => {
    const petitionId = nextId("concurrent-duplicate");
    const decisionId = `decision-task25-event-concurrent-duplicate-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const results = await Promise.allSettled([
      signPetition(petitionId, sampleMember.id),
      signPetition(petitionId, sampleMember.id),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const signatureCount = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).countDocuments({
      petitionId,
    });
    assert.equal(signatureCount, 1);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert.equal(outboxCount, 1);
  });

  it("26. Signature insert failure inserts no event (duplicate-key path — the one reproducible insert failure; see #25)", async () => {
    const petitionId = nextId("signature-insert-failure");
    const decisionId = `decision-task25-event-signature-insert-failure-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const results = await Promise.allSettled([
      signPetition(petitionId, sampleMember.id),
      signPetition(petitionId, sampleMember.id),
    ]);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert.equal(outboxCount, 1, "the losing concurrent attempt must not leave a stray outbox record");
  });

  it("27. Outbox insert failure rolls back Signature", async () => {
    const petitionId = nextId("outbox-failure-rollback");
    const decisionId = `decision-task25-event-outbox-failure-rollback-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    setForceEnqueueFailureForTests(true);
    try {
      await assert.rejects(() => signPetition(petitionId, sampleMember.id));
    } finally {
      setForceEnqueueFailureForTests(false);
    }

    const signatureCount = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).countDocuments({
      petitionId,
    });
    assert.equal(signatureCount, 0, "a rolled-back transaction must leave no Signature document");

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert.equal(outboxCount, 0, "a rolled-back transaction must leave no outbox document");
  });

  it("28. Transaction failure leaves neither record", async () => {
    const petitionId = nextId("transaction-failure-neither");
    const decisionId = `decision-task25-event-transaction-failure-neither-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    setForceEnqueueFailureForTests(true);
    try {
      await assert.rejects(() => signPetition(petitionId, sampleMember.id));
    } finally {
      setForceEnqueueFailureForTests(false);
    }

    const reloaded = await getPetition(petitionId);
    assert.equal(reloaded?.signatures.length, 0);

    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `^signature-${petitionId}-` },
    });
    assert.equal(outboxCount, 0);
  });

  it("29. One logical signing operation constructs exactly one stable event ID (retry-safety guarantee)", async () => {
    // A genuine replica-set transient-transaction-error retry is not
    // reproducible with the existing test toolkit (no Mongo failpoint
    // helper exists in this codebase, and Part 20 explicitly discourages
    // monkey-patching Mongo internals to fabricate one). Instead this test
    // proves the structural guarantee that makes any real retry safe:
    //
    //   1. the event is constructed once, from the deterministic
    //      Signature ID, BEFORE `runMongoTransaction` is ever called
    //      (source-position check below) — so a callback retry cannot
    //      construct a second, differently-ID'd event;
    //   2. the event ID is a pure function of the Signature ID, so two
    //      independent constructions from the same signing context always
    //      produce the identical event ID (idempotent by construction).
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    const constructIndex = source.indexOf("const signedEvent = createPetitionSignedEvent(");
    const transactionIndex = source.indexOf("await runMongoTransaction(async (session) => {");
    assert.ok(constructIndex > -1 && transactionIndex > -1);
    assert.ok(
      constructIndex < transactionIndex,
      "the event must be constructed before runMongoTransaction is invoked, so a callback retry reuses it",
    );

    const first = createPetitionSignedEvent({
      petitionId: "petition-retry-fixture",
      signatureId: "signature-petition-retry-fixture-member-retry-fixture",
      participantId: "member-retry-fixture",
      initiativeId: "initiative-retry-fixture",
      signedAt: "2026-07-28T00:00:00.000Z",
    });
    const second = createPetitionSignedEvent({
      petitionId: "petition-retry-fixture",
      signatureId: "signature-petition-retry-fixture-member-retry-fixture",
      participantId: "member-retry-fixture",
      initiativeId: "initiative-retry-fixture",
      signedAt: "2026-07-28T00:00:00.000Z",
    });
    assert.equal(first.eventId, second.eventId);
  });
});

describe("Outbox lifecycle", () => {
  it("30/31/32/33. Unconsumed PetitionSigned event does not break signing, dispatch of an unrelated event is unaffected, and the event remains queryable after dispatch with no consumer registration", async () => {
    clearDomainEventHandlers();
    assert.deepEqual(getHandlersForEvent(CATALOGUE_EVENTS.petitionSigned), []);

    const petitionId = nextId("outbox-lifecycle");
    const decisionId = `decision-task25-event-outbox-lifecycle-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    assert.equal(signed?.signatures.length, 1, "signing must succeed with zero PetitionSigned consumers");

    const signatureId = String(signed?.signatures[0]?.signatureId);
    const eventId = buildPetitionSignedEventId(signatureId);

    const pendingRecord = await getMongoCollection<{ status: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.equal(pendingRecord?.status, "pending");

    const dispatchCount = await dispatchOutboxOnceForTests();
    assert.ok(dispatchCount >= 1, "the dispatcher must process the unconsumed PetitionSigned event without error");

    const published = await getMongoCollection<{ status: string; envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId });
    assert.equal(published?.status, "published", "an unconsumed event must still reach published status");

    // 32/33: still queryable, no consumer registration required.
    assert.deepEqual(getHandlersForEvent(CATALOGUE_EVENTS.petitionSigned), []);
    const envelope = deserializeDomainEventEnvelope(published!.envelope);
    assert.equal(envelope.eventName, "PetitionSigned");
  });

  it("34. Event can serve as a future replay/backfill source (full envelope recoverable after dispatch)", async () => {
    const petitionId = nextId("outbox-replay");
    const decisionId = `decision-task25-event-outbox-replay-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id, "Public");
    const signatureId = String(signed?.signatures[0]?.signatureId);
    const eventId = buildPetitionSignedEventId(signatureId);

    await dispatchOutboxOnceForTests();

    const record = await findOutboxRecordById(
      (await getMongoCollection<{ _id: string }>(MONGO_COLLECTIONS.outbox).findOne({ eventId }))!._id,
    );
    assert.ok(record, "the dispatched record must remain retrievable by outboxId for replay/backfill");

    const envelope = deserializeDomainEventEnvelope(record!.envelope);
    assert.equal(envelope.payload.petitionId, petitionId);
    assert.equal(envelope.payload.signatureId, signatureId);
    assert.equal(envelope.payload.participantId, sampleMember.id);
    assert.equal(envelope.payload.initiativeId, FIXTURE_INITIATIVE_ID);
    assert.equal(envelope.payload.participationMode, "Public");
  });
});
