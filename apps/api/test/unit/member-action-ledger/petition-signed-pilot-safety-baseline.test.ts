import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import type { CollectiveDecision, Petition } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { deleteOutboxRecordsByEventIdPrefix } from "../../../src/infrastructure/outbox/outbox.repository.js";
import { getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import { createDecision } from "../../../src/modules/collective-decision/collective-decision.store.js";
import { bootstrapCollectiveDecision } from "../../../src/modules/collective-decision/bootstrap-collective-decision.js";
import {
  createPetition,
  deletePetitionsByIdForTests,
  deleteSignaturesByPetitionIdForTests,
  getPetition,
  openPetition,
  preparePetition,
  publishPetition,
  signPetition,
} from "../../../src/modules/petition/petition.store.js";
import { buildPetitionSignedEventId } from "../../../src/modules/petition/petition-signed.event.js";
import { bootstrapInitiativeId, defaultPetitionPolicy } from "../../../src/modules/petition/petition.defaults.js";
import { sampleMember } from "../../../src/modules/member/member.sample.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiSrcDir = path.resolve(currentDir, "../../../src");

/**
 * Recovery Task 22 — "Introduce the Durable Initiative-Scoped Petition Signed
 * Event as the Member Action Ledger Pilot Producer".
 *
 * PART 1/PART 2 of Task 22 required inspecting the petition-signing flow and
 * confirming the `petition_signed` pilot (selected by
 * `ADR-MEMBER-ACTION-LEDGER-v1.0` §21) is still safe before adding a durable
 * outbox event to it. That inspection found two independent, explicit Task 22
 * "stop" conditions (Part 2):
 *
 *   1. "transaction infrastructure cannot atomically include the event" —
 *      `petition.store.ts` is a bare in-process `Map`, with zero import of
 *      Mongo, `runMongoTransaction`, or `enqueueDomainEvent`. There is no
 *      transaction boundary of any kind to extend, and no durable persistence
 *      at all (state does not survive a process restart).
 *   2. "the Initiative ID available at signing is not ancestry-validated" —
 *      `petition.subject.initiativeId` is checked for a non-empty string at
 *      Petition creation (`validateCreatePetition`) but is never checked for
 *      existence against the Initiative aggregate, at creation or at signing.
 *
 * Per Task 22 Part 2 ("Do not silently select another pilot") and Part 22
 * ("If outbox sequencing is unsafe, stop before production implementation and
 * modify only the architecture documentation needed to record the corrected
 * rollout order"), this task does NOT add a `PetitionSigned` production event.
 * This file pins the exact evidence for that decision so a future task cannot
 * silently regress past it without deliberately updating this file.
 *
 * Recovery Task 24 — "Implement Mongo-Backed Petition and Petition Signature
 * Aggregates with Direct Initiative Validation and Transactional Signing" —
 * closed BOTH Task 22 stop conditions above:
 *
 *   1. `petition.store.ts` now persists via Mongo and signs Signatures
 *      through `runMongoTransaction`, so there is now a real transaction
 *      boundary to eventually extend.
 *   2. Petition creation now runs `validateDirectInitiativeAncestry` against
 *      the Initiative aggregate before persisting, so
 *      `petition.subject.initiativeId` is existence-validated (once, at
 *      creation) rather than accepted as an unvalidated string.
 *
 * Per Part 28 of Task 24, this file's expectations were updated to reflect
 * only what Task 24 intentionally closed — at that point it still confirmed
 * that Task 24 did NOT add the `PetitionSigned` event or any outbox/
 * notification wiring, so Task 22 remained correctly blocked on that
 * specific, still-open precondition.
 *
 * Recovery Task 25 — "Resume the Petition Signed Pilot by Adding an Atomic
 * Durable Outbox Event to Transactional Petition Signing" — closed that
 * final precondition: `petition.store.ts` now enqueues a typed, durable
 * `PetitionSigned` event to the existing outbox inside the same Mongo
 * transaction that inserts the Petition Signature (see
 * `petition-signed.event.ts` and `signPetition` in `petition.store.ts`).
 *
 * Per Task 25 Part 23 ("Update the Task 22 safety tests only where the
 * production event intentionally changes their expectations... Replace 'no
 * Petition durable event exists' with 'one typed durable Petition Signed
 * event exists per successful signature'"), the assertions below are
 * flipped to confirm the new, intentional state, while unrelated safety
 * assertions (no notification wiring, no route/response-shape changes to
 * `signPetition`'s parameter count) remain unchanged.
 */

describe("Petition signing now has Mongo persistence, transaction capability, and a durable PetitionSigned outbox event (Task 22 Part 1/2/8 finding — CLOSED by Task 24 + Task 25)", () => {
  it("petition.store.ts now references Mongo transaction AND outbox/event infrastructure", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");

    for (const expectedToken of [
      "mongo-transaction",
      "runMongoTransaction",
      "outbox.repository",
      "enqueueDomainEvent",
      "petition-signed.event",
    ]) {
      assert.equal(
        source.includes(expectedToken),
        true,
        `expected petition.store.ts to now reference "${expectedToken}" (Task 24/Task 25 close this)`,
      );
    }
  });

  it("petition.controller.ts imports no notification or outbox infrastructure (unchanged by Task 25 — the event is enqueued inside petition.store.ts, not the controller)", () => {
    const source = readFileSync(
      path.join(apiSrcDir, "modules/petition/petition.controller.ts"),
      "utf8",
    );

    assert.equal(source.includes("notification.service"), false);
    assert.equal(source.includes("emitCivicNotificationEvent"), false);
    assert.equal(source.includes("outbox"), false);
  });

  it("signPetition keeps its existing 3-parameter signature — the event is invisible to callers (Task 25 Part 17)", () => {
    assert.equal(signPetition.length, 3);
  });
});

describe("Petition initiativeId is now existence-validated against the Initiative aggregate — at creation, not signing (Task 22 Part 2/6 finding — CLOSED by Task 24)", () => {
  const probeInitiativeId = "initiative-does-not-exist-task22-pilot-safety-probe";
  const probeDecisionId = "decision-task22-pilot-safety-probe";
  const probePetitionId = "petition-task22-pilot-safety-probe";

  it("the probe initiativeId genuinely does not exist in the Initiative store", () => {
    assert.equal(getInitiativeById(probeInitiativeId), null);
  });

  it("creating a Petition against that nonexistent Initiative is now rejected, and nothing is persisted", async () => {
    const decisionFixture: CollectiveDecision = {
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId: probeDecisionId,
      decisionSubjectId: probeInitiativeId,
    };

    await createDecision(decisionFixture);

    const petitionFixture: Petition = {
      petitionId: probePetitionId,
      collectiveDecisionId: probeDecisionId,
      status: "Draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subject: {
        decisionId: probeDecisionId,
        initiativeId: probeInitiativeId,
        title: "Task 22 pilot-safety probe petition",
        summary: "Confirms Petition creation now validates Initiative existence.",
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
    };

    // Task 24 Part 6: direct Initiative ancestry is validated once, here at
    // creation — not deferred to signing. Rejection means signing is never
    // reachable for this Petition at all.
    await assert.rejects(() => createPetition(petitionFixture), /does not exist/i);

    const persisted = await getPetition(probePetitionId);
    assert.equal(persisted, null, "rejected ancestry must leave no Petition document behind");

    // Re-confirm the Initiative still does not exist — nothing during the
    // rejected creation attempt caused it to be created as a side effect.
    assert.equal(getInitiativeById(probeInitiativeId), null);
  });
});

describe("PetitionSigned is now the reserved canonical event name for the Petition Signature pilot producer (Task 22 Part 3 finding — CLOSED by Task 25)", () => {
  it("CATALOGUE_EVENTS reserves exactly PetitionSigned, not a rejected alternative", () => {
    const values = Object.values(CATALOGUE_EVENTS) as string[];

    assert.equal(values.includes("PetitionSigned"), true, "PetitionSigned must now be reserved");

    for (const rejectedName of ["InitiativePetitionSigned", "PetitionSignatureCreated"]) {
      assert.equal(
        values.includes(rejectedName),
        false,
        `did not expect rejected alternative "${rejectedName}" to be reserved`,
      );
    }
  });

  it("signing a Petition enqueues exactly one PetitionSigned event per successful signature", async () => {
    const decisionId = `decision-task22-pilot-safety-event-${Date.now()}`;
    const petitionId = `petition-task22-pilot-safety-event-${Date.now()}`;

    const decisionFixture: CollectiveDecision = {
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId,
      decisionSubjectId: bootstrapInitiativeId,
    };
    await createDecision(decisionFixture);

    await createPetition({
      petitionId,
      collectiveDecisionId: decisionId,
      status: "Draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subject: {
        decisionId,
        initiativeId: bootstrapInitiativeId,
        title: "Task 22 pilot-safety event probe petition",
        summary: "Confirms exactly one PetitionSigned event is enqueued per successful signature.",
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

    try {
      const signed = await signPetition(petitionId, sampleMember.id);
      const signatureId = signed?.signatures[0]?.signatureId;
      assert.equal(typeof signatureId, "string");

      const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
        eventId: buildPetitionSignedEventId(String(signatureId)),
        eventName: CATALOGUE_EVENTS.petitionSigned,
      });
      assert.equal(outboxCount, 1);
    } finally {
      await deleteSignaturesByPetitionIdForTests(petitionId);
      await deletePetitionsByIdForTests(petitionId);
      await deleteOutboxRecordsByEventIdPrefix(`petition-signed:signature-${petitionId}-`);
    }
  });
});
