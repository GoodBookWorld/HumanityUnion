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
  tryAcceptResponsibilityTransfer,
  tryDeclineResponsibilityTransfer,
  tryInitiateResponsibilityTransfer,
  tryReproposeDeclinedCommitment,
  tryTakeUnassignedCommitment,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { toPublicInitiativeImplementationCommitmentProjection } from "../../../src/modules/initiative-implementation-commitment/public-initiative-implementation-commitment.projection.js";
import {
  acceptInitiativeImplementationCommitment,
  declineInitiativeImplementationCommitment,
  initiateImplementationCommitmentTransfer,
  reproposeInitiativeImplementationCommitment,
  takeInitiativeImplementationCommitment,
} from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.js";
import { assessInitiativeImplementationTrackingEligibility } from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking-eligibility.js";
import { createInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import { resolveNotificationRecipientMemberIds } from "../../../src/modules/notifications/notification.recipients.js";

const STEWARD = "pack19a6-steward";
const A = "pack19a6-participant-a";
const B = "pack19a6-participant-b";
const C = "pack19a6-participant-c";
const INITIATIVE_ID = "initiative-pack19a6-certification";

const alwaysExists = async () => true;

function ensureInitiative(): void {
  if (getInitiativeById(INITIATIVE_ID)) {
    return;
  }

  const now = new Date().toISOString();
  createInitiative({
    initiativeId: INITIATIVE_ID,
    stewardId: STEWARD,
    createdAt: now,
    updatedAt: now,
    title: "Pack 19A.6 Certification Initiative",
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
  } satisfies Initiative);
}

function baseCommitment(
  overrides: Partial<InitiativeImplementationCommitment> = {},
): InitiativeImplementationCommitment {
  const now = new Date().toISOString();

  return {
    commitmentId: `implementation-commitment-pack19a6-${Math.random().toString(36).slice(2, 10)}`,
    initiativeId: INITIATIVE_ID,
    decisionId: "decision-pack19a6",
    participantId: A,
    commitmentTitle: "Certify wetland restoration",
    commitmentSummary: "Lifecycle certification fixture.",
    commitmentScope: "action",
    status: "published",
    publishedAt: now,
    packageId: "package-pack19a6",
    approvedAction: "Certify wetland restoration",
    actionIndex: 0,
    proposalStatus: "proposed",
    proposedByParticipantId: STEWARD,
    proposedAt: now,
    acceptedAt: null,
    declinedAt: null,
    pendingProposedParticipantId: null,
    proposalHistory: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function assertOneCanonicalOwner(commitment: InitiativeImplementationCommitment): void {
  if (commitment.proposalStatus === "accepted") {
    assert.ok(commitment.participantId);
    assert.ok(commitment.acceptedAt);
    assert.equal(
      hasAcceptedImplementationResponsibility(commitment, commitment.participantId!),
      true,
    );

    for (const other of [A, B, C, STEWARD]) {
      if (other === commitment.participantId) {
        continue;
      }

      assert.equal(hasAcceptedImplementationResponsibility(commitment, other), false);
    }
  }

  if (commitment.proposalStatus === "declined") {
    assert.equal(hasAcceptedImplementationResponsibility(commitment, A), false);
    assert.equal(hasAcceptedImplementationResponsibility(commitment, B), false);
  }

  if (commitment.proposalStatus === "proposed" || commitment.proposalStatus === "unassigned") {
    assert.equal(hasAcceptedImplementationResponsibility(commitment, A), false);
    assert.equal(hasAcceptedImplementationResponsibility(commitment, B), false);
  }
}

describe("Pack 19A.6 — Responsibility Lifecycle Integration Certification", () => {
  after(() => {
    deleteCommitmentsByParticipantIdForTests(A);
    deleteCommitmentsByParticipantIdForTests(B);
    deleteCommitmentsByParticipantIdForTests(C);
    deleteCommitmentsByParticipantIdForTests(STEWARD);
  });

  it("Path A — propose → Accept yields one canonical owner; Decline preserves history", async () => {
    ensureInitiative();
    const created = createCommitment(baseCommitment());

    const recipients = resolveNotificationRecipientMemberIds({
      eventType: "implementation_commitment_proposed",
      entityType: "implementation_commitment",
      entityId: created.commitmentId,
      initiativeId: INITIATIVE_ID,
      actorMemberId: STEWARD,
    });
    assert.deepEqual(recipients, [A]);

    await assert.rejects(
      () => acceptInitiativeImplementationCommitment({ participantId: C }, created.commitmentId),
      /do not have access/i,
    );

    const accepted = await acceptInitiativeImplementationCommitment(
      { participantId: A },
      created.commitmentId,
    );
    assert.equal(accepted.proposalStatus, "accepted");
    assert.equal(accepted.participantId, A);
    assert.ok(accepted.acceptedAt);
    assertOneCanonicalOwner(accepted);

    await assert.rejects(
      () => acceptInitiativeImplementationCommitment({ participantId: A }, created.commitmentId),
      /already been accepted/i,
    );

    const toDecline = createCommitment(baseCommitment({ participantId: B }));
    const declined = await declineInitiativeImplementationCommitment(
      { participantId: B },
      toDecline.commitmentId,
    );
    assert.equal(declined.proposalStatus, "declined");
    assert.ok(declined.declinedAt);
    assert.ok((declined.proposalHistory ?? []).some((entry) => entry.outcome === "declined"));
    assertOneCanonicalOwner(declined);
    assert.equal(hasAcceptedImplementationResponsibility(declined, B), false);
  });

  it("Path B — Take Commitment converges on same accepted facts; legacy not Take-able", async () => {
    ensureInitiative();
    const created = createCommitment(
      baseCommitment({
        participantId: null,
        proposalStatus: "unassigned",
        proposedAt: null,
      }),
    );

    const taken = await takeInitiativeImplementationCommitment(
      { participantId: A },
      created.commitmentId,
    );
    assert.equal(taken.proposalStatus, "accepted");
    assert.equal(taken.participantId, A);
    assert.ok(taken.acceptedAt);
    assertOneCanonicalOwner(taken);
    assert.equal(
      assessInitiativeImplementationTrackingEligibility(created.commitmentId, A).eligible,
      true,
    );

    assert.equal(tryTakeUnassignedCommitment(created.commitmentId, B, new Date().toISOString()), null);

    const legacy = createCommitment(
      baseCommitment({
        participantId: A,
        proposalStatus: null,
        acceptedAt: null,
        proposedAt: null,
      }),
    );
    await assert.rejects(
      () => takeInitiativeImplementationCommitment({ participantId: B }, legacy.commitmentId),
      /unassigned/i,
    );
  });

  it("Path C — Decline → re-propose → Accept/Decline preserves append-only history", async () => {
    ensureInitiative();
    const created = createCommitment(baseCommitment());
    await declineInitiativeImplementationCommitment({ participantId: A }, created.commitmentId);

    const historyAfterDecline = [...(getCommitmentById(created.commitmentId)!.proposalHistory ?? [])];

    const reproposed = await reproposeInitiativeImplementationCommitment(
      { participantId: STEWARD },
      created.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );
    assert.equal(reproposed.proposalStatus, "proposed");
    assert.equal(reproposed.participantId, B);
    assert.ok(historyAfterDecline.every((entry, index) => {
      const current = reproposed.proposalHistory?.[index];
      return current && current.outcome === entry.outcome && current.participantId === entry.participantId;
    }));
    assert.ok(
      (reproposed.proposalHistory ?? []).some((entry) => entry.outcome === "superseded_by_reproposal"),
    );

    await assert.rejects(
      () => acceptInitiativeImplementationCommitment({ participantId: A }, created.commitmentId),
      /do not have access/i,
    );

    const accepted = await acceptInitiativeImplementationCommitment(
      { participantId: B },
      created.commitmentId,
    );
    assert.equal(accepted.participantId, B);
    assertOneCanonicalOwner(accepted);

    const second = createCommitment(baseCommitment());
    await declineInitiativeImplementationCommitment({ participantId: A }, second.commitmentId);
    await reproposeInitiativeImplementationCommitment(
      { participantId: STEWARD },
      second.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );
    const declinedByB = await declineInitiativeImplementationCommitment(
      { participantId: B },
      second.commitmentId,
    );
    assert.equal(declinedByB.proposalStatus, "declined");
    assert.equal(declinedByB.participantId, B);
    const outcomes = (declinedByB.proposalHistory ?? []).map((entry) => entry.outcome);
    assert.ok(outcomes.includes("declined"));
    assert.ok(outcomes.includes("superseded_by_reproposal"));
    assert.equal(outcomes.filter((outcome) => outcome === "declined").length >= 2, true);
    assertOneCanonicalOwner(declinedByB);
  });

  it("Path D — transfer pending keeps A; Accept moves to B; Decline keeps A", async () => {
    ensureInitiative();
    const created = createCommitment(baseCommitment());
    const accepted = await acceptInitiativeImplementationCommitment(
      { participantId: A },
      created.commitmentId,
    );
    const priorAcceptedAt = accepted.acceptedAt;

    const pending = await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      created.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );
    assert.equal(pending.participantId, A);
    assert.equal(pending.proposalStatus, "accepted");
    assert.equal(pending.pendingProposedParticipantId, B);
    assert.equal(hasAcceptedImplementationResponsibility(pending, A), true);
    assert.equal(hasAcceptedImplementationResponsibility(pending, B), false);
    assertOneCanonicalOwner(pending);

    await assert.rejects(
      () =>
        initiateImplementationCommitmentTransfer(
          { participantId: STEWARD },
          created.commitmentId,
          C,
          { resolveProposedParticipantExists: alwaysExists },
        ),
      /already pending/i,
    );

    const transferred = await acceptInitiativeImplementationCommitment(
      { participantId: B },
      created.commitmentId,
    );
    assert.equal(transferred.participantId, B);
    assert.equal(transferred.pendingProposedParticipantId, null);
    assert.ok(transferred.acceptedAt);
    assert.notEqual(transferred.acceptedAt, priorAcceptedAt);
    assert.ok(
      (transferred.proposalHistory ?? []).some(
        (entry) =>
          entry.outcome === "transferred_away" &&
          entry.participantId === A &&
          entry.acceptedAt === priorAcceptedAt,
      ),
    );
    assertOneCanonicalOwner(transferred);
    assert.equal(
      assessInitiativeImplementationTrackingEligibility(created.commitmentId, A).eligible,
      false,
    );
    assert.equal(
      assessInitiativeImplementationTrackingEligibility(created.commitmentId, B).eligible,
      true,
    );

    const declineCase = createCommitment(baseCommitment({ participantId: A }));
    await acceptInitiativeImplementationCommitment({ participantId: A }, declineCase.commitmentId);
    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      declineCase.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );
    const afterDecline = await declineInitiativeImplementationCommitment(
      { participantId: B },
      declineCase.commitmentId,
    );
    assert.equal(afterDecline.participantId, A);
    assert.equal(afterDecline.pendingProposedParticipantId, null);
    assert.ok(
      (afterDecline.proposalHistory ?? []).some((entry) => entry.outcome === "transfer_declined"),
    );
    assertOneCanonicalOwner(afterDecline);
  });

  it("Pending transfer: owner may Complete/Withdraw; stale transfer Accept cannot corrupt terminal", async () => {
    ensureInitiative();
    const forComplete = createCommitment(baseCommitment());
    await acceptInitiativeImplementationCommitment({ participantId: A }, forComplete.commitmentId);
    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      forComplete.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );

    const completed = completeInitiativeImplementationCommitment(
      { participantId: A },
      forComplete.commitmentId,
    );
    assert.equal(completed.status, "completed");
    assert.equal(completed.participantId, A);
    assert.equal(completed.pendingProposedParticipantId, null);
    assert.ok(completed.completedAt);

    assert.equal(
      tryAcceptResponsibilityTransfer(forComplete.commitmentId, B, new Date().toISOString(), {
        participantId: A,
        outcome: "transferred_away",
        resolvedAt: new Date().toISOString(),
        acceptedAt: completed.acceptedAt,
      }),
      null,
    );

    const forWithdraw = createCommitment(baseCommitment());
    await acceptInitiativeImplementationCommitment({ participantId: A }, forWithdraw.commitmentId);
    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      forWithdraw.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );

    const withdrawn = withdrawInitiativeImplementationCommitment(
      { participantId: A },
      forWithdraw.commitmentId,
    );
    assert.equal(withdrawn.status, "withdrawn");
    assert.equal(withdrawn.pendingProposedParticipantId, null);
    assert.equal(
      tryDeclineResponsibilityTransfer(forWithdraw.commitmentId, B, {
        participantId: B,
        outcome: "transfer_declined",
        resolvedAt: new Date().toISOString(),
      }),
      null,
    );
  });

  it("After transfer, previous owner cannot Complete; replacement can", async () => {
    ensureInitiative();
    const created = createCommitment(baseCommitment());
    await acceptInitiativeImplementationCommitment({ participantId: A }, created.commitmentId);
    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      created.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );
    await acceptInitiativeImplementationCommitment({ participantId: B }, created.commitmentId);

    assert.throws(
      () => completeInitiativeImplementationCommitment({ participantId: A }, created.commitmentId),
      /do not have access|accepted responsibility/i,
    );

    const completed = completeInitiativeImplementationCommitment(
      { participantId: B },
      created.commitmentId,
    );
    assert.equal(completed.status, "completed");
    assert.equal(completed.participantId, B);
    assert.ok(completed.completedAt);
  });

  it("Public projection omits proposalHistory; pendingProposedParticipantId is exposed", async () => {
    ensureInitiative();
    const created = createCommitment(baseCommitment());
    await acceptInitiativeImplementationCommitment({ participantId: A }, created.commitmentId);
    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      created.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );

    const projection = await toPublicInitiativeImplementationCommitmentProjection(
      getCommitmentById(created.commitmentId)!,
    );
    assert.equal(projection.pendingProposedParticipantId, B);
    assert.equal(projection.responsibleParticipantId, A);
    assert.equal("proposalHistory" in projection, false);
  });

  it("History integrity: conditional store helpers never mutate earlier entries", () => {
    ensureInitiative();
    const now = new Date().toISOString();
    const created = createCommitment(
      baseCommitment({
        proposalStatus: "declined",
        declinedAt: now,
        proposalHistory: [
          {
            participantId: A,
            outcome: "declined",
            resolvedAt: now,
          },
        ],
      }),
    );

    const firstHistory = structuredClone(created.proposalHistory ?? []);
    const reproposed = tryReproposeDeclinedCommitment(
      created.commitmentId,
      B,
      now,
      STEWARD,
      {
        participantId: A,
        outcome: "superseded_by_reproposal",
        resolvedAt: now,
      },
    )!;
    assert.deepEqual(reproposed.proposalHistory?.slice(0, firstHistory.length), firstHistory);

    const accepted = tryTakeUnassignedCommitment(
      createCommitment(
        baseCommitment({
          participantId: null,
          proposalStatus: "unassigned",
        }),
      ).commitmentId,
      A,
      now,
    )!;
    assert.equal(accepted.proposalStatus, "accepted");

    const owned = createCommitment(
      baseCommitment({
        proposalStatus: "accepted",
        acceptedAt: now,
        participantId: A,
      }),
    );
    const initiated = tryInitiateResponsibilityTransfer(owned.commitmentId, B, now)!;
    const historyBeforeAccept = structuredClone(initiated.proposalHistory ?? []);
    const transferAccepted = tryAcceptResponsibilityTransfer(owned.commitmentId, B, now, {
      participantId: A,
      outcome: "transferred_away",
      resolvedAt: now,
      acceptedAt: now,
    })!;
    assert.deepEqual(
      transferAccepted.proposalHistory?.slice(0, historyBeforeAccept.length),
      historyBeforeAccept,
    );
    assert.equal(transferAccepted.pendingProposedParticipantId, null);
  });

  it("Authorization: non-steward cannot re-propose or transfer; stale pending cannot act", async () => {
    ensureInitiative();
    const created = createCommitment(baseCommitment());
    await declineInitiativeImplementationCommitment({ participantId: A }, created.commitmentId);

    await assert.rejects(
      () =>
        reproposeInitiativeImplementationCommitment(
          { participantId: C },
          created.commitmentId,
          B,
          { resolveProposedParticipantExists: alwaysExists },
        ),
      /do not have access/i,
    );

    await reproposeInitiativeImplementationCommitment(
      { participantId: STEWARD },
      created.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );
    await acceptInitiativeImplementationCommitment({ participantId: B }, created.commitmentId);

    await assert.rejects(
      () =>
        initiateImplementationCommitmentTransfer(
          { participantId: A },
          created.commitmentId,
          C,
          { resolveProposedParticipantExists: alwaysExists },
        ),
      /do not have access/i,
    );

    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      created.commitmentId,
      C,
      { resolveProposedParticipantExists: alwaysExists },
    );

    await declineInitiativeImplementationCommitment({ participantId: C }, created.commitmentId);

    await assert.rejects(
      () => acceptInitiativeImplementationCommitment({ participantId: C }, created.commitmentId),
      /do not have access|already been accepted/i,
    );
  });
});
