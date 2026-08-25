import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeImplementationCommitment } from "@hu/types";
import { hasAcceptedImplementationResponsibility } from "@hu/types";

import {
  completeInitiativeImplementationCommitment,
  withdrawInitiativeImplementationCommitment,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js";
import {
  createCommitment,
  deleteCommitmentsByParticipantIdForTests,
  getCommitmentById,
  tryTakeUnassignedCommitment,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { takeInitiativeImplementationCommitment } from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.js";
import { assessInitiativeImplementationTrackingEligibility } from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking-eligibility.js";
import { createInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";

const STEWARD = "pack19a3-steward";
const ACTOR_A = "pack19a3-actor-a";
const ACTOR_B = "pack19a3-actor-b";
const INITIATIVE_ID = "initiative-pack19a3-take";

function baseUnassigned(
  overrides: Partial<InitiativeImplementationCommitment> = {},
): InitiativeImplementationCommitment {
  const now = new Date().toISOString();

  return {
    commitmentId: `implementation-commitment-pack19a3-${Math.random().toString(36).slice(2, 10)}`,
    initiativeId: INITIATIVE_ID,
    decisionId: "decision-pack19a3",
    participantId: null,
    commitmentTitle: "Plant community trees",
    commitmentSummary: "Coordinate planting.",
    commitmentScope: "action",
    status: "published",
    publishedAt: now,
    packageId: "package-pack19a3",
    approvedAction: "Plant community trees along the river path",
    actionIndex: 0,
    proposalStatus: "unassigned",
    proposedByParticipantId: STEWARD,
    acceptedAt: null,
    declinedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function ensureInitiative(): void {
  if (getInitiativeById(INITIATIVE_ID)) {
    return;
  }

  const now = new Date().toISOString();
  const initiative: Initiative = {
    initiativeId: INITIATIVE_ID,
    stewardId: STEWARD,
    createdAt: now,
    updatedAt: now,
    title: "River Path Initiative",
    description: "Fixture.",
    status: "poll",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Global",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };

  createInitiative(initiative);
}

describe("Pack 19A.3 — Take Commitment", () => {
  after(() => {
    deleteCommitmentsByParticipantIdForTests(ACTOR_A);
    deleteCommitmentsByParticipantIdForTests(ACTOR_B);
    deleteCommitmentsByParticipantIdForTests(STEWARD);
  });

  it("A–C. unassigned → Take → accepted with actor + server acceptedAt", async () => {
    ensureInitiative();
    const created = createCommitment(baseUnassigned());
    const before = Date.now();

    const taken = await takeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      created.commitmentId,
      { notifySteward: async () => undefined },
    );

    assert.equal(taken.proposalStatus, "accepted");
    assert.equal(taken.participantId, ACTOR_A);
    assert.ok(taken.acceptedAt);
    assert.ok(Date.parse(taken.acceptedAt!) >= before - 1000);
    assert.equal(hasAcceptedImplementationResponsibility(taken, ACTOR_A), true);
  });

  it("D. tracking eligibility unlocks after Take", async () => {
    ensureInitiative();
    const created = createCommitment(baseUnassigned());
    assert.equal(
      assessInitiativeImplementationTrackingEligibility(created.commitmentId, ACTOR_A).eligible,
      false,
    );

    await takeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      created.commitmentId,
      { notifySteward: async () => undefined },
    );
    assert.equal(
      assessInitiativeImplementationTrackingEligibility(created.commitmentId, ACTOR_A).eligible,
      true,
    );
  });

  it("E–F. actor can Complete and Withdraw under accepted responsibility", async () => {
    ensureInitiative();
    const forComplete = createCommitment(baseUnassigned());
    await takeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      forComplete.commitmentId,
      { notifySteward: async () => undefined },
    );
    const completed = completeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      forComplete.commitmentId,
    );
    assert.equal(completed.status, "completed");
    assert.equal(hasAcceptedImplementationResponsibility(completed, ACTOR_A), true);

    const forWithdraw = createCommitment(baseUnassigned());
    await takeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      forWithdraw.commitmentId,
      { notifySteward: async () => undefined },
    );
    const withdrawn = withdrawInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      forWithdraw.commitmentId,
    );
    assert.equal(withdrawn.status, "withdrawn");
  });

  it("G. second Participant cannot overwrite accepted claim", async () => {
    ensureInitiative();
    const created = createCommitment(baseUnassigned());
    await takeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      created.commitmentId,
      { notifySteward: async () => undefined },
    );

    await assert.rejects(
      () =>
        takeInitiativeImplementationCommitment(
          { participantId: ACTOR_B },
          created.commitmentId,
          { notifySteward: async () => undefined },
        ),
      /already been taken/i,
    );

    const current = getCommitmentById(created.commitmentId);
    assert.equal(current?.participantId, ACTOR_A);

    const race = tryTakeUnassignedCommitment(created.commitmentId, ACTOR_B, new Date().toISOString());
    assert.equal(race, null);
  });

  it("H–J. proposed / declined / completed cannot be taken", async () => {
    ensureInitiative();

    const proposed = createCommitment(
      baseUnassigned({
        participantId: ACTOR_B,
        proposalStatus: "proposed",
      }),
    );
    await assert.rejects(
      () =>
        takeInitiativeImplementationCommitment(
          { participantId: ACTOR_A },
          proposed.commitmentId,
          { notifySteward: async () => undefined },
        ),
      /Only an unassigned/i,
    );

    const declined = createCommitment(
      baseUnassigned({
        participantId: ACTOR_B,
        proposalStatus: "declined",
        declinedAt: new Date().toISOString(),
      }),
    );
    await assert.rejects(
      () =>
        takeInitiativeImplementationCommitment(
          { participantId: ACTOR_A },
          declined.commitmentId,
          { notifySteward: async () => undefined },
        ),
      /Only an unassigned/i,
    );

    const completed = createCommitment(
      baseUnassigned({
        status: "completed",
        completedAt: new Date().toISOString(),
        proposalStatus: "unassigned",
      }),
    );
    await assert.rejects(
      () =>
        takeInitiativeImplementationCommitment(
          { participantId: ACTOR_A },
          completed.commitmentId,
          { notifySteward: async () => undefined },
        ),
      /Only a published/i,
    );
  });

  it("K. unrelated / missing commitment denied", async () => {
    await assert.rejects(
      () =>
        takeInitiativeImplementationCommitment(
          { participantId: ACTOR_A },
          "implementation-commitment-missing",
          { notifySteward: async () => undefined },
        ),
      /not found/i,
    );
  });

  it("L–M. steward notification invoked; failure does not roll back Take", async () => {
    ensureInitiative();
    let notified = false;

    const created = createCommitment(baseUnassigned());
    const taken = await takeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      created.commitmentId,
      {
        notifySteward: async (input) => {
          notified = true;
          assert.equal(input.commitment.commitmentId, created.commitmentId);
          assert.equal(input.actorParticipantId, ACTOR_A);
        },
      },
    );
    assert.equal(notified, true);
    assert.equal(taken.proposalStatus, "accepted");

    const created2 = createCommitment(baseUnassigned());
    const takenDespiteNotifyFailure = await takeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      created2.commitmentId,
      {
        notifySteward: async () => {
          throw new Error("notification transport failed");
        },
      },
    );
    assert.equal(takenDespiteNotifyFailure.proposalStatus, "accepted");
    assert.equal(getCommitmentById(created2.commitmentId)?.proposalStatus, "accepted");
  });

  it("N. future statistics predicate recognizes Take result", async () => {
    ensureInitiative();
    const created = createCommitment(baseUnassigned());
    const taken = await takeInitiativeImplementationCommitment(
      { participantId: ACTOR_A },
      created.commitmentId,
      { notifySteward: async () => undefined },
    );

    assert.equal(hasAcceptedImplementationResponsibility(taken, ACTOR_A), true);
    assert.equal(hasAcceptedImplementationResponsibility(taken, ACTOR_B), false);
  });

  it("O. legacy null-proposalStatus path is not Take-able", async () => {
    ensureInitiative();
    const legacy = createCommitment(
      baseUnassigned({
        participantId: ACTOR_A,
        proposalStatus: null,
        packageId: null,
        approvedAction: null,
      }),
    );

    await assert.rejects(
      () =>
        takeInitiativeImplementationCommitment(
          { participantId: ACTOR_B },
          legacy.commitmentId,
          { notifySteward: async () => undefined },
        ),
      /Only an unassigned/i,
    );
    assert.equal(getCommitmentById(legacy.commitmentId)?.participantId, ACTOR_A);
  });
});
