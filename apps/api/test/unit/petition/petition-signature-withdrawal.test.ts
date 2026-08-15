import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  createPetition,
  deletePetitionsByIdForTests,
  deleteSignaturesByPetitionIdForTests,
  openPetition,
  preparePetition,
  publishPetition,
  signPetition,
  withdrawPetitionSignature,
} from "../../../src/modules/petition/petition.store.js";
import { defaultPetitionPolicy } from "../../../src/modules/petition/petition.defaults.js";
import { sampleMember } from "../../../src/modules/member/member.sample.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  buildFixturePetition,
  FIXTURE_INITIATIVE_ID,
  seedApprovedDecision,
} from "./petition-test-helpers.js";

/**
 * Initiative Lifecycle — Part F, Section 8 ("Withdraw Signature").
 *
 * `withdrawPetitionSignature` is new in Part F: it never deletes a
 * Signature document, only flips `status` to `"Withdrawn"` in place, and
 * `signPetition` reactivates (rather than re-inserts) a previously
 * withdrawn Signature — see `petition.store.ts`. These tests exercise the
 * full sign → withdraw → re-sign cycle against real Mongo persistence,
 * mirroring `petition-persistence-characterization.test.ts`'s gating.
 *
 * `petition-test-helpers.ts`'s `seedOpenPetition` uses `defaultPetitionPolicy`,
 * which has `withdrawalPolicy.withdrawalPermitted: false` (Part F, Section
 * 6: Petitions created outside the Lifecycle default to no withdrawal).
 * Lifecycle-published Petitions explicitly opt into withdrawal — see
 * `initiative-petition-lifecycle.service.ts`'s `publishInitiativePetitionStage`
 * — so this file seeds its own Open Petition with that same
 * withdrawal-permitted policy rather than reusing `seedOpenPetition`.
 */

async function seedOpenPetitionWithWithdrawalPermitted(
  petitionId: string,
  decisionId: string,
  initiativeId: string,
) {
  await seedApprovedDecision(decisionId, initiativeId);
  const fixture = buildFixturePetition({ petitionId, decisionId, initiativeId });
  await createPetition({
    ...fixture,
    policy: {
      ...structuredClone(defaultPetitionPolicy),
      withdrawalPolicy: {
        withdrawalPermitted: true,
        withdrawalPolicyDescription: "Signatures may be withdrawn at any time while this Petition is open.",
      },
    },
  });
  await preparePetition(petitionId);
  await publishPetition(petitionId);
  const opened = await openPetition(petitionId);

  if (!opened) {
    throw new Error(`Failed to seed Open Petition "${petitionId}" for test.`);
  }

  return opened;
}

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdPetitionIds: string[] = [];

function nextId(label: string): string {
  const id = `petition-partf-sig-${label}-${testRunId}`;
  createdPetitionIds.push(id);
  return id;
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const petitionId of createdPetitionIds) {
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);
  }

  await disconnectMongoClient();
});

describe("signPetition + withdrawPetitionSignature (Part F, Section 8)", () => {
  it("withdraws an Active signature — the Signature no longer counts as Active but is not deleted", async () => {
    const petitionId = nextId("basic-withdraw");
    await seedOpenPetitionWithWithdrawalPermitted(petitionId, `decision-${petitionId}`, FIXTURE_INITIATIVE_ID);
    const participantId = sampleMember.id;

    const signed = await signPetition(petitionId, participantId);
    assert.equal(signed?.signatures.filter((s) => s.status === "Active").length, 1);

    const withdrawn = await withdrawPetitionSignature(petitionId, participantId);
    assert.equal(withdrawn?.signatures.filter((s) => s.status === "Active").length, 0);

    const withdrawnSignature = withdrawn?.signatures.find((s) => s.participantId === participantId);
    assert.equal(withdrawnSignature?.status, "Withdrawn");
  });

  it("rejects withdrawing a signature that was never recorded", async () => {
    const petitionId = nextId("withdraw-without-sign");
    await seedOpenPetitionWithWithdrawalPermitted(petitionId, `decision-${petitionId}`, FIXTURE_INITIATIVE_ID);

    await assert.rejects(
      () => withdrawPetitionSignature(petitionId, "member-who-never-signed"),
      /has not signed this Petition/,
    );
  });

  it("rejects withdrawing a signature that is already Withdrawn", async () => {
    const petitionId = nextId("double-withdraw");
    await seedOpenPetitionWithWithdrawalPermitted(petitionId, `decision-${petitionId}`, FIXTURE_INITIATIVE_ID);
    const participantId = sampleMember.id;

    await signPetition(petitionId, participantId);
    await withdrawPetitionSignature(petitionId, participantId);

    await assert.rejects(
      () => withdrawPetitionSignature(petitionId, participantId),
      /has not signed this Petition/,
    );
  });

  it("re-signing after a withdrawal reactivates the same Signature row rather than inserting a duplicate", async () => {
    const petitionId = nextId("resign-after-withdraw");
    await seedOpenPetitionWithWithdrawalPermitted(petitionId, `decision-${petitionId}`, FIXTURE_INITIATIVE_ID);
    const participantId = sampleMember.id;

    await signPetition(petitionId, participantId);
    await withdrawPetitionSignature(petitionId, participantId);
    const resigned = await signPetition(petitionId, participantId);

    const signaturesForParticipant = resigned?.signatures.filter(
      (s) => s.participantId === participantId,
    );

    assert.equal(signaturesForParticipant?.length, 1, "no duplicate row was inserted on re-sign");
    assert.equal(signaturesForParticipant?.[0]?.status, "Active");
  });

  it("rejects signing twice while already Active — one signature per Participant", async () => {
    const petitionId = nextId("double-sign");
    await seedOpenPetitionWithWithdrawalPermitted(petitionId, `decision-${petitionId}`, FIXTURE_INITIATIVE_ID);
    const participantId = sampleMember.id;

    await signPetition(petitionId, participantId);

    await assert.rejects(
      () => signPetition(petitionId, participantId),
      /already signed this Petition/,
    );
  });
});
