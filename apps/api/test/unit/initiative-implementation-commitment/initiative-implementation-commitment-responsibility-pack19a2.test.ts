import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { InitiativeImplementationCommitment } from "@hu/types";
import {
  hasAcceptedImplementationResponsibility,
  isPackageActionImplementationCommitment,
} from "@hu/types";

import {
  assertAcceptedImplementationResponsibility,
  buildTakeImplementationCommitmentAcceptanceUpdate,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment-responsibility.js";
import {
  completeInitiativeImplementationCommitment,
  withdrawInitiativeImplementationCommitment,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js";
import {
  createCommitment,
  deleteCommitmentsByParticipantIdForTests,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import {
  acceptInitiativeImplementationCommitment,
  declineInitiativeImplementationCommitment,
} from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.js";
import { assessInitiativeImplementationTrackingEligibility } from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking-eligibility.js";

const PARTICIPANT_A = "pack19a2-participant-a";
const PARTICIPANT_B = "pack19a2-participant-b";
const STEWARD = "pack19a2-steward";

function baseCommitment(
  overrides: Partial<InitiativeImplementationCommitment> = {},
): InitiativeImplementationCommitment {
  const now = new Date().toISOString();

  return {
    commitmentId: `implementation-commitment-pack19a2-${Math.random().toString(36).slice(2, 10)}`,
    initiativeId: "initiative-pack19a2",
    decisionId: "decision-pack19a2",
    participantId: PARTICIPANT_A,
    commitmentTitle: "Action title",
    commitmentSummary: "Summary",
    commitmentScope: "action",
    status: "published",
    publishedAt: now,
    packageId: "package-pack19a2",
    approvedAction: "Do the civic Action",
    actionIndex: 0,
    proposalStatus: "proposed",
    proposedByParticipantId: STEWARD,
    acceptedAt: null,
    declinedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Pack 19A.2 — Implementation responsibility hardening", () => {
  after(() => {
    deleteCommitmentsByParticipantIdForTests(PARTICIPANT_A);
    deleteCommitmentsByParticipantIdForTests(PARTICIPANT_B);
    deleteCommitmentsByParticipantIdForTests(STEWARD);
  });

  it("A. proposed is not accepted responsibility", () => {
    const commitment = baseCommitment({ proposalStatus: "proposed", acceptedAt: null });

    assert.equal(isPackageActionImplementationCommitment(commitment), true);
    assert.equal(hasAcceptedImplementationResponsibility(commitment, PARTICIPANT_A), false);
  });

  it("B. unassigned is not accepted responsibility (including historical steward placeholder)", () => {
    const withNull = baseCommitment({
      participantId: null,
      proposalStatus: "unassigned",
      acceptedAt: null,
    });
    const legacyPlaceholder = baseCommitment({
      participantId: STEWARD,
      proposalStatus: "unassigned",
      acceptedAt: null,
    });

    assert.equal(hasAcceptedImplementationResponsibility(withNull, STEWARD), false);
    assert.equal(hasAcceptedImplementationResponsibility(legacyPlaceholder, STEWARD), false);
  });

  it("C. accepted + acceptedAt is accepted responsibility", () => {
    const commitment = baseCommitment({
      proposalStatus: "accepted",
      acceptedAt: new Date().toISOString(),
    });

    assert.equal(hasAcceptedImplementationResponsibility(commitment, PARTICIPANT_A), true);
    assert.equal(hasAcceptedImplementationResponsibility(commitment, PARTICIPANT_B), false);
  });

  it("D. another Participant cannot Accept", async () => {
    const commitment = createCommitment(baseCommitment({ proposalStatus: "proposed" }));

    await assert.rejects(
      () => acceptInitiativeImplementationCommitment({ participantId: PARTICIPANT_B }, commitment.commitmentId),
      /do not have access/i,
    );
  });

  it("E. proposed Participant cannot Complete before Accept", () => {
    const commitment = createCommitment(baseCommitment({ proposalStatus: "proposed" }));

    assert.throws(
      () =>
        completeInitiativeImplementationCommitment(
          { participantId: PARTICIPANT_A },
          commitment.commitmentId,
        ),
      /Accept the proposal first/i,
    );
  });

  it("F. unassigned steward placeholder cannot count as accepted / cannot Complete", () => {
    const commitment = createCommitment(
      baseCommitment({
        participantId: STEWARD,
        proposalStatus: "unassigned",
        acceptedAt: null,
      }),
    );

    assert.equal(hasAcceptedImplementationResponsibility(commitment, STEWARD), false);
    assert.throws(
      () =>
        completeInitiativeImplementationCommitment({ participantId: STEWARD }, commitment.commitmentId),
      /still unassigned/i,
    );

    const tracking = assessInitiativeImplementationTrackingEligibility(commitment.commitmentId, STEWARD);
    assert.equal(tracking.eligible, false);
  });

  it("G. accepted Participant retains responsibility after Complete", () => {
    const acceptedAt = new Date().toISOString();
    const commitment = createCommitment(
      baseCommitment({
        proposalStatus: "accepted",
        acceptedAt,
      }),
    );

    const completed = completeInitiativeImplementationCommitment(
      { participantId: PARTICIPANT_A },
      commitment.commitmentId,
    );

    assert.equal(completed.status, "completed");
    assert.equal(completed.proposalStatus, "accepted");
    assert.equal(completed.acceptedAt, acceptedAt);
    assert.equal(hasAcceptedImplementationResponsibility(completed, PARTICIPANT_A), true);
  });

  it("H. unknown Proposed Participant ID is rejected by assertProposedParticipantsExist", async () => {
    const { assertProposedParticipantsExist } = await import(
      "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.js"
    );

    await assert.rejects(
      () =>
        assertProposedParticipantsExist(
          [
            {
              candidateId: "c1",
              approvedAction: "Action",
              description: "d",
              suggestedResponsibleRole: "role",
              suggestedTimeline: "",
              priority: "normal",
              requiredResources: [],
              relatedRisks: [],
              references: [],
              proposedParticipantId: "unknown-participant-id",
              status: "draft",
            },
          ],
          async () => false,
        ),
      /Proposed Participant ID is unknown/,
    );
  });

  it("I. legacy TASK-031 (null proposalStatus) remains explicit self-author ownership", () => {
    const legacy = baseCommitment({
      packageId: null,
      proposalStatus: null,
      acceptedAt: null,
      participantId: PARTICIPANT_A,
      approvedAction: null,
      actionIndex: null,
    });

    assert.equal(isPackageActionImplementationCommitment(legacy), false);
    assert.equal(hasAcceptedImplementationResponsibility(legacy, PARTICIPANT_A), true);

    const persisted = createCommitment(legacy);
    const completed = completeInitiativeImplementationCommitment(
      { participantId: PARTICIPANT_A },
      persisted.commitmentId,
    );
    assert.equal(completed.status, "completed");
  });

  it("J. Take Commitment transition converges on the same accepted state as Accept", () => {
    const unassigned = baseCommitment({
      participantId: null,
      proposalStatus: "unassigned",
      acceptedAt: null,
    });

    const update = buildTakeImplementationCommitmentAcceptanceUpdate(unassigned, PARTICIPANT_B);
    assert.equal(update.participantId, PARTICIPANT_B);
    assert.equal(update.proposalStatus, "accepted");
    assert.ok(update.acceptedAt);

    const afterTake: InitiativeImplementationCommitment = {
      ...unassigned,
      ...update,
    };

    assert.equal(hasAcceptedImplementationResponsibility(afterTake, PARTICIPANT_B), true);
    assert.equal(hasAcceptedImplementationResponsibility(afterTake, PARTICIPANT_A), false);

    assert.throws(
      () => buildTakeImplementationCommitmentAcceptanceUpdate(
        baseCommitment({ proposalStatus: "proposed" }),
        PARTICIPANT_B,
      ),
      /Only an unassigned/i,
    );
  });

  it("Accept/Decline invariants: repeat Accept rejects; Decline after Accept rejects", async () => {
    const commitment = createCommitment(baseCommitment({ proposalStatus: "proposed" }));

    const accepted = await acceptInitiativeImplementationCommitment(
      { participantId: PARTICIPANT_A },
      commitment.commitmentId,
    );
    assert.equal(accepted.proposalStatus, "accepted");

    await assert.rejects(
      () => acceptInitiativeImplementationCommitment({ participantId: PARTICIPANT_A }, commitment.commitmentId),
      /already been accepted/i,
    );

    await assert.rejects(
      () => declineInitiativeImplementationCommitment({ participantId: PARTICIPANT_A }, commitment.commitmentId),
      /cannot be declined/i,
    );
  });

  it("Withdraw requires accepted responsibility for package commitments", () => {
    const proposed = createCommitment(baseCommitment({ proposalStatus: "proposed" }));
    assert.throws(
      () =>
        withdrawInitiativeImplementationCommitment(
          { participantId: PARTICIPANT_A },
          proposed.commitmentId,
        ),
      /Accept the proposal first/i,
    );

    const accepted = createCommitment(
      baseCommitment({
        proposalStatus: "accepted",
        acceptedAt: new Date().toISOString(),
      }),
    );
    const withdrawn = withdrawInitiativeImplementationCommitment(
      { participantId: PARTICIPANT_A },
      accepted.commitmentId,
    );
    assert.equal(withdrawn.status, "withdrawn");
    assert.equal(hasAcceptedImplementationResponsibility(withdrawn, PARTICIPANT_A), true);
  });

  it("assertAcceptedImplementationResponsibility throws for proposed", () => {
    assert.throws(
      () =>
        assertAcceptedImplementationResponsibility(
          baseCommitment({ proposalStatus: "proposed" }),
          PARTICIPANT_A,
          "completed",
        ),
      /Accept the proposal first/i,
    );
  });

  it("Tracking eligibility requires Accept for package commitments", () => {
    const proposed = createCommitment(baseCommitment({ proposalStatus: "proposed" }));
    assert.equal(
      assessInitiativeImplementationTrackingEligibility(proposed.commitmentId, PARTICIPANT_A).eligible,
      false,
    );

    const accepted = createCommitment(
      baseCommitment({
        proposalStatus: "accepted",
        acceptedAt: new Date().toISOString(),
      }),
    );
    assert.equal(
      assessInitiativeImplementationTrackingEligibility(accepted.commitmentId, PARTICIPANT_A).eligible,
      true,
    );
  });
});
