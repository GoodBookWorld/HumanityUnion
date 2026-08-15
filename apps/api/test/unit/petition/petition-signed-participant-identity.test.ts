import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { deserializeDomainEventEnvelope } from "../../../src/infrastructure/events/event-serialization.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  dispatchOutboxOnceForTests,
} from "../../../src/infrastructure/outbox/index.js";
import {
  deletePetitionsByIdForTests,
  deleteSignaturesByPetitionIdForTests,
  signPetition,
} from "../../../src/modules/petition/petition.store.js";
import {
  buildPetitionSignedEventId,
  createPetitionSignedEvent,
} from "../../../src/modules/petition/petition-signed.event.js";
import { getMemberById } from "../../../src/modules/member/member-access.js";
import { sampleMember } from "../../../src/modules/member/member.sample.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  drainPendingOutboxForTests,
  resetEventInfrastructureForTests,
} from "../../helpers/test-events.js";
import { seedOpenPetition } from "./petition-test-helpers.js";

/**
 * Recovery Task 26 — "Correct the Participant-First Identity and Action
 * Vocabulary Before Implementing the Participation Ledger".
 *
 * The platform is participant-first: every Member is a Participant, but not
 * every Participant is a Member (`packages/types/src/domain/membership.ts`'s
 * `MembershipSummary.cohortLabel: "Participant" | "Member"` already encodes
 * this distinction as an accepted, pre-existing domain fact). Recovery
 * Task 25 introduced `PetitionSigned.payload.memberId` as a provisional
 * name; this file pins the corrected `participantId` contract and proves
 * the surrounding safety properties the correction must not disturb.
 *
 * This file does not implement, and must not be read as implementing, any
 * part of a Participant Action ledger, consumer, or collection.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, "../../..");
const apiSrcDir = path.join(apiRoot, "src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdPetitionIds: string[] = [];

function nextId(label: string): string {
  const id = `petition-task26-identity-${label}-${testRunId}`;
  createdPetitionIds.push(id);
  return id;
}

before(async () => {
  resetEventInfrastructureForTests();
  await connectMongoClient();
  await ensureMongoIndexes();
  await drainPendingOutboxForTests();
});

after(async () => {
  resetEventInfrastructureForTests();

  for (const petitionId of createdPetitionIds) {
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);
    await deleteOutboxRecordsByEventIdPrefix(`petition-signed:signature-${petitionId}-`);
  }

  await disconnectMongoClient();
});

describe("1-2. PetitionSigned uses participantId, not memberId", () => {
  it("the payload interface source declares participantId and never declares a memberId field", () => {
    const source = readFileSync(
      path.join(apiSrcDir, "modules/petition/petition-signed.event.ts"),
      "utf8",
    );
    const payloadInterface = source.slice(
      source.indexOf("export interface PetitionSignedPayload"),
      source.indexOf("}", source.indexOf("export interface PetitionSignedPayload")) + 1,
    );

    assert.match(payloadInterface, /participantId: string;/);
    assert.doesNotMatch(payloadInterface, /\bmemberId\b/);
  });

  it("createPetitionSignedEvent's input contract takes participantId, not memberId", () => {
    const event = createPetitionSignedEvent({
      petitionId: "petition-task26-fixture",
      signatureId: "signature-task26-fixture",
      participantId: "member-task26-fixture",
      initiativeId: "initiative-task26-fixture",
      signedAt: "2026-07-28T00:00:00.000Z",
    });

    assert.equal(event.payload.participantId, "member-task26-fixture");
    assert.equal("memberId" in event.payload, false);
  });
});

describe("3. The payload value equals the exact identity signPetition was called with", () => {
  it("payload.participantId equals the participantId argument passed to signPetition, end-to-end", async () => {
    const petitionId = nextId("value-equality");
    const decisionId = `decision-task26-identity-value-equality-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    const signature = signed!.signatures[0]!;

    const outboxRecord = await getMongoCollection<{ envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({
      eventId: buildPetitionSignedEventId(signature.signatureId),
    });
    assert.ok(outboxRecord);
    const envelope = deserializeDomainEventEnvelope(outboxRecord.envelope);

    // Same identity, seen from three independent angles: the signPetition
    // call argument, the persisted-and-mapped public Signature DTO field
    // (`participantId`, from Signature's own `@hu/types` contract), and the
    // durable event payload — all three must agree.
    assert.equal(envelope.payload.participantId, sampleMember.id);
    assert.equal(signature.participantId, sampleMember.id);
    assert.equal(envelope.payload.participantId, signature.participantId);
  });
});

describe("4-6. Event ID, aggregate type, and aggregate ID are unaffected by the rename", () => {
  it("event ID remains petition-signed:<signatureId>, unchanged in format", () => {
    assert.equal(buildPetitionSignedEventId("signature-x-y"), "petition-signed:signature-x-y");
  });

  it("aggregate type/ID remain PetitionSignature / signatureId, unchanged", () => {
    const event = createPetitionSignedEvent({
      petitionId: "petition-task26-fixture",
      signatureId: "signature-task26-fixture",
      participantId: "member-task26-fixture",
      initiativeId: "initiative-task26-fixture",
      signedAt: "2026-07-28T00:00:00.000Z",
    });

    assert.equal(event.aggregateType, "PetitionSignature");
    assert.equal(event.aggregateId, "signature-task26-fixture");
  });
});

describe("7-8. Transaction atomicity is preserved and no additional lookup was introduced", () => {
  it("signing still inserts exactly one Signature and one outbox event together", async () => {
    const petitionId = nextId("atomicity");
    const decisionId = `decision-task26-identity-atomicity-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    const signatureCount = await getMongoCollection(
      MONGO_COLLECTIONS.petitionSignatures,
    ).countDocuments({
      petitionId,
    });
    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId: buildPetitionSignedEventId(String(signed?.signatures[0]?.signatureId)),
    });

    assert.equal(signatureCount, 1);
    assert.equal(outboxCount, 1);
  });

  it("the rename introduced no new Participant/Member lookup — signPetition's body is unchanged in lookup shape", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    const signPetitionBody = source.slice(
      source.indexOf("export async function signPetition"),
      source.indexOf("export async function closePetition"),
    );

    // Exactly the one pre-existing eligibility check; no new getMemberById/
    // getParticipantById/lookup call was added to rename a field.
    const eligibilityCalls = signPetitionBody.match(/isParticipantEligibleForPetition\(/g) ?? [];
    const memberLookupCalls = signPetitionBody.match(/getMemberById\(|getParticipantById\(/g) ?? [];

    assert.equal(eligibilityCalls.length, 1);
    assert.equal(memberLookupCalls.length, 0);
  });
});

describe("9. Signing API (request/response contract) remains unchanged", () => {
  it("signPetition keeps its existing 3-parameter signature", () => {
    assert.equal(signPetition.length, 3);
  });

  it("the public Signature response shape already used participantId before this task and still does", async () => {
    const petitionId = nextId("api-shape");
    const decisionId = `decision-task26-identity-api-shape-${testRunId}`;
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
  });
});

describe("11. Outbox dispatch remains safe with the corrected payload shape", () => {
  it("dispatch succeeds and the corrected participantId field survives round-trip", async () => {
    const petitionId = nextId("dispatch-safe");
    const decisionId = `decision-task26-identity-dispatch-safe-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    const eventId = buildPetitionSignedEventId(String(signed?.signatures[0]?.signatureId));

    const dispatchCount = await dispatchOutboxOnceForTests();
    assert.ok(dispatchCount >= 1);

    const published = await getMongoCollection<{ status: string; envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId });
    assert.equal(published?.status, "published");
    const envelope = deserializeDomainEventEnvelope(published!.envelope);
    assert.equal(envelope.payload.participantId, sampleMember.id);
  });
});

describe("12-13. No Member Action ledger exists (superseded by Recovery Task 27's Participant Action ledger)", () => {
  // Recovery Task 26 originally pinned "no participant-action module/
  // collection exists yet either" as a pre-implementation baseline. Recovery
  // Task 27 is exactly the task that implements that ledger, so those two
  // specific assertions are now intentionally superseded and removed here —
  // see `test/unit/participant-action/*` for the dedicated Task 27 coverage.
  // The permanent invariant this file still pins is that a "Member Action"
  // ledger (the pre-Task-26 provisional vocabulary) must never exist.
  it("no member-action production module exists", async () => {
    await assert.rejects(
      () => import("../../../src/modules/member-action/index.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/,
    );
  });

  it("MONGO_COLLECTIONS declares no member_actions collection", () => {
    const values = Object.values(MONGO_COLLECTIONS) as string[];
    assert.equal(values.includes("member_actions"), false);
  });
});

describe("14. Signing does not mutate Fair — recording a completed action never requires or affects Member status", () => {
  it("sampleMember.fair is unchanged (still all zeros) after a successful signature", async () => {
    const petitionId = nextId("fair-untouched");
    const decisionId = `decision-task26-identity-fair-untouched-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const before = await getMemberById(sampleMember.id);
    await signPetition(petitionId, sampleMember.id);
    const afterSigning = await getMemberById(sampleMember.id);

    assert.deepEqual(before?.fair, { personal: 0, community: 0, regional: 0, global: 0 });
    assert.deepEqual(afterSigning?.fair, { personal: 0, community: 0, regional: 0, global: 0 });
    assert.deepEqual(afterSigning?.fair, before?.fair);
  });
});

describe("15. Signing does not write to legacy Activity", () => {
  it("the activities collection gains no document as a result of signing", async () => {
    const petitionId = nextId("no-activity-write");
    const decisionId = `decision-task26-identity-no-activity-write-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const before = await getMongoCollection(MONGO_COLLECTIONS.activities).estimatedDocumentCount();
    await signPetition(petitionId, sampleMember.id);
    const after = await getMongoCollection(MONGO_COLLECTIONS.activities).estimatedDocumentCount();

    assert.equal(after, before, "signing a Petition must not insert any Activity document");
  });
});
